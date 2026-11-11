import fs from 'node:fs/promises';
import path from 'node:path';

export const defaults = JSON.parse(await fs.readFile(new URL('./defaults.json', import.meta.url), 'utf8'));
defaults.schedule = {enabled:false,hours:[2]};
defaults.report.browserMode = 'existing';
defaults.project = normalizeProject(defaults.project);
export const configPath = process.env.GRAVITY_REPORT_CONFIG ??
  path.join(process.env.LOCALAPPDATA, 'GravityWeComReport', 'config.json');
export const discoveryPath = configPath+'.projects.json';

function normalizeProject(project) {
  if (project.groups !== undefined || !Array.isArray(project.miniGames) || !Array.isArray(project.apps)) return project;
  const groups = project.miniGames.map(item => ({name:item.name,showProjects:false,projects:[item]}));
  if (project.apps.length) groups.push({name:'APP',showProjects:true,
    projects:project.apps});
  return {name:project.name,groups};
}

export function validateConfig(config) {
  const {report, project:rawProject} = config ?? {};
  const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
  if (!report || !rawProject || typeof report.url !== 'string') throw new Error('缺少报表或项目配置');
  const project = normalizeProject(rawProject);
  const url = URL.parse(report.url);
  if (!url || url.origin !== 'https://web.gravity-engine.com' || url.username || url.password ||
      !/^#\/pivotReport\/shared\?id=\d+&category=adreport$/.test(url.hash)) {
    throw new Error('请填写引力引擎投放报表的分享链接');
  }
  if (![report.title,report.product,project.name].every(validText)) throw new Error('请填写报表标题、产品筛选和项目名称');
  if (!Number.isInteger(report.timeoutSeconds) || report.timeoutSeconds < 10 || report.timeoutSeconds > 600 ||
      !Number.isInteger(report.retries) || report.retries < 0 || report.retries > 3) {
    throw new Error('查询超时须为 10–600 秒，重试次数须为 0–3 次');
  }
  const fields = Object.keys(defaults.report.fields);
  if (!fields.every(key => validText(report.fields?.[key])) ||
      new Set(fields.map(key => report.fields[key])).size !== fields.length) throw new Error('请填写七个不同的指标列名');
  if (!Array.isArray(project.groups) || !project.groups.length || project.groups.some(group=>
      !validText(group?.name) || group.name === '全盘' ||
      !Array.isArray(group.projects)) ||
      new Set(project.groups.map(group=>group.name)).size !== project.groups.length) {
    throw new Error('请填写不重复的分组名称');
  }
  const entries = project.groups.flatMap(group=>group.projects);
  if (entries.some(item => !validText(item?.name) || typeof item.id !== 'string' || !/^\d+$/.test(item.id)) ||
      new Set(entries.map(item => item.id)).size !== entries.length) throw new Error('请填写项目名称和不重复的数字 APPID');
  const schedule = config.schedule === undefined ? defaults.schedule : config.schedule;
  if (typeof schedule?.enabled !== 'boolean' || !Array.isArray(schedule.hours) ||
      schedule.hours.some(hour => !Number.isInteger(hour) || hour < 0 || hour > 23) ||
      new Set(schedule.hours).size !== schedule.hours.length ||
      (schedule.enabled && !schedule.hours.length)) throw new Error('请为小时发送选择有效的北京时间小时');
  const {url:reportUrl,title,product,timeoutSeconds,retries,browserMode='existing'} = report;
  if (!['existing','dedicated'].includes(browserMode)) throw new Error('浏览器模式无效');
  return {...config,report:{url:reportUrl,title,product,timeoutSeconds,retries,browserMode,fields:report.fields},
    project:{name:project.name,groups:project.groups.map(group=>({name:group.name,
      projects:group.projects.map(({name,id})=>({name,id})),
    }))},schedule};
}

export async function loadConfig() {
  try {
    return validateConfig(JSON.parse(await fs.readFile(configPath,'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT' && !process.env.GRAVITY_REPORT_CONFIG) return defaults;
    throw error;
  }
}
