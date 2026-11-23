import {saveReportWorkbook} from './report-workbook.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {conversionNodes} from './hero-conversion.mjs';

export function conversionHistoryView(rows) {
  if(!rows.length) throw new Error('没有前期转化存档');
  const latest=rows.at(-1).date;
  return rows.filter(row=>row.date===latest || row.time==='24:00');
}

export function validateConversionSnapshot(snapshot) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date) || !/^(?:0[1-9]|1\d|2[0-4]):00$/.test(snapshot.time) ||
      !Number.isSafeInteger(snapshot.start) || snapshot.start<=0 || !Array.isArray(snapshot.nodes)) throw new Error('前期转化时点或起点设备数无效');
  if(new Set(snapshot.nodes.map(node=>node.id)).size!==snapshot.nodes.length) throw new Error('前期转化节点重复');
  const indexed=new Map(snapshot.nodes.map(node=>[node.id,node]));
  for(const [id] of conversionNodes) {
    const node=indexed.get(id);
    if(!node) throw new Error('前期转化缺少节点：'+id);
    if(node.devices===null) {if(node.rate!==null) throw new Error('缺失节点不能有到达率');continue;}
    if(!Number.isSafeInteger(node.devices) || node.devices<0) throw new Error('前期转化设备数无效：'+id);
    if(id!=='launch_scene_start' && (node.devices>snapshot.start || !Number.isFinite(node.rate) || Math.abs(node.rate-node.devices/snapshot.start)>0.0000001)) throw new Error('前期转化到达率不一致：'+id);
  }
  if(indexed.get('launch_scene_loading_begin').devices!==snapshot.start) throw new Error('前期转化起点不一致');
}

export async function appendConversionHistory(snapshot,archive,output,deps,{workbook,pngOutput}={}) {
  validateConversionSnapshot(snapshot);
  await fs.mkdir(path.dirname(archive),{recursive:true});
  const db=new DatabaseSync(archive);
  try {
    db.exec('PRAGMA busy_timeout=30000; CREATE TABLE IF NOT EXISTS snapshots(date TEXT,time TEXT,payload TEXT NOT NULL,PRIMARY KEY(date,time)); BEGIN IMMEDIATE');
    db.prepare('INSERT INTO snapshots VALUES(?,?,?) ON CONFLICT(date,time) DO UPDATE SET payload=excluded.payload').run(snapshot.date,snapshot.time,JSON.stringify(snapshot));
    db.exec('COMMIT; BEGIN IMMEDIATE');
    const rows=db.prepare('SELECT payload FROM snapshots ORDER BY date,time').all().map(row=>JSON.parse(row.payload));
    const {workbook:wb,png,visible}=await buildConversionWorkbook(rows,deps,{workbook});
    await saveReportWorkbook(wb,output,deps);
    await fs.writeFile(pngOutput ?? output.replace(/\.xlsx$/i,'.png'),png);db.exec('COMMIT');
    return {rows:rows.length,visible:visible.length,output,png,workbook:wb};
  } finally {db.close();}
}

export async function buildConversionWorkbook(rows,deps,{workbook,history=false,renderImage=true}={}) {
  const visible=history ? rows : conversionHistoryView(rows);
  const require=createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  const wb=(workbook ?? Workbook.create()),sheet=wb.worksheets.add('前期转化');sheet.showGridLines=false;
  const lastColumn=String.fromCharCode(67+conversionNodes.length);
  const last=4+visible.length;
  const merge=(range,value)=>{sheet.getRange(range).merge();sheet.getRange(range.split(':')[0]).values=[[value]];};
  merge('A1:'+lastColumn+'1','英雄就是我｜前期转化');
  merge('A2:'+lastColumn+'2','当日累计 · 加载开始=100%');
  const wrapLabel=label=>({
    '进入主界面':'进入\n主界面','游戏资源加载开始':'游戏资源\n加载开始','游戏资源加载成功':'游戏资源\n加载成功',
    '剧情文案出现':'剧情文案\n出现','过场动画结束':'过场动画\n结束',
  }[label] ?? label);
  sheet.getRange('A4:'+lastColumn+'4').values=[['日期','时间段','指标',...conversionNodes.map(([,label])=>wrapLabel(label))]];
  for(const [index,row] of visible.entries()) {
    const first=5+index;
    const nodes=new Map(row.nodes.map(node=>[node.id,node]));
    sheet.getRange('A'+first+':'+lastColumn+first).values=[
      [row.date,'截至北京时间 '+Number(row.time.slice(0,2))+' 点','设备数',...conversionNodes.map(([id])=>
        id==='launch_scene_start' ? nodes.get(id)?.devices ?? '-' : nodes.get(id)?.rate ?? '-')],
    ];
    sheet.getRange('D'+first).setNumberFormat('#,##0');
    sheet.getRange('E'+first+':'+lastColumn+first).setNumberFormat('0.00%');
    sheet.getRange('A'+first+':'+lastColumn+first).format.fill=index%2 ? '#EFF6FC' : '#FFFFFF';
  }
  for(let start=0;start<visible.length;) {
    let end=start+1;while(end<visible.length && visible[end].date===visible[start].date) end++;
    if(end>start+1) merge('A'+(5+start)+':A'+(4+end),visible[start].date);
    start=end;
  }
  const all=sheet.getRange('A1:'+lastColumn+last);
  all.format.font={name:'Microsoft YaHei',size:11,color:'#203C55'};
  all.format.verticalAlignment='center';all.format.horizontalAlignment='center';all.format.rowHeightPx=31;
  sheet.getRange('A1:'+lastColumn+'1').format.fill='#EAF2FF';
  sheet.getRange('A1:'+lastColumn+'1').format.font={name:'Microsoft YaHei',size:17,bold:true,color:'#163C68'};
  sheet.getRange('A1:'+lastColumn+'1').format.rowHeightPx=45;
  sheet.getRange('A3:'+lastColumn+'3').format.rowHeightPx=10;
  sheet.getRange('A4:'+lastColumn+'4').format.fill='#00A8E8';
  sheet.getRange('A4:'+lastColumn+'4').format.font={name:'Microsoft YaHei',size:11,bold:true,color:'#FFFFFF'};
  sheet.getRange('A4:'+lastColumn+'4').format.rowHeightPx=49;
  sheet.getRange('A4:'+lastColumn+last).format.borders={preset:'all',style:'thin',color:'#C9D6E2'};
  for(const [column,width] of [['A',110],['B',185],['C',85]]) sheet.getRange(column+':'+column).format.columnWidthPx=width;
  for(const [index,[id]] of conversionNodes.entries()) {
    const column=String.fromCharCode(68+index);
    sheet.getRange(column+':'+column).format.columnWidthPx=112;
    if(['launch_scene_loading_begin','enter_home_first'].includes(id)) sheet.getRange(column+'5:'+column+last).format.fill='#E4F4F2';
  }
  sheet.freezePanes.freezeRows(4);wb.recalculate();
  const png=renderImage ? Buffer.from(await (await wb.render({sheetName:'前期转化',range:'A1:'+lastColumn+last,headers:false,scale:1})).arrayBuffer()) : null;
  return {workbook:wb,png,visible};
}
