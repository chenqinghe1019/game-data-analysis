import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/feiyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const outDir = 'C:/Users/feiyu/Documents/飞鱼游戏-倍特工作室/outputs/01a04687-6ed7-72d3-a3a4-54d899bde3bf';
const xlsxPath = `${outDir}/保卫萝卜4_无限冲浪上线前后数据分析_三端汇总.xlsx`;
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(xlsxPath));

console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:3000})).ndjson);
const before = await wb.render({sheetName:'无限冲浪数据分析',autoCrop:'all',scale:1,format:'png'});
await fs.writeFile(`${outDir}/修改前_主表.png`,new Uint8Array(await before.arrayBuffer()));

const rawRows = [
 ['安卓','2026-08-23',628953,2335465,'1.3 小时','22.3 分钟'],['安卓','2026-08-22',626413,2360453,'1.2 小时','21.5 分钟'],['安卓','2026-08-21',627797,2383762,'1.1 小时','19.6 分钟'],['安卓','2026-08-20',627071,2418286,'1.1 小时','18.9 分钟'],['安卓','2026-08-19',611971,2122363,'58.2 分钟','18.3 分钟'],['安卓','2026-08-18',616411,2137883,'58.9 分钟','18.5 分钟'],['安卓','2026-08-17',613596,2126010,'59.8 分钟','18.8 分钟'],['安卓','2026-08-16',617095,2169950,'1.1 小时','19.7 分钟'],['安卓','2026-08-15',615857,2202806,'1.1 小时','19.5 分钟'],['安卓','2026-08-14',618607,2243911,'1.1 小时','19.1 分钟'],['安卓','2026-08-13',619625,2328798,'1.1 小时','18.7 分钟'],['安卓','2026-08-12',613342,2126554,'59.5 分钟','18.8 分钟'],['安卓','2026-08-11',611184,2125818,'1 小时','18.9 分钟'],['安卓','2026-08-10',605995,2070506,'58.8 分钟','18.7 分钟'],
 ['苹果','2026-08-23',404270,1780198,'1.3 小时','17.7 分钟'],['苹果','2026-08-22',401065,1781598,'1.3 小时','17.1 分钟'],['苹果','2026-08-21',402149,1766859,'1.1 小时','15.4 分钟'],['苹果','2026-08-20',402240,1804223,'1.1 小时','14.9 分钟'],['苹果','2026-08-19',390603,1557763,'57 分钟','14.5 分钟'],['苹果','2026-08-18',395164,1573424,'58.1 分钟','14.7 分钟'],['苹果','2026-08-17',392437,1562368,'58.9 分钟','14.9 分钟'],['苹果','2026-08-16',394642,1608419,'1 小时','15.7 分钟'],['苹果','2026-08-15',393776,1643046,'1.1 小时','15.5 分钟'],['苹果','2026-08-14',394070,1660992,'1 小时','15.1 分钟'],['苹果','2026-08-13',396084,1700066,'1.1 小时','14.9 分钟'],['苹果','2026-08-12',391544,1547863,'58.2 分钟','14.9 分钟'],['苹果','2026-08-11',390489,1557274,'59.2 分钟','15 分钟'],['苹果','2026-08-10',387065,1511952,'57.6 分钟','14.9 分钟'],
 ['鸿蒙','2026-08-23',108264,476681,'1.1 小时','17.2 分钟'],['鸿蒙','2026-08-22',107492,480340,'1 小时','16.5 分钟'],['鸿蒙','2026-08-21',106584,486686,'55.8 分钟','14.6 分钟'],['鸿蒙','2026-08-20',105587,496493,'59.7 分钟','14.6 分钟'],['鸿蒙','2026-08-19',103540,438523,'51.4 分钟','14 分钟'],['鸿蒙','2026-08-18',104306,440930,'52.4 分钟','14.4 分钟'],['鸿蒙','2026-08-17',103718,435704,'52.6 分钟','14.5 分钟'],['鸿蒙','2026-08-16',104728,442836,'56.5 分钟','15.5 分钟'],['鸿蒙','2026-08-15',104386,447862,'56.1 分钟','15.2 分钟'],['鸿蒙','2026-08-14',104940,464155,'55.8 分钟','14.6 分钟'],['鸿蒙','2026-08-13',105103,476711,'57.3 分钟','14.6 分钟'],['鸿蒙','2026-08-12',104183,437832,'52.8 分钟','14.6 分钟'],['鸿蒙','2026-08-11',103893,440951,'53.6 分钟','14.6 分钟'],['鸿蒙','2026-08-10',102962,430674,'52.2 分钟','14.5 分钟']
];
function secs(v){const n=parseFloat(v); return /小时/.test(v)?n*3600:n*60;}
const dates=[...new Set(rawRows.map(r=>r[1]))].sort();
const daily=dates.map(d=>{const rs=rawRows.filter(r=>r[1]===d); const au=rs.reduce((s,r)=>s+r[2],0); const starts=rs.reduce((s,r)=>s+r[3],0); const pw=rs.reduce((s,r)=>s+secs(r[4])*r[2],0); const sw=rs.reduce((s,r)=>s+secs(r[5])*r[3],0); return [d,au,starts,pw,sw,starts/au,pw/au,sw/starts];});

