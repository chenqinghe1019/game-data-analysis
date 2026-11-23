import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

export const conversionNodes=[
  ['launch_scene_start','游戏启动'],
  ['launch_scene_loading_begin','加载开始'],
  ['main_scene_start','进入主界面'],
  ['login_game_success','登录成功'],
  ['load_mainview_begin','游戏资源加载开始'],
  ['load_mainview_success','游戏资源加载成功'],
  ['war_start_first','战斗开始'],
  ['story_show_first','剧情文案出现'],
  ['turret_show','炮台出现'],
  ['cutscene_show','千抽弹窗'],
  ['turret_overload','炮台过热'],
  ['welfare_show','过场动画'],
  ['cutscene_over','过场动画结束'],
  ['war_end_first','战斗结束'],
  ['enter_home_first','进入大厅'],
];

export function conversionDefaults() {
  return {project:{name:'英雄就是我',groups:[]},report:{
    url:'https://ta-data.feiyu.com/#/panel/panel/44_1752_0',title:'激活登录（排除剧情）',
    timeoutSeconds:120,retries:1},schedule:{enabled:false,hours:[0,2,4,6,8,10,12,14,16,18,20,22]}};
}

export function validateConversionConfig(config) {
  const {report,project,schedule}=config ?? {};
  const url=typeof report?.url==='string' ? URL.parse(report.url) : null;
  if (!url || url.origin!=='https://ta-data.feiyu.com' || url.pathname!=='/' || url.search ||
      url.username || url.password || !/^#\/panel\/panel\/44_\d+_\d+$/.test(url.hash)) throw new Error('请填写英雄就是我（项目44）的数数看板地址');
  if (![project?.name,report.title].every(text=>typeof text==='string' && text.trim() && text.length<=160)) throw new Error('请填写项目名称和看板卡片名称');
  if (!Number.isInteger(report.timeoutSeconds) || report.timeoutSeconds<10 || report.timeoutSeconds>600 ||
      !Number.isInteger(report.retries) || report.retries<0 || report.retries>3) throw new Error('查询超时须为10–600秒，重试次数须为0–3次');
  if (typeof schedule?.enabled!=='boolean' || !Array.isArray(schedule.hours) ||
      schedule.hours.some(hour=>!Number.isInteger(hour) || hour<0 || hour>23) ||
      new Set(schedule.hours).size!==schedule.hours.length || (schedule.enabled && !schedule.hours.length)) throw new Error('请选择有效的发送小时');
  return {project:{name:project.name.trim(),groups:[]},report:{url:report.url,title:report.title.trim(),
    timeoutSeconds:report.timeoutSeconds,retries:report.retries},schedule:{enabled:schedule.enabled,hours:[...schedule.hours]}};
}

function csvRows(csv) {
  const rows=[]; let row=[],cell='',quoted=false;
  const input=csv.replace(/^\uFEFF/,'');
  for (let i=0;i<input.length;i++) {
    const c=input[i];
    if (c==='"') { if (quoted && input[i+1]==='"') {cell+='"';i++;} else quoted=!quoted; }
    else if (c===',' && !quoted) {row.push(cell);cell='';}
    else if ((c==='\n' || c==='\r') && !quoted) {
      if (c==='\r' && input[i+1]==='\n') i++;
      row.push(cell); if(row.some(value=>value!=='')) rows.push(row); row=[];cell='';
    } else cell+=c;
  }
  if (quoted) throw new Error('数数CSV引号未闭合');
  row.push(cell); if(row.some(value=>value!=='')) rows.push(row);
  return rows;
}

export function parseConversion(csv,date) {
  const table=csvRows(csv);
  // Dashboard exports are pivoted by date, unlike the SQL editor's row export.
  if(table[0]?.[0]==='$part_date' && table[1]?.[0]==='node_id') {
    const columns=table[0].map((value,index)=>value===date ? index : -1).filter(index=>index>=0);
    const count=columns.filter(index=>table[1][index]==='设备数');
    const rate=columns.filter(index=>table[1][index]==='转化率');
    if(count.length!==1 || rate.length!==1) throw new Error('看板没有完整且唯一的 '+date+' 设备数与转化率列');
    if(table.slice(2).some(row=>row.length!==table[0].length)) throw new Error('看板节点数据列不完整');
    table.splice(0,table.length,['$part_date','node_id','设备数','转化率'],
      ...table.slice(2).map(row=>[date,row[0],row[count[0]],row[rate[0]]]));
  }
  const [headers,...rows]=table;
  if (!headers) throw new Error('数数没有返回节点数据');
  const [di,ni,ci,ri]=['$part_date','node_id','设备数','转化率'].map(label=>{
    const index=headers.indexOf(label);
    if (index<0 || index!==headers.lastIndexOf(label)) throw new Error('数数缺少或重复指标：'+label);
    return index;
  });
  const devices=new Map();
  for (const row of rows.filter(row=>row[di]===date)) {
    const value=row[ci]?.replace(/,/g,'');
    if (row.length!==headers.length || !row[ni] || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || devices.has(row[ni])) throw new Error('节点设备数无效或重复：'+row[ni]);
    const rate=row[ri];
    if(!/^\d+(?:\.\d+)?%?$/.test(rate)) throw new Error('源报表节点转化率无效：'+row[ni]);
    devices.set(row[ni],{count:Number(value),sourceRate:Number(rate.replace('%',''))/(rate.endsWith('%') ? 100 : 1)});
  }
  if (!devices.size) throw new Error('看板没有 '+date+' 的数据，不能使用其他日期替代');
  const start=devices.get('launch_scene_loading_begin')?.count;
  const launch=devices.get('launch_scene_start')?.count;
  if (!(start>0) || !(launch>=start)) throw new Error('缺少有效的游戏启动或加载开始设备数');
  for (const [node,{count,sourceRate}] of devices) {
    if (count>launch || !Number.isFinite(sourceRate) || Math.abs(sourceRate-count/launch)>0.000051) throw new Error('节点设备数与原报表启动转化率不一致：'+node);
  }
  const selected=conversionNodes.map(([id,label])=>{
    const count=devices.get(id)?.count;
    if (count!==undefined && id!=='launch_scene_start' && count>start) throw new Error('节点设备数超过加载开始，需核对漏报或设备口径：'+id);
    return {id,label,devices:count ?? null,rate:id==='launch_scene_start' || count===undefined ? null : count/start};
  });
  return {date,start,launch,end:devices.get('enter_home_first')?.count ?? null,
    rate:devices.has('enter_home_first') ? devices.get('enter_home_first').count/start : null,nodes:selected};
}

export async function writeCombinedHero(data,output,deps,{projectName,hour,gravityRows,spendUnit,fullDay=false}) {
  const require=createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  const wb=Workbook.create(); const sheet=wb.worksheets.add('投放与转化');
  sheet.showGridLines=false;
  const merge=(range,text)=>{sheet.getRange(range).merge();sheet.getRange(range.split(':')[0]).values=[[text]];};
  if(!gravityRows?.length) throw new Error('组合播报缺少引力投放数据');
  const yuan=spendUnit==='yuan';
  const spendFormat=(spendUnit==='yuan' || spendUnit==='wan' ? '#,##0' : '#,##0.00')+(yuan ? '' : '"万"');
  const glast=gravityRows.length+4;
  const section=glast+2, header=section+1, first=header+1, last=header+data.nodes.length;
  merge('A1:G1',projectName+'｜投放与前期转化');
  merge('A2:G2',data.date+' '+(fullDay ? '24' : hour)+':00 · 北京时间 · '+(fullDay ? '全天汇总' : '今日累计'));
  sheet.getRange('A4:G'+glast).values=[['分组','项目','媒体',yuan ? '消耗（元）' : '消耗','激活成本','首付成本','ROI'],
    ...gravityRows.map(row=>row.map((value,index)=>index===3 && !yuan && value!==null ? value/10000 : value))];
  merge('A'+section+':G'+section,'前期转化');
  merge('A'+header+':C'+header,'节点');
  merge('D'+header+':E'+header,'设备数');
  merge('F'+header+':G'+header,'到达率（加载开始=100%）');
  for(const [index,node] of data.nodes.entries()) {
    const row=first+index;
    merge('A'+row+':C'+row,node.label);
    merge('D'+row+':E'+row,node.devices ?? '-');
    merge('F'+row+':G'+row,node.rate ?? '-');
  }
  const all=sheet.getRange('A1:G'+last);
  all.format.font={name:'Microsoft YaHei',size:11,color:'#24415D'};
  all.format.rowHeightPx=31; all.format.verticalAlignment='center';
  sheet.getRange('A4:G'+last).format.horizontalAlignment='center';
  sheet.getRange('A1:G1').format.fill='#EAF2FF';
  sheet.getRange('A1:G1').format.font={name:'Microsoft YaHei',size:18,bold:true,color:'#163C68'};
  sheet.getRange('A1:G1').format.rowHeightPx=46;
  for(const range of ['A4:G4','A'+header+':G'+header]) {
    sheet.getRange(range).format.fill='#2672EF';
    sheet.getRange(range).format.font={name:'Microsoft YaHei',size:11,bold:true,color:'#FFFFFF'};
  }
  sheet.getRange('A'+section+':G'+section).format.fill='#E9F7F1';
  sheet.getRange('A'+section+':G'+section).format.font.bold=true;
  for(const [index,[group,name,media]] of gravityRows.entries()) {
    const row=index+5;
    sheet.getRange('A'+row+':G'+row).format.fill=group==='全盘' ? '#D5E7FF' : media==='合计' ? '#E5F0FF' : '#EDF5FF';
    if(media==='合计') sheet.getRange('A'+row+':G'+row).format.font.bold=true;
  }
  for(let start=0;start<gravityRows.length;) {
    let end=start+1;while(end<gravityRows.length && gravityRows[end][0]===gravityRows[start][0]) end++;
    if(gravityRows[start][0]==='全盘') merge('A'+(start+5)+':B'+(end+4),'全盘');
    else {
      if(end>start+1) merge('A'+(start+5)+':A'+(end+4),gravityRows[start][0]);
      for(let p=start;p<end;) {
        let next=p+1;while(next<end && gravityRows[next][1]===gravityRows[p][1]) next++;
        if(next>p+1) merge('B'+(p+5)+':B'+(next+4),gravityRows[p][1]);
        p=next;
      }
    }
    start=end;
  }
  for (let i=0;i<data.nodes.length;i++) {
    const node=data.nodes[i];
    sheet.getRange('A'+(i+first)+':G'+(i+first)).format.fill=['launch_scene_loading_begin','enter_home_first'].includes(node.id) ? '#E3F3FA' : i%2 ? '#F3F8FC' : '#FFFFFF';
  }
  for(const [column,width] of [['A',84],['B',220],['C',130],['D',134],['E',105],['F',105],['G',108]]) sheet.getRange(column+':'+column).format.columnWidthPx=width;
  sheet.getRange('D5:D'+glast).setNumberFormat(spendFormat);
  sheet.getRange('E5:F'+glast).setNumberFormat('#,##0.00');
  sheet.getRange('G5:G'+glast).setNumberFormat('0.00%');
  sheet.getRange('F5:F'+glast).conditionalFormats.add('dataBar',{color:'#A9A8DF',thresholds:[0,'max'],gradient:false});
  sheet.getRange('G5:G'+glast).conditionalFormats.add('dataBar',{color:'#9DD4C1',thresholds:[0,1],gradient:false});
  sheet.getRange('D'+first+':E'+last).setNumberFormat('#,##0');
  sheet.getRange('F'+first+':G'+last).setNumberFormat('0.00%');
  for(const range of ['A4:G'+glast,'A'+header+':G'+last]) sheet.getRange(range).format.borders={preset:'all',style:'thin',color:'#87939E'};
  sheet.freezePanes.freezeRows(4); wb.recalculate();
  const png=Buffer.from(await (await wb.render({sheetName:'投放与转化',range:'A1:G'+last,headers:false,scale:1})).arrayBuffer());
  await fs.mkdir(path.dirname(output),{recursive:true});
  await (await SpreadsheetFile.exportXlsx(wb)).save(output);
  await fs.writeFile(output.replace(/\.xlsx$/i,'.png'),png);
  return png;
}
