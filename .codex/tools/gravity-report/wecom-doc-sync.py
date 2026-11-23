"""Fill only missing cells in pre-existing hourly rows through authorized WeCom CLI."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid

HEADERS = ['日期','时间段','当日累计新进','当日累计活跃','当日累计付费','总累计新进','当日累计收入',
           '当前活跃ARPU','付费率','新增首日人均付费次数','新增首日付费金额','总累计收入','累计消耗',
           '累计广告曝光','累计注册转化','人均注册成本','人均付费成本','新增首日付费率','新增首日ARPPU',
           '总累计消耗','ROI1纯买量','ROI1含自然量','实时付费次留','实时注册次留']

class SyncError(Exception):
    def __init__(self,message,retryable=False):
        super().__init__(message)
        self.retryable=retryable

def value(cell):
    if not isinstance(cell, dict):
        return cell
    if 'value' in cell:
        return cell['value']
    return ''.join(str(x.get('value','')) for x in cell.get('rich_string',[]))

def missing(cell):
    if isinstance(cell, dict) and cell.get('formula'):
        return False
    return value(cell) is None or (isinstance(value(cell),str) and value(cell).strip() in {'','-','—'})

def normalized(cell):
    return re.sub(r'[\s（）()]','',str(value(cell) or ''))

def column(index):
    name = ''
    while index:
        index, remainder = divmod(index-1,26)
        name = chr(65+remainder)+name
    return name

def serial_slot(serial):
    if not isinstance(serial,(int,float)) or isinstance(serial,bool) or not math.isfinite(serial):
        return None
    moment = datetime(1899,12,30)+timedelta(seconds=round(serial*86400))
    if moment.minute or moment.second:
        return None
    if moment.hour==0:
        return ((moment-timedelta(days=1)).date().isoformat(),'24:00')
    return (moment.date().isoformat(),f'{moment.hour:02}:00')

def eligible(key,minimum_hour=11):
    return bool(key and minimum_hour<=int(key[1][:2])<=24)

def validate_headers(cells):
    if len(cells)<19 or len(cells[17])<26:
        raise SyncError('分时表结构不完整，停止写入')
    if [normalized(c) for c in cells[17][2:26]] != HEADERS:
        raise SyncError('分时表头发生变化，停止写入')

def target_rows(cells):
    validate_headers(cells)
    targets,carry = {},None
    for index,row in enumerate(cells[19:],20):
        if len(row)<26:
            raise SyncError('在线数据列数不完整')
        date_value = value(row[2])
        if isinstance(date_value,(int,float)):
            carry=(datetime(1899,12,30)+timedelta(days=date_value)).date().isoformat()
        label=str(value(row[3]) or '')
        match=re.fullmatch(r'(?:截至|截止到)(?:北京时间)?\s*(\d{1,2})\s*点\s*',label)
        if not match or not carry:
            continue
        key=(carry,f'{int(match[1]):02}:00')
        helper=serial_slot(value(row[0]))
        if helper!=key:
            raise SyncError('在线日期、小时及辅助时间不一致：第'+str(index)+'行')
        if key in targets:
            raise SyncError('在线日期小时重复，停止写入')
        targets[key]=(index,row)
    return targets

def plan_updates(cells,source,minimum_hour=11):
    targets=target_rows(cells)
    sources={}
    for record in source['rows']:
        key=(record['date'],record['time'])
        if key in sources or len(record['values'])!=24:
            raise SyncError('正式存档存在重复主键或错误列数')
        sources[key]=record
    changes,protected,existing = [],0,0
    for key,(row_index,row) in sorted(targets.items()):
        if not eligible(key,minimum_hour) or key not in sources:
            continue
        source_values=sources[key]['values']
        for offset,source_value in enumerate(source_values[2:],4):
            if isinstance(source_value,bool) or not isinstance(source_value,(int,float)) or not math.isfinite(source_value):
                continue
            current=row[offset]
            if isinstance(current,dict) and current.get('formula'):
                protected+=1
                continue
            if not missing(current):
                existing+=1
                continue
            changes.append({'row':row_index,'col':offset+1,'value':source_value,'key':list(key),
                            # CLI considers stored empty strings occupied. These are
                            # still missing, and must pass the pre-write missing check.
                            'overwrite':value(current) is not None})
    return {'changes':changes,'protectedFormulaCells':protected,'existingDataCells':existing,
            'matchedRows':sum(eligible(k,minimum_hour) and k in sources for k in targets)}

def batches(changes):
    horizontal=[]
    for item in sorted(changes,key=lambda x:(x['row'],x['col'])):
        if horizontal and item['row']==horizontal[-1]['top'] and item['col']==horizontal[-1]['right']+1 and item['overwrite']==horizontal[-1]['overwrite']:
            horizontal[-1]['right']=item['col'];horizontal[-1]['cells'][0].append(item['value'])
        else:
            horizontal.append({'top':item['row'],'bottom':item['row'],'left':item['col'],'right':item['col'],
                               'cells':[[item['value']]],'keys':[item['key']],'overwrite':item['overwrite']})
    packed=[]
    for group in horizontal:
        prior=next((p for p in reversed(packed) if p['bottom']+1==group['top'] and p['left']==group['left'] and
                    p['right']==group['right'] and p['overwrite']==group['overwrite'] and
                    (p['bottom']-p['top']+2)*(p['right']-p['left']+1)<=400),None)
        if prior:
            prior['bottom']=group['bottom'];prior['cells']+=group['cells'];prior['keys']+=group['keys']
        else:
            packed.append(group)
    for group in packed:
        group['range']=column(group['left'])+str(group['top'])+':'+column(group['right'])+str(group['bottom'])
    return sorted(packed,key=lambda g:(g['top'],g['left']))

def reference_style(reference,col):
    cell=reference[col-1]
    style=dict(cell.get('style',{})) if isinstance(cell,dict) else {}
    allowed={'font_family','font_size','bold','italic','underline','strike','font_color','bg_color',
             'horizontal_align','vertical_align','wrap','number_format'}
    style={k:v for k,v in style.items() if k in allowed and not(k=='font_family' and not v)}
    # Row98's manually rounded costs look like 16.52/383.03 under General.
    # Keep raw source precision, but reproduce that visible two-decimal display.
    if col in {18,19} and style.get('number_format') in (None,'','General'):
        style['number_format']='0.00'
    return style

class WeCom:
    def __init__(self,config):
        self.config=config
        self.reference=None
        self.node=config.get('node') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
        self.cli=config.get('cli') or str(Path(os.environ['LOCALAPPDATA'])/'GravityWeComReport/wecom-cli/node_modules/@wecom/cli/bin/wecom.js')

    def call(self,command,payload):
        args=[self.node,self.cli,'sheet',*command,'--json',json.dumps(payload,ensure_ascii=False)]
        try:
            process=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',timeout=35,
                                   creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            result=json.loads(process.stdout)
        except (subprocess.TimeoutExpired,ValueError):
            raise SyncError('企业文档请求超时或结果未知；下次先重读再补缺',retryable=True) from None
        if process.returncode or result.get('errcode',0)!=0 or 'error' in result:
            code=result.get('errcode',result.get('error',{}).get('code','unknown'))
            reason=str(result.get('errmsg') or result.get('error',{}).get('message',''))
            reason=re.sub(r'https?://\S+','[URL]',reason)[:180]
            raise SyncError('企业文档'+('/'.join(command))+' '+str(payload.get('range',''))+'未成功，错误码 '+str(code)+' '+reason,
                            retryable=code in {429,500,502,503,504,-1})
        return result

    def get(self,address,include=None):
        result=self.call(['cells','get'],{'docid':self.config['docid'],'sheet':self.config['sheet'],
                                         'range':address,'include':include or ['formula']})
        if result.get('truncated') or result.get('actual_range')!=address or not isinstance(result.get('cells'),list):
            raise SyncError('在线区域读取不完整，停止写入')
        return result['cells']

    def read_sheet(self):
        result=self.call(['workbook','get'],{'docid':self.config['docid']})
        sheets=[s for s in result.get('sheets',[]) if s.get('sheet_id')==self.config['sheet'] and s.get('name')=='分时数据维度']
        if len(sheets)!=1 or not re.fullmatch(r'A1:Z\d+',sheets[0].get('range','')):
            raise SyncError('目标子表名称或边界改变，停止写入')
        address=sheets[0]['range']
        if int(address.split('Z')[1])*26>8000:
            raise SyncError('分时表超过单次读取范围，需要扩展分批方案')
        return self.get(address)

    def write(self,group,dry_run=False):
        cells=group['cells']
        reference_row=self.config.get('formatReferenceRow')
        if reference_row:
            if self.reference is None:
                self.reference=self.get('A'+str(reference_row)+':Z'+str(reference_row),['formula','style'])[0]
            cells=[[{'value':v,'style':reference_style(self.reference,group['left']+j)} for j,v in enumerate(row)] for row in cells]
        return self.call(['cells','batchset'],{'docid':self.config['docid'],'sheet':self.config['sheet'],
             'range':group['range'],'cells':cells,'allow_overwrite':group['overwrite'],
             'verify':True,**({'dry_run':True} if dry_run else {})})

def equal(actual,expected):
    return isinstance(actual,(int,float)) and not isinstance(actual,bool) and abs(actual-expected)<=1e-8*max(1,abs(expected))

def sync_once(config,apply=False,required_key=None,deadline=None):
    client=WeCom(config)
    with tempfile.TemporaryDirectory() as directory:
        output=Path(directory)/'source.json'
        source_process=subprocess.run([client.node,str(Path(__file__).with_name('wecom-doc-source.mjs')),
                              config['archive'],str(output)],capture_output=True,text=True,encoding='utf-8',timeout=45,
                              creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if source_process.returncode:
            raise SyncError('正式小时报存档读取失败')
        source=json.loads(output.read_text(encoding='utf-8'))
    cells=client.read_sheet()
    if required_key and tuple(required_key) not in target_rows(cells):
        raise SyncError('当前小时没有预置行，未新增或移动任何行，请补充模板日期')
    if required_key and not any((r['date'],r['time'])==tuple(required_key) for r in source['rows']):
        raise SyncError('当前小时没有正式存档，不使用旧数据代替')
    plan=plan_updates(cells,source,config.get('minimumHour',11))
    groups=batches(plan['changes'])
    summary={k:v for k,v in plan.items() if k!='changes'}
    summary.update(plannedCells=len(plan['changes']),batches=len(groups),rows=sorted({x['row'] for x in plan['changes']}),applied=apply,writtenCells=0)
    if not apply or not groups:
        return summary
    for group in groups[:5]:
        client.write(group,dry_run=True)
    for group in groups:
        if deadline is not None and time.monotonic()>deadline:
            raise SyncError('本轮文档同步超过15分钟，未补项留待后续请求')
        # Recheck the row keys and content immediately before each fixed batch.
        keys=client.get('A'+str(group['top'])+':D'+str(group['bottom']))
        if len(keys)!=len(group['keys']) or any(list(serial_slot(value(row[0])) or ())!=key for row,key in zip(keys,group['keys'])):
            raise SyncError('在线行位置在同步期间改变，已停止')
        current=client.get(group['range'])
        if any(not missing(c) for row in current for c in row):
            raise SyncError('在线单元格已被填写或存在公式，已停止避免覆盖')
        client.write(group)
        actual=client.get(group['range'])
        if len(actual)!=len(group['cells']) or any(len(a)!=len(e) or any(not equal(value(x),y) for x,y in zip(a,e)) for a,e in zip(actual,group['cells'])):
            raise SyncError('在线写后核对未通过；下次重读补缺，不重发播报')
        summary['writtenCells']+=sum(len(row) for row in group['cells'])
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',required=True)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    config_path=Path(args.config).resolve()
    config=json.loads(config_path.read_text(encoding='utf-8-sig'))
    if config.get('enabled') is not True or config.get('minimumHour')!=11 or not re.fullmatch(r'e3_[A-Za-z0-9]+',config.get('docid','')):
        raise SyncError('文档同步配置未启用或不符合11点起规则')
    if Path(config.get('archive','')).resolve()!=(config_path.parent/'hourly-snapshots.sqlite').resolve():
        raise SyncError('同步源必须是当前联合小时报的正式存档')
    directory=config_path.parent/'wecom-doc-sync'
    directory.mkdir(exist_ok=True)
    lock=directory/'worker.lock'
    try:
        handle=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError:
        if time.time()-lock.stat().st_mtime<=1800:
            print('企业文档同步已有任务运行，本次请求留待后续补缺')
            return
        lock.unlink()
        handle=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    os.close(handle)
    deadline=time.monotonic()+900
    try:
        for attempt in range(3 if args.apply else 1):
            try:
                request_file=directory/'request.json'
                request=json.loads(request_file.read_text(encoding='utf-8')) if request_file.exists() else None
                required_key=(request['date'],request['time']) if request and args.apply else None
                summary=sync_once(config,args.apply,required_key,deadline)
                summary.update(state='success' if args.apply else 'planned',attempt=attempt+1,at=datetime.now(timezone(timedelta(hours=8))).isoformat())
                (directory/'status.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
                print(json.dumps(summary,ensure_ascii=False))
                return
            except SyncError as error:
                state={'state':'pending','attempt':attempt+1,'error':str(error),'at':datetime.now(timezone(timedelta(hours=8))).isoformat()}
                (directory/'status.json').write_text(json.dumps(state,ensure_ascii=False),encoding='utf-8')
                print('文档同步未完成：'+str(error),flush=True)
                if not error.retryable or attempt+1>=(3 if args.apply else 1):
                    raise
                time.sleep([15,45][attempt])
    finally:
        lock.unlink(missing_ok=True)

if __name__=='__main__':
    try:
        main()
    except (SyncError,OSError,ValueError,subprocess.TimeoutExpired) as error:
        print('企业文档同步失败：'+str(error),file=sys.stderr)
        raise SystemExit(1)
