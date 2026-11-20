import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {buildExternalWorkbook,externalTotals} from './external-hourly.mjs';

// A short read-only query releases the archive before any workbook work starts.
// Never call updateExternalHourly: exports must not append, refresh, or prune data.
export function readExternalHistory(archive) {
  const db=new DatabaseSync(archive,{readOnly:true});
  try {
    db.exec('PRAGMA busy_timeout=1000');
    return db.prepare('SELECT date,time,payload FROM snapshots ORDER BY date,time').all().map(row=>{
      const snapshot=JSON.parse(row.payload);
      if (snapshot.date!==row.date || snapshot.time!==row.time) throw new Error('历史记录日期或时点校验失败');
      return snapshot;
    });
  } finally { db.close(); }
}

export async function exportExternalHistory(archive,directory,deps) {
  let rows;
  try { rows=readExternalHistory(archive); }
  catch (error) {
    if (error.code==='ERR_SQLITE_ERROR' && /unable to open/.test(error.message)) throw new Error('暂无历史记录，请先完成一次正式播报');
    throw error;
  }
  if (!rows.length) throw new Error('暂无历史记录，请先完成一次正式播报');
  const require=createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  const latest=rows.at(-1);
  const workbook=buildExternalWorkbook(Workbook,rows,latest,externalTotals(rows,rows.find(row=>row.baseline)));
  const sheet=workbook.worksheets.getItem('外部小时报');
  sheet.getRange('A1').values=[[(latest.projectName || '联合小时报')+'｜历史分时记录（查看副本）']];
  sheet.freezePanes.freezeRows(4);
  workbook.recalculate();
  await fs.mkdir(directory,{recursive:true});
  const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/[^0-9]/g,'');
  const output=path.resolve(directory,'联合小时报_历史分时副本_'+stamp+'_'+randomUUID().slice(0,8)+'.xlsx');
  try { await (await SpreadsheetFile.exportXlsx(workbook)).save(output); }
  catch (error) { await fs.rm(output,{force:true}); throw error; }
  finally { await fs.rm(output+'.inspect.ndjson',{force:true}); }
  return {output,rows:rows.length,first:rows[0].date+' '+rows[0].time,last:latest.date+' '+latest.time};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const deps=process.env.GRAVITY_NODE_MODULES ?? path.join(process.env.USERPROFILE,
    '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  try { console.log(JSON.stringify(await exportExternalHistory(process.argv[2],process.argv[3],deps))); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