const raw=wb.worksheets.getItem('原始数据');
raw.getRange('A19:E21').clear({applyTo:'contents'});
raw.getRange('A53:B54').values=[['第三模块来源','趋势分析 → 基本趋势（三端汇总）'],['第三模块加权','人均时长按活跃用户加权；次均时长按启动次数加权；统一换算为秒']];
raw.getRange('A60:H76').clear({applyTo:'all'});
raw.getRange('A60:H60').values=[['趋势分析三端汇总（第三模块）','','','','','','','']];
raw.getRange('A60:H60').merge();
raw.getRange('A61:H61').values=[['日期','活跃用户','启动次数','人均时长加权秒','次均时长加权秒','人均启动次数','人均时长（秒）','次均时长（秒）']];
raw.getRange('A62:H75').values=daily;
raw.getRange('A60:H60').format={fill:'#82D4F4',font:{name:'微软雅黑',bold:true,color:'#000000'},horizontalAlignment:'left'};
raw.getRange('A61:H61').format={fill:'#DDEBF7',font:{name:'微软雅黑',bold:true},horizontalAlignment:'center',borders:{preset:'all',style:'thin',color:'#A6A6A6'}};
raw.getRange('A62:H75').format={font:{name:'微软雅黑'},borders:{preset:'all',style:'thin',color:'#D9D9D9'}};
raw.getRange('B62:E75').format.numberFormat='#,##0.00'; raw.getRange('F62:H75').format.numberFormat='0.00';
raw.getRange('A:A').format.columnWidth=16; raw.getRange('B:H').format.columnWidth=18;

const main=wb.worksheets.getItem('无限冲浪数据分析');
main.getRange('A19:D23').clear({applyTo:'contents'});
main.getRange('A19:D19').values=[['时间','人均启动次数','人均时长（秒）','次均时长（秒）']];
main.getRange('A20:A23').values=[['8.10-8.16'],['8.17-8.23'],['差异'],['涨幅']];
main.getRange('B20:D20').formulas=[["=SUM('原始数据'!C62:C68)/SUM('原始数据'!B62:B68)","=SUM('原始数据'!D62:D68)/SUM('原始数据'!B62:B68)","=SUM('原始数据'!E62:E68)/SUM('原始数据'!C62:C68)"]];
main.getRange('B21:D21').formulas=[["=SUM('原始数据'!C69:C75)/SUM('原始数据'!B69:B75)","=SUM('原始数据'!D69:D75)/SUM('原始数据'!B69:B75)","=SUM('原始数据'!E69:E75)/SUM('原始数据'!C69:C75)"]];
main.getRange('B22:D22').formulas=[['=B21-B20','=C21-C20','=D21-D20']];
main.getRange('B23:D23').formulas=[['=B22/B20','=C22/C20','=D22/D20']];
main.getRange('B20:D22').format.numberFormat='0.00'; main.getRange('B23:D23').format.numberFormat='0.00%';
main.getRange('A18:D18').values=[['无限冲浪开启前后趋势分析对比（三端汇总）','','','']];
main.getRange('A18:D18').merge();

