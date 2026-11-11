import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {configPath} from './config.mjs';

const file = path.join(path.dirname(configPath),'gravity-login.dpapi');

export function protect(value, decrypt = false) {
  const method = decrypt ? 'Unprotect' : 'Protect';
  const command = "$ErrorActionPreference='Stop'; " +
    '$data=[Convert]::FromBase64String([Console]::In.ReadToEnd()); ' +
    '$result=[Security.Cryptography.ProtectedData]::'+method+'($data,$null,' +
    '[Security.Cryptography.DataProtectionScope]::CurrentUser); ' +
    '[Console]::Write([Convert]::ToBase64String($result))';
  return new Promise((resolve,reject)=>{
    const failure = () => reject(new Error('无法使用当前 Windows 用户处理本机凭据'));
    const child = spawn('pwsh.exe',['-NoProfile','-NonInteractive','-Command',command],
      {windowsHide:true,stdio:['pipe','pipe','ignore'],timeout:10_000});
    let result = '';
    child.stdout.setEncoding('ascii').on('data',chunk=>{result+=chunk;});
    child.stdin.on('error',failure);
    child.once('error',failure);
    child.once('close',code=>code === 0 && result ? resolve(Buffer.from(result,'base64')) : failure());
    child.stdin.end(value.toString('base64'));
  });
}

export async function saveLogin(email,password) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 ||
      typeof password !== 'string' || !password.length || password.length>1024) {
    throw new Error('请填写有效的引力登录邮箱和密码');
  }
  const encrypted = await protect(Buffer.from(JSON.stringify({email,password})));
  await fs.mkdir(path.dirname(file),{recursive:true});
  const pending = file+'.tmp';
  try {
    await fs.writeFile(pending,encrypted);
    await fs.rename(pending,file);
  } finally { await fs.rm(pending,{force:true}); }
}

export async function readLogin() {
  const {GRAVITY_EMAIL:email,GRAVITY_PASSWORD:password}=process.env;
  if (email || password) {
    if (!email || !password) throw new Error('引力登录环境变量需要同时设置邮箱和密码');
    return {email,password};
  }
  const encrypted = await fs.readFile(file).catch(error=>{
    if (error.code==='ENOENT') return null;
    throw error;
  });
  return encrypted ? JSON.parse((await protect(encrypted,true)).toString('utf8')) : null;
}

export async function loginStatus() {
  if (process.env.GRAVITY_EMAIL && process.env.GRAVITY_PASSWORD) return {configured:true,source:'environment'};
  const configured = await fs.stat(file).then(()=>true,error=>{
    if (error.code==='ENOENT') return false;
    throw error;
  });
  return {configured,source:'local'};
}

export async function clearLogin() {
  await fs.rm(file,{force:true});
}
