import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {readExternalHistory} from './external-history.mjs';
import {buildAcquisitionWorkbook} from './hero-acquisition.mjs';
import {buildConversionWorkbook} from './hero-conversion-history.mjs';
import {saveReportWorkbook} from './report-workbook.mjs';

export async function exportHeroHistory(archiveDirectory,outputDirectory,deps) {
  const settings=JSON.parse(await fs.readFile(path.join(archiveDirectory,'report-settings.json'),'utf8'));
  const acquisition=readExternalHistory(path.join(archiveDirectory,'hourly-snapshots.sqlite'));
  const conversion=readExternalHistory(path.join(archiveDirectory,'conversion-snapshots.sqlite'));
  const conversionKeys=new Set(conversion.map(row=>row.date+' '+row.time));
  // An export during a run shows the last complete pair of source snapshots.
  const paid=acquisition.filter(row=>row.date>=settings.startDate && conversionKeys.has(row.date+' '+row.time));
  const keys=new Set(paid.map(row=>row.date+' '+row.time));
  const front=conversion.filter(row=>keys.has(row.date+' '+row.time));
  if(!paid.length) throw new Error('暂无完整的双表小时记录');
  const result=await buildAcquisitionWorkbook(paid,deps,{...settings,history:true,renderImage:false});
  await buildConversionWorkbook(front,deps,{workbook:result.workbook,history:true,renderImage:false});
  for(const sheet of ['买量小时报','前期转化']) result.workbook.worksheets.getItem(sheet).getRange('A1').values=[['英雄就是我｜'+sheet+'历史记录副本']];
  result.workbook.recalculate();
  const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/\D/g,'');
  const output=path.resolve(outputDirectory,'英雄就是我_历史分时副本_'+stamp+'_'+randomUUID().slice(0,8)+'.xlsx');
  await saveReportWorkbook(result.workbook,output,deps);
  return {output,rows:paid.length,sheets:['买量小时报','前期转化'],first:paid[0].date+' '+paid[0].time,last:paid.at(-1).date+' '+paid.at(-1).time};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const deps=process.env.GRAVITY_NODE_MODULES ?? path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  try {console.log(JSON.stringify(await exportHeroHistory(process.argv[2],process.argv[3],deps)));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
