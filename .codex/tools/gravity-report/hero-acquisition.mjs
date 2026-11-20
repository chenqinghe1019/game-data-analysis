import {saveReportWorkbook} from './report-workbook.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

function csvTable(csv) {
  const rows=[];let row=[],value='',quoted=false;
  const text=csv.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted && text[i+1]==='"') {value+='"';i++;} else quoted=!quoted;}
    else if(c===',' && !quoted) {row.push(value);value='';}
    else if((c==='\n' || c==='\r') && !quoted) {
      if(c==='\r' && text[i+1]==='\n') i++;
      row.push(value);if(row.some(cell=>cell!=='')) rows.push(row);row=[];value='';
    } else value+=c;
  }
  if(quoted) throw new Error('CSV引号未闭合');
  row.push(value);if(row.some(cell=>cell!=='')) rows.push(row);
  return rows;
}

function readRows(csv,date,media) {
  const [headers,...rows]=csvTable(csv);
  const labels=['新增日期',...(media ? ['媒体平台'] : []),'新增','新增首日付费人数','新增首日付费金额','新增首日付费率','新增首日ARPPU'];
  for(const label of labels) if(!headers || headers.indexOf(label)<0 || headers.indexOf(label)!==headers.lastIndexOf(label)) throw new Error('缺少或重复指标：'+label);
  const records=[];
  for(const row of rows.filter(row=>row[headers.indexOf('新增日期')]===date)) {
    if(row.length!==headers.length) throw new Error('数数数据列不完整');
    const get=label=>row[headers.indexOf(label)]?.trim();
    const number=(label,nullable=false)=>{
      const value=get(label)?.replace(/,/g,'');
      if(value==='' && nullable) return null;
      if(!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('数数指标无效：'+label);
      const n=Number(value);if(!Number.isFinite(n)) throw new Error('数数指标溢出：'+label);return n;
    };
    const registrations=number('新增'),payers=number('新增首日付费人数');
    if(!Number.isSafeInteger(registrations) || !Number.isSafeInteger(payers) || payers>registrations) throw new Error('新增与首日付费人数不一致');
    let amount=number('新增首日付费金额',true);
    if(amount===null && payers===0) amount=0;
    if(amount===null || (!payers && amount!==0)) throw new Error('首日付费人数与金额不一致');
    const sourceRate=get('新增首日付费率');
    if(!/^\d+(?:\.\d+)?%$/.test(sourceRate)) throw new Error('首日付费率格式无效');
    if(Math.abs(Number(sourceRate.replace('%',''))/100-(registrations ? payers/registrations : 0))>0.000051) throw new Error('源报表首日付费率校验失败');
    const sourceArppu=number('新增首日ARPPU');
    if(Math.abs(sourceArppu-(payers ? amount/payers : 0))>0.0051) throw new Error('源报表首日ARPPU校验失败');
    records.push({media:media ? get('媒体平台') : undefined,registrations,payers,amount,sourceRate,sourceArppu});
  }
  if(!records.length) throw new Error('数数没有 '+date+' 的数据');
  return records;
}

export function aggregateAcquisition(mediaCsv,totalCsv,date) {
  const allMedia=readRows(mediaCsv,date,true);
  const records=allMedia.filter(row=>row.media && row.media!=='自然量');
  if(new Set(records.map(row=>row.media)).size!==records.length) throw new Error('同日存在重复媒体，无法按媒体唯一汇总');
  if(!records.length) throw new Error('该日期没有买量媒体数据');
  const totalRows=readRows(totalCsv,date,false);
  if(totalRows.length!==1) throw new Error('含自然量汇总必须每个日期只有一行');
  const total=totalRows[0];
  const paid=records.reduce((sum,row)=>({registrations:sum.registrations+row.registrations,payers:sum.payers+row.payers,amount:sum.amount+row.amount}),{registrations:0,payers:0,amount:0});
  if(paid.registrations>total.registrations || paid.payers>total.payers || paid.amount>total.amount+0.01) throw new Error('买量分媒体之和超过含自然量汇总，需核对媒体归属、去重或筛选');
  return {date,media:records,paid:{...paid,payRate:paid.registrations ? paid.payers/paid.registrations : null,
    arppu:paid.payers ? paid.amount/paid.payers : null},total};
}

export function acquisitionValues(snapshot,cumulative,roiMode='gravity') {
  const {paid,total,gravity,date,time}=snapshot;
  if(!Number.isFinite(gravity?.spend) || gravity.spend<0) throw new Error('缺少有效引力消耗');
  const divide=(a,b)=>b>0 ? a/b : '-';
  const pure=roiMode==='gravity' ? gravity.paidRoi ?? '-' : divide(paid.amount,gravity.spend);
  const inclusive=roiMode==='gravity' ? gravity.totalRoi ?? '-' : divide(total.amount,gravity.spend);
  return [date,'截至北京时间 '+Number(time.slice(0,2))+' 点',gravity.spend,
    divide(gravity.spend,paid.registrations),divide(gravity.spend,paid.payers),paid.payRate ?? '-',paid.arppu ?? '-',
    cumulative ?? '-',pure,inclusive];
}

export function acquisitionView(rows,startDate,roiMode='gravity',{history=false}={}) {
  if(!rows.length) throw new Error('没有小时存档');
  const latest=rows.at(-1).date;
  const visible=history ? rows : rows.filter(row=>row.date===latest || row.time==='24:00');
  const closed=new Map(rows.filter(row=>row.time==='24:00').map(row=>[row.date,row.gravity.spend]));
  const values=visible.map(row=>{
    let day=startDate,cumulative=row.gravity.spend;
    while(day<row.date) {
      if(!closed.has(day)) {cumulative=null;break;}
      cumulative+=closed.get(day);
      day=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
    }
    return acquisitionValues(row,cumulative,roiMode);
  });
  return {visible,values};
}

export async function appendAcquisition(snapshot,archive,output,deps,{startDate,roiMode='gravity',workbook,deferSave=false,pngOutput}={}) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || snapshot.date<startDate ||
      !/^(?:0[1-9]|1\d|2[0-4]):00$/.test(snapshot.time) || !['ta','gravity'].includes(roiMode)) throw new Error('累计起算日期、播报时点或ROI口径无效');
  acquisitionValues(snapshot,null,roiMode);
  await fs.mkdir(path.dirname(archive),{recursive:true});
  const db=new DatabaseSync(archive);
  try {
    db.exec('PRAGMA busy_timeout=30000; CREATE TABLE IF NOT EXISTS snapshots(date TEXT,time TEXT,payload TEXT NOT NULL,PRIMARY KEY(date,time)); BEGIN IMMEDIATE');
    db.prepare('INSERT INTO snapshots VALUES(?,?,?) ON CONFLICT(date,time) DO UPDATE SET payload=excluded.payload').run(snapshot.date,snapshot.time,JSON.stringify(snapshot));
    db.exec('COMMIT; BEGIN IMMEDIATE');
    const rows=db.prepare('SELECT payload FROM snapshots WHERE date>=? ORDER BY date,time').all(startDate).map(row=>JSON.parse(row.payload));
    const {workbook:wb,png,visible,values}=await buildAcquisitionWorkbook(rows,deps,{startDate,roiMode,workbook});
    if(!deferSave) await saveReportWorkbook(wb,output,deps);
    await fs.writeFile(pngOutput ?? output.replace(/\.xlsx$/i,'.png'),png);
    db.exec('COMMIT');
    return {rows:rows.length,visible:visible.length,values,workbook:wb,png};
  } finally {db.close();}
}

