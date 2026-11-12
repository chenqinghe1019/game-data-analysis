import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {appendFile, readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {configPath,loadConfig,validateConfig} from './config.mjs';
import {clearLogin,loginStatus,saveLogin} from './login.mjs';
import {readWebhook,saveWebhook,webhookStatus} from './webhook.mjs';
import {gameProjects,gravityProject,projectScript} from './game-projects.mjs';

const host = '127.0.0.1';
const port = Number(process.env.GRAVITY_PANEL_PORT ?? 8731);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('后台端口无效');
const origin = 'http://' + host + ':' + port;
const page = await readFile(new URL('./panel.html', import.meta.url));
const projectsPage = await readFile(new URL('./game-projects.html', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../../../outputs/gravity-wecom/', import.meta.url));
const logDirectory = path.join(path.dirname(configPath),'logs');
const jobs = new Map();
const isRunning = () => [...jobs.values()].some(job=>job.state === 'running');
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

function startJob(project, webhook, slot = null) {
  const push = Boolean(webhook);
  const job = {state:'running',log:'',startedAt:new Date().toISOString(),push,slot};
  jobs.set(project.id,job);
  const env = {...process.env,GRAVITY_REPORT_CONFIG:project.config,GRAVITY_LOGIN_CONFIG:configPath};
  if (push) env.GRAVITY_WECOM_WEBHOOK = webhook;
  else delete env.GRAVITY_WECOM_WEBHOOK;
  if (slot) env.GRAVITY_REPORT_SLOT = slot;
  else delete env.GRAVITY_REPORT_SLOT;
  const directory = project === gravityProject ? outputDirectory : path.join(outputDirectory,project.id);
  const output = path.join(directory,Date.now()+'.xlsx');
  const child = spawn(process.execPath,[projectScript(project).entry,output],{env,windowsHide:true,timeout:20*60*1000});
  void logEvent('job-started',{project:project.id,slot,push,startedAt:job.startedAt});
  const append = message => { job.log = (job.log+message).slice(-10000); };
  for (const stream of [child.stdout,child.stderr]) stream.setEncoding('utf8').on('data',append);
  child.once('error',error => append('无法启动脚本：'+error.message));
  child.once('close',(code,signal) => {
    job.state = code === 0 ? 'success' : 'failed';
    job.finishedAt = new Date().toISOString();
    if (code === 0) job.output = output;
    if (signal) append('播报进程已终止（'+signal+'）');
    void logEvent('job-finished',{project:project.id,...job,code,signal,log:job.log.replace(/https?:\/\/[^\s"'<>]+/g,'[URL]')});
  });
}

async function checkSchedule() {
  const beijing = new Date(Date.now()+8*60*60*1000);
  if (saving || scheduling || isRunning() || beijing.getUTCMinutes() >= 5) return;
  scheduling = true;
  try {
    const slot = beijing.toISOString().slice(0,13);
    for (const project of gameProjects) {
      try {
        const {schedule} = await loadConfig(project.config,project.id);
        if (!schedule.enabled || !schedule.hours.includes(beijing.getUTCHours())) continue;
        const webhook = await readWebhook(project.config);
        if (!webhook) continue;
        const directory = path.join(path.dirname(project.config),'sent-slots');
        await mkdir(directory,{recursive:true});
        // Claim before launching so a restart cannot send the same project and slot twice.
        await writeFile(path.join(directory,slot),'started\n',{flag:'wx'});
        startJob(project,webhook,slot);
        return;
      } catch (error) {
        if (error.code === 'EEXIST') continue;
        console.error('小时发送调度失败：'+error.message);
        void logEvent('schedule-error',{project:project.id,message:error.message.replace(/https?:\/\/[^\s"'<>]+/g,'[URL]')});
      }
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
    const project = gameProjects.find(item=>item !== gravityProject &&
      (request.url === item.settings || request.url.startsWith(item.settings+'/'))) ?? gravityProject;
    const routePath = project === gravityProject ? request.url : request.url.slice(project.settings.length) || '/';
    const route = request.method + ' ' + routePath;
    if (route === 'GET /' || (project === gravityProject && route === 'GET /projects')) {
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'});
      return response.end(route === 'GET /' ? page : projectsPage);
    }
    if (project === gravityProject && route === 'GET /api/game-projects') {
      return json(response,200,await Promise.all(gameProjects.map(async item=>{
        const config = await loadConfig(item.config,item.id);
        return {id:item.id,name:config.project.name || item.name || '引力投放项目',
          script:projectScript(item).name,settings:item.settings,
          configured:Boolean(config.report.url),scheduleEnabled:config.schedule.enabled};
      })));
    }
    if (route === 'GET /api/config') return json(response,200,await loadConfig(project.config,project.id));
    if (route === 'GET /api/projects') {
      const {report} = await loadConfig(project.config,project.id);
      try {
        const catalog = JSON.parse(await readFile(project.config+'.projects.json','utf8'));
        if (catalog.reportUrl === report.url && catalog.product === report.product) {
          return json(response,200,{date:catalog.date,projects:catalog.projects});
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      return json(response,200,{date:null,projects:[]});
    }
    if (route === 'GET /api/job') return json(response,200,{
      ...(jobs.get(project.id) ?? {state:'idle',log:''}),busy:isRunning(),
      canPush:(await webhookStatus(project.config)).configured,
    });
    if (route === 'GET /api/login') return json(response,200,await loginStatus());
    if (route === 'GET /api/webhook') return json(response,200,await webhookStatus(project.config));
    if (request.headers.origin !== origin || !request.headers['content-type']?.startsWith('application/json')) {
      return json(response,403,{error:'请求必须来自本机后台页面'});
    }
    if (route === 'PUT /api/webhook') {
      const settings = await bodyOf(request);
      if (saving || scheduling || isRunning()) return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        await saveWebhook(settings === null ? null : settings.url,project.config);
        return json(response,200,await webhookStatus(project.config));
      } finally { saving = false; }
    }
    if (route === 'PUT /api/login') {
      const login = await bodyOf(request);
      if (saving || scheduling || isRunning()) return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        if (login === null) await clearLogin();
        else await saveLogin(login.email,login.password);
        return json(response,200,await loginStatus());
      } finally { saving = false; }
    }
    if (route === 'PUT /api/config') {
      const config = validateConfig(await bodyOf(request),project.id);
      if (saving || scheduling || isRunning()) return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        if (config.schedule.enabled && !(await webhookStatus(project.config)).configured &&
            !(await loadConfig(project.config,project.id)).schedule.enabled) {
          return json(response,400,{error:'请先在后台保存企微 Webhook'});
        }
        await mkdir(path.dirname(project.config),{recursive:true});
        const pending = project.config+'.'+process.pid+'.tmp';
        await writeFile(pending,JSON.stringify(config,null,2)+'\n','utf8');
        await rename(pending,project.config);
      } finally { saving = false; }
      return json(response,200,config);
    }
    if (route === 'POST /api/run') {
      const {push} = await bodyOf(request);
      if (typeof push !== 'boolean') return json(response,400,{error:'请指定运行模式'});
      if (saving || scheduling || isRunning()) return json(response,409,{error:'请等待当前操作完成'});
      saving = true;
      try {
        const config = await loadConfig(project.config,project.id);
        if (!config.report.url) return json(response,400,{error:'请先保存该项目的报表配置'});
        const webhook = push ? await readWebhook(project.config) : null;
        if (push && !webhook) return json(response,400,{error:'请先在后台保存企微 Webhook'});
        startJob(project,webhook);
        return json(response,202,jobs.get(project.id));
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