let detail;
try { detail=wb.worksheets.getItem('时长每日明细'); detail.getUsedRange()?.clear({applyTo:'all'}); } catch { detail=wb.worksheets.add('时长每日明细'); }
detail.showGridLines=false;
detail.getRange('A1:D1').values=[['时间','人均启动次数','人均时长（秒）','次均时长（秒）']];
detail.getRange('A2:A15').values=dates.map(d=>[`${Number(d.slice(5,7))}月${Number(d.slice(8,10))}日`]);
detail.getRange('B2:D15').formulas=dates.map((_,i)=>[[`='原始数据'!F${62+i}`,`='原始数据'!G${62+i}`,`='原始数据'!H${62+i}`]]).map(x=>x[0]);
detail.getRange('A16').values=[['人均']];
detail.getRange('B16:D16').formulas=[['=AVERAGE(B2:B15)','=AVERAGE(C2:C15)','=AVERAGE(D2:D15)']];
detail.getRange('A1:D16').format={font:{name:'微软雅黑',size:12},horizontalAlignment:'center',verticalAlignment:'center',borders:{preset:'all',style:'thin',color:'#A6A6A6'}};
detail.getRange('A1:D1').format={fill:'#DDEBF7',font:{name:'微软雅黑',size:12,bold:true},horizontalAlignment:'center',verticalAlignment:'center',borders:{preset:'all',style:'thin',color:'#A6A6A6'}};
detail.getRange('A16:D16').format={fill:'#DDEBF7',font:{name:'微软雅黑',size:12,bold:true},horizontalAlignment:'center',verticalAlignment:'center',borders:{preset:'all',style:'thin',color:'#A6A6A6'}};
detail.getRange('A9').format.font={name:'微软雅黑',size:12,color:'#ED7D31'};
detail.getRange('B2:D16').format.numberFormat='0.00';
detail.getRange('A:A').format.columnWidth=17; detail.getRange('B:D').format.columnWidth=20; detail.getRange('1:16').format.rowHeight=27;
detail.freezePanes.freezeRows(1);

raw.getRange('A77:H78').clear({applyTo:'all'});
raw.getRange('A77:H77').merge(); raw.getRange('A77:H77').values=[['口径补充：第三模块及“时长每日明细”均来自趋势分析→基本趋势；人均启动次数=三端启动次数合计÷三端活跃用户合计；人均时长按活跃用户加权，次均时长按启动次数加权；时长统一换算为秒。']];
raw.getRange('A77:H77').format={fill:'#FFF2CC',font:{name:'微软雅黑',italic:true,color:'#7F6000'},wrapText:true}; raw.getRange('77:77').format.rowHeight=38;

const exported=await SpreadsheetFile.exportXlsx(wb); await exported.save(xlsxPath);
for (const s of ['无限冲浪数据分析','原始数据','时长每日明细']) { const p=await wb.render({sheetName:s,autoCrop:'all',scale:1,format:'png'}); await fs.writeFile(`${outDir}/${s}_趋势版预览.png`,new Uint8Array(await p.arrayBuffer())); }
console.log((await wb.inspect({kind:'formula',sheetId:'无限冲浪数据分析',range:'A18:D23',maxChars:5000,options:{maxResults:50}})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:100},maxChars:5000})).ndjson);
