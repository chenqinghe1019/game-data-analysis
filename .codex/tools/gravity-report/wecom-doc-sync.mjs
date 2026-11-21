// Optional post-delivery worker. A document error never fails or resends the broadcast.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function docSyncHour(time) {
  return /^(?:1[1-9]|2[0-4]):00$/.test(time);
}

export async function queueExternalDocSync(configFile,date,time) {
  if(!docSyncHour(time)) return;
  const file=path.join(path.dirname(configFile),'wecom-doc-sync.json');
  let log;
  try {
    const settings=await fs.readFile(file,'utf8').then(JSON.parse,error=>{if(error.code==='ENOENT') return null;throw error;});
    if(!settings?.enabled) return;
    const directory=path.join(path.dirname(file),'wecom-doc-sync');
    await fs.mkdir(directory,{recursive:true});
    await fs.writeFile(path.join(directory,'request.json'),JSON.stringify({date,time,requestedAt:new Date().toISOString()}));
    const python=process.env.BEITE_PYTHON ?? path.join(process.env.LOCALAPPDATA,'Python/pythoncore-3.14-64/python.exe');
    await fs.access(python);
    log=await fs.open(path.join(directory,'worker.log'),'a');
    const env={...process.env};
    delete env.GRAVITY_WECOM_WEBHOOK;
    const child=spawn(python,['-X','utf8',fileURLToPath(new URL('./wecom-doc-sync.py',import.meta.url)),
      '--config',file,'--apply'],{env,windowsHide:true,detached:true,stdio:['ignore',log.fd,log.fd]});
    await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
    child.unref();
    console.log('企业文档补缺已排队，按11点起规则独立执行');
  } catch(error) {
    // Never expose command arguments, URLs or credentials in the report log.
    console.warn('企业文档后置任务未启动，已完成的企微播报不受影响（'+(error.code ?? '配置或启动错误')+'）');
  } finally {await log?.close().catch(()=>{});}
}
