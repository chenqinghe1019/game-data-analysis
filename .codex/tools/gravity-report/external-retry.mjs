import {randomUUID} from 'node:crypto';
import {readFile, rename, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const externalAttemptTimeout = 5*60_000;
const retryDelay = [45_000,90_000];

async function readOptional(file) {
  try { return await readFile(file,'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function replace(file,contents) {
  const pending=file+'.'+randomUUID()+'.tmp';
  try {
    await writeFile(pending,contents,{flag:'wx'});
    await rename(pending,file);
  } finally {
    await unlink(pending).catch(error=>{if (error.code !== 'ENOENT') throw error;});
  }
}

export function externalDelivery(directory,slot) {
  const marker=type=>path.join(directory,slot+'.'+type);
  return {
    status:type=>readOptional(marker(type)),
    begin:type=>writeFile(marker(type),'sending',{flag:'wx'}),
    sent:type=>replace(marker(type),'sent'),
    rejected:type=>unlink(marker(type)),
  };
}

export async function claimExternalAttempt(directory,slot,now=Date.now()) {
  const delivery=externalDelivery(directory,slot);
  const [image,title]=await Promise.all([delivery.status('image'),delivery.status('text')]);
  // A request with no confirmed answer might already have arrived.
  if ((image !== undefined && image !== 'sent') || title !== undefined) return null;
  const primary=path.join(directory,slot);
  for (let attempt=1;attempt<=retryDelay.length+1;attempt++) {
    const file=attempt === 1 ? primary : primary+'.retry-'+attempt;
    const existing=await readOptional(file);
    if (existing === undefined) {
      try {
        await writeFile(file,JSON.stringify({state:'running',startedAt:now}),{flag:'wx'});
      } catch (error) {
        if (error.code === 'EEXIST') return null;
        throw error;
      }
      return {attempt,finish:(success,finishedAt=Date.now())=>replace(file,
        JSON.stringify({state:success ? 'success' : 'failed',startedAt:now,finishedAt}))};
    }
    let record;
    // Older slots were claimed with plain text and have no delivery record.
    try { record=JSON.parse(existing); } catch { return null; }
    if (record?.state === 'success') return null;
    if (record?.state === 'failed' && now-record.finishedAt>=retryDelay[attempt-1]) continue;
    if (record?.state === 'running' && now-record.startedAt>=externalAttemptTimeout+30_000) continue;
    return null;
  }
  return null;
}
