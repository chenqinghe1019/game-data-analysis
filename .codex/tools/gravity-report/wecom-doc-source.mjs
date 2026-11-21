// Reuse the exact production row values. Read-only; no workbook exports or pushes.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {readExternalHistory} from './external-history.mjs';
import {externalRowValues,externalTotals} from './external-hourly.mjs';

export function readDocSource(archive) {
  const rows=readExternalHistory(archive);
  const totals=externalTotals(rows,rows.find(row=>row.baseline));
  return {schemaVersion:1,rows:rows.map(row=>({date:row.date,time:row.time,values:externalRowValues(row,totals.get(row))}))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {await fs.writeFile(process.argv[3],JSON.stringify(readDocSource(process.argv[2])));console.log('正式小时报存档已只读导出');}
  catch(error){console.error('文档同步源读取失败：'+error.message);process.exitCode=1;}
}
