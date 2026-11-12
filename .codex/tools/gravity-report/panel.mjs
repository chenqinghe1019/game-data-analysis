import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {appendFile, readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {configPath,discoveryPath,loadConfig,validateConfig} from './config.mjs';
import {clearLogin,loginStatus,saveLogin} from './login.mjs';
import {readWebhook,saveWebhook,webhookStatus} from './webhook.mjs';

const host = '127.0.0.1';
const port = Number(process.env.GRAVITY_PANEL_PORT ?? 8731);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('后台端口无效');
const origin = 'http://' + host + ':' + port;
const page = await readFile(new URL('./panel.html', import.meta.url));
const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../../../outputs/gravity-wecom/', import.meta.url));
const logDirectory = path.join(path.dirname(configPath),'logs');
let job = {state:'idle',log:''};
let saving = false;
let scheduling = false;

async function logEvent(event, details = {}) {
  const time = new Date();
  const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(time);
  try {
    await mkdir(logDirectory,{recursive:true});
    await appendFile(path.join(logDirectory,day+'.jsonl'),JSON.stringify({time:time.toISOString(),event,...details})+'\n');
  } catch (error) {
    console.error('无法写入播报日志：'+error.message);
  }
}

function startJob(webhook, slot = null) {
  const push = Boolean(webhook);
  job = {state:'running',log:'',startedAt:new Date().toISOString(),push,slot};
  const env = {...process.env};
  if (push) env.GRAVITY_WECOM_WEBHOOK = webhook;
  else delete env.GRAVITY_WECOM_WEBHOOK;
  if (slot) env.GRAVITY_REPORT_SLOT = slot;
  else delete env.GRAVITY_REPORT_SLOT;
  const output = path.join(outputDirectory,Date.now()+'.xlsx');
  const child = spawn(process.execPath,[runner,output],{env,windowsHide:true,timeout:20*60*1000});
  void logEvent('job-started',{slot,push,startedAt:job.startedAt});
  const append = message => { job.log = (job.log+message).slice(-10000); };
  for (const stream of [child.stdout,child.stderr]) stream.setEncoding('utf8').on('data',append);
  child.once('error',error => append('无法启动脚本：'+error.message));
  child.once('close',(code,signal) => {
    job.state = code === 0 ? 'success' : 'failed';
    job.finishedAt = new Date().toISOString();
    if (code === 0) job.output = output;
    if (signal) append('播报进程已终止（'+signal+'）');
    void logEvent('job-finished',{...job,code,signal,log:job.log.replace(/https?:\/\/[^\s"'<>]+/g,'[URL]')});
  });
}

async function checkSchedule() {
  const beijing = new Date(Date.now()+8*60*60*1000);
  if (saving || scheduling || job.state === 'running' || beijing.getUTCMinutes() >= 5) return;
  scheduling = true;
  try {
    const {schedule} = await loadConfig();
    if (!schedule.enabled || !schedule.hours.includes(beijing.getUTCHours())) return;
    const webhook = await readWebhook();
    if (!webhook) return;
    const slot = beijing.toISOString().slice(0,13);
    const directory = path.join(path.dirname(configPath),'sent-slots');
    await mkdir(directory,{recursive:true});
    // Claim before launching. A restart or an uncertain send must not resend a slot.
    await writeFile(path.join(directory,slot),'started\n',{flag:'wx'});
    startJob(webhook,slot);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('小时发送调度失败：'+error.message);
      void logEvent('schedule-error',{message:error.message.replace(/https?:\/\/[^\s"'<>]+/g,'[URL]')});
    }
  } finally { scheduling = false; }
}

function json(response, status, body) {
  response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  response.end(JSON.stringify(body));
}

async function bodyOf(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('配置请求超过大小限制');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (request,response) => {
  try {
    if (request.headers.host !== host+':'+port) return json(response,403,{error:'请使用本机后台地址'});
    const route = request.method + ' ' + request.url;
    if (route === 'GET /') {
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'});
      return response.end(page);
    }
    if (route === 'GET /api/config') return json(response,200,await loadConfig());
    if (route === 'GET /api/projects') {
      const {report} = await loadConfig();
      try {
        const catalog = JSON.parse(await readFile(discoveryPath,'utf8'));
        if (catalog.reportUrl === report.url && catalog.product === report.product) {
          return json(response,200,{date:catalog.date,projects:catalog.projects});
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      return json(response,200,{date:null,projects:[]});
    }
    if (route === 'GET /api/job') return json(response,200,{...job,canPush:(await webhookStatus()).configured});
    if (route === 'GET /api/login') return json(response,200,await loginStatus());
    if (route === 'GET /api/webhook') return json(response,200,await webhookStatus());
    if (request.headers.origin !== origin || !request.headers['content-type']?.startsWith('application/json')) {
      return json(response,403,{error:'请求必须来自本机后台页面'});
    }
    if (route === 'PUT /api/webhook') {
      const settings = await bodyOf(request);
      if (saving || scheduling || job.state === 'running') return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        await saveWebhook(settings === null ? null : settings.url);
        return json(response,200,await webhookStatus());
      } finally { saving = false; }
    }
    if (route === 'PUT /api/login') {
      const login = await bodyOf(request);
      if (saving || scheduling || job.state === 'running') return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        if (login === null) await clearLogin();
        else await saveLogin(login.email,login.password);
        return json(response,200,await loginStatus());
      } finally { saving = false; }
    }
    if (route === 'PUT /api/config') {
      const config = validateConfig(await bodyOf(request));
      if (saving || scheduling || job.state === 'running') return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        if (config.schedule.enabled && !(await webhookStatus()).configured && !(await loadConfig()).schedule.enabled) {
          return json(response,400,{error:'请先在后台保存企微 Webhook'});
        }
        await mkdir(path.dirname(configPath),{recursive:true});
        const pending = configPath+'.'+process.pid+'.tmp';
        await writeFile(pending,JSON.stringify(config,null,2)+'\n','utf8');
        await rename(pending,configPath);
      } finally { saving = false; }
      return json(response,200,config);
    }
    if (route === 'POST /api/run') {
      const {push} = await bodyOf(request);
      if (typeof push !== 'boolean') return json(response,400,{error:'请指定运行模式'});
      if (saving || scheduling || job.state === 'running') return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        const webhook = push ? await readWebhook() : null;
        if (push && !webhook) return json(response,400,{error:'请先在后台保存企微 Webhook'});
        startJob(webhook);
        return json(response,202,job);
      } finally { saving = false; }
    }
    return json(response,404,{error:'页面不存在'});
  } catch (error) {
    return json(response,400,{error:error.message});
  }
});
server.listen(port,host,() => {
  console.log('引力引擎播报后台 '+origin);
  void logEvent('panel-started',{port,pid:process.pid});
  checkSchedule();
  setInterval(checkSchedule,10_000).unref();
});
