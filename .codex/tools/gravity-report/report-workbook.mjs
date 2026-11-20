import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

export async function saveReportWorkbook(workbook,output,deps) {
  const require=createRequire(path.join(deps,'package.json'));
  const {SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  await fs.mkdir(path.dirname(output),{recursive:true});
  const pending=output+'.'+randomUUID()+'.xlsx';
  try {await (await SpreadsheetFile.exportXlsx(workbook)).save(pending);await fs.rename(pending,output);}
  catch(error) {
    if(['EPERM','EBUSY','EACCES'].includes(error.code)) throw new Error('无法更新累计Excel，请关闭正式底档；查看时请使用历史记录副本。',{cause:error});
    throw error;
  } finally {await fs.rm(pending,{force:true});await fs.rm(pending+'.inspect.ndjson',{force:true});}
}