export async function buildAcquisitionWorkbook(rows,deps,{startDate,roiMode='gravity',workbook,history=false,renderImage=true}={}) {
  const {visible,values}=acquisitionView(rows,startDate,roiMode,{history});
  const require=createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  const wb=(workbook ?? Workbook.create()),sheet=wb.worksheets.add('买量小时报');sheet.showGridLines=false;
  const merge=(range,text)=>{sheet.getRange(range).merge();sheet.getRange(range.split(':')[0]).values=[[text]];};
  merge('A1:J1','英雄就是我｜买量小时报');
  merge('A2:B2','时间');merge('C2:H2','买量');merge('I2:J2','ROI');
  merge('A3:A4','日期');merge('B3:B4','时间段');
  sheet.getRange('C3:J4').values=[
    ['累计消耗','人均注册\n成本','人均付费\n成本','新增首日\n付费率','新增首日\nARPPU','总累计\n消耗','ROI1\n（纯买量）','ROI1\n（含自然量）'],
    ['当日买量消耗','消耗 ÷ 买量注册','消耗 ÷ 首日\n付费人数（买量）','买量首日付费人数\n÷ 买量注册人数','买量首日付费金额\n÷ 买量首日付费人数','自 '+startDate.slice(5).replace('-','月')+'日起累计',null,null],
  ];
  const last=values.length+4;sheet.getRange('A5:J'+last).values=values;
  const all=sheet.getRange('A1:J'+last);all.format.font={name:'Microsoft YaHei',size:11,color:'#203C55'};
  all.format.rowHeightPx=31;all.format.verticalAlignment='center';all.format.horizontalAlignment='center';
  sheet.getRange('A1:J1').format.fill='#EAF2FF';sheet.getRange('A1:J1').format.font={name:'Microsoft YaHei',size:17,bold:true,color:'#163C68'};
  sheet.getRange('A1:J1').format.rowHeightPx=45;
  sheet.getRange('A2:J2').format.fill='#00A8E8';sheet.getRange('A2:J2').format.font.color='#FFFFFF';
  sheet.getRange('A3:J4').format.fill='#7DBFE7';sheet.getRange('A3:J3').format.font={name:'Microsoft YaHei',size:12,bold:true,color:'#FFFFFF'};
  sheet.getRange('A3:J3').format.rowHeightPx=56;sheet.getRange('A4:J4').format.rowHeightPx=49;
  sheet.getRange('A4:J4').format.font={name:'Microsoft YaHei',size:10,color:'#476D8B'};
  sheet.getRange('A2:J'+last).format.borders={preset:'all',style:'thin',color:'#D6DFE8'};
  for(let start=0;start<visible.length;) {
    let end=start+1;while(end<visible.length && visible[end].date===visible[start].date) end++;
    if(end>start+1) merge('A'+(start+5)+':A'+(end+4),visible[start].date);
    start=end;
  }
  for(const [column,width] of [['A',110],['B',185],['C',125],['D',125],['E',135],['F',145],['G',155],['H',140],['I',125],['J',140]]) sheet.getRange(column+':'+column).format.columnWidthPx=width;
  for(const range of ['C5:E'+last,'G5:H'+last]) sheet.getRange(range).setNumberFormat('#,##0.00');
  for(const range of ['F5:F'+last,'I5:J'+last]) sheet.getRange(range).setNumberFormat('0.00%');
  sheet.freezePanes.freezeRows(4);wb.recalculate();
  const png=renderImage ? Buffer.from(await (await wb.render({sheetName:'买量小时报',range:'A1:J'+last,headers:false,scale:1})).arrayBuffer()) : null;
  return {workbook:wb,png,visible,values};
}
