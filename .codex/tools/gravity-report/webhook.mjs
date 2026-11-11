import fs from 'node:fs/promises';
import path from 'node:path';
import {configPath} from './config.mjs';
import {protect} from './login.mjs';

const file = path.join(path.dirname(configPath),'wecom-webhook.dpapi');

export function webhookUrl(value) {
  const target = typeof value === 'string' && value.length <= 2048 ? URL.parse(value.trim()) : null;
  if (!target || target.origin !== 'https://qyapi.weixin.qq.com' || target.username || target.password ||
      target.pathname !== '/cgi-bin/webhook/send' || !target.searchParams.get('key') || target.hash) {
    throw new Error('请填写有效的企微群机器人 Webhook 地址');
  }
  return target;
}

export async function webhookStatus() {
  if (process.env.GRAVITY_WECOM_WEBHOOK) return {configured:true,source:'environment'};
  const configured = await fs.stat(file).then(()=>true,error=>{
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  return {configured,source:'local'};
}

export async function readWebhook() {
  if (process.env.GRAVITY_WECOM_WEBHOOK) return webhookUrl(process.env.GRAVITY_WECOM_WEBHOOK).href;
  const encrypted = await fs.readFile(file).catch(error=>{
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return encrypted ? webhookUrl((await protect(encrypted,true)).toString('utf8')).href : null;
}

export async function saveWebhook(value) {
  if (process.env.GRAVITY_WECOM_WEBHOOK) throw new Error('企微 Webhook 已由启动环境提供');
  if (value === null) return fs.rm(file,{force:true});
  const encrypted = await protect(Buffer.from(webhookUrl(value).href));
  await fs.mkdir(path.dirname(file),{recursive:true});
  const pending = file+'.'+process.pid+'.tmp';
  try {
    await fs.writeFile(pending,encrypted);
    await fs.rename(pending,file);
  } finally { await fs.rm(pending,{force:true}); }
}
