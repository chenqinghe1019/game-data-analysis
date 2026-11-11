import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { defaults, discoveryPath, loadConfig } from './config.mjs';
import { readLogin } from './login.mjs';

const root = '.el-table-v2__root';
const timeout = 120_000;
const day = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date());

async function waitForReportTotals(page, trigger, timeout) {
  const [response] = await Promise.all([
    page.waitForResponse(result =>
      new URL(result.url()).pathname === '/report/api/v3/adreport/custom_get/calc_total/' &&
      result.request().method() === 'POST', {timeout}),
    trigger(),
  ]);
  if (!response.ok() || await response.finished()) throw new Error('引力报表汇总查询失败');
  // Let the page apply the response to the virtual table before copying its cells.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openReport(page, {url:reportUrl,title,timeoutSeconds,browserMode}) {
  await page.goto(reportUrl, {waitUntil:'domcontentloaded',timeout:timeoutSeconds*1000});
  const report = page.getByText(title, {exact:true});
  const login = page.getByRole('button', {name:'登录', exact:true});
  await report.or(login).first().waitFor({timeout:timeoutSeconds*1000});
  if (await login.isVisible()) {
    const credentials = await readLogin();
    if (credentials) {
      const target = new URL(page.url());
      if (target.origin !== new URL(reportUrl).origin || !target.hash.startsWith('#/login')) {
        throw new Error('登录页地址校验失败');
      }
      try {
        await page.locator('input:visible:not([type=password]):not([type=checkbox])').fill(credentials.email);
        await page.locator('input[type=password]:visible').fill(credentials.password);
        await page.getByRole('checkbox', {name:'我已阅读并同意'}).check();
        await login.click();
        await report.waitFor({timeout:timeoutSeconds*1000});
      } catch {
        throw new Error('引力自动登录未完成，请检查账号密码或在浏览器中完成验证');
      }
    } else {
      if (browserMode === 'existing') throw new Error('当前 Chrome 尚未登录引力引擎，请先登录或配置引力账号密码');
      console.log('请在打开的 Chrome 窗口登录引力引擎，建议勾选七天自动登录。等待最多 5 分钟。');
      await report.waitFor({timeout:300_000});
    }
  }
  const actual = new URL(page.url());
  if (actual.origin + actual.hash !== new URL(reportUrl).origin + new URL(reportUrl).hash) {
    throw new Error('登录后未进入指定分享报表');
  }
}

export async function refreshReport(page, expectedDay, wait = timeout, product = defaults.report.product) {
  const deadline = Date.now() + wait;
  const remaining = () => Math.max(1, deadline - Date.now());
  const refresh = page.getByRole('button', {name:'刷新数据', exact:true});
  const ready = () => page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll('button'))
      .find(item => item.innerText.includes('刷新数据'));
    return button && !button.disabled &&
      !document.querySelector('.el-table-v2__root')?.innerText.includes('计算中，请稍候');
  }, null, {timeout:remaining()});
  const dateFilter = page.getByRole('button', {name:new RegExp('^今日\\|' + expectedDay + '至' + expectedDay + '$')});
  const productFilter = page.getByText(product, {exact:true});
  await dateFilter.waitFor({timeout:remaining()});
  await productFilter.waitFor({timeout:remaining()});
  await ready();
  // Trigger the exact button without pointer scrolling, and observe that same button.
  await waitForReportTotals(page, () => refresh.evaluate(button => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true' || !button.getClientRects().length) {
      throw new Error('刷新按钮当前不可用');
    }
    document.documentElement.removeAttribute('data-gravity-refresh-started');
    const observer = new MutationObserver(changes => {
      if (button.disabled || changes.some(change => change.oldValue !== null)) {
        document.documentElement.setAttribute('data-gravity-refresh-started', 'true');
        observer.disconnect();
      }
    });
    observer.observe(button, {attributes:true, attributeFilter:['disabled'], attributeOldValue:true});
    button.click();
  }, undefined, {timeout:remaining()}), remaining());
  await page.locator('html[data-gravity-refresh-started=true]').waitFor({state:'attached',timeout:remaining()});
  await ready();
  if (day() !== expectedDay || !await dateFilter.isVisible() || !await productFilter.isVisible()) {
    throw new Error('查询完成后的日期或产品范围与预期不符');
  }
}

function asNumber(value, field) {
  const cleaned = value?.replace(/^\((?:sum|WtAvg)\)\s*/, '').replace(/,/g,'').trim();
  const pattern = field === 'roi' ? /^-?\d+(?:\.\d+)?%$/ : /^-?\d+(?:\.\d+)?$/;
  if (!cleaned || !pattern.test(cleaned)) throw new Error('指标格式无效：' + field);
  return Number(cleaned.replace('%','')) / (field === 'roi' ? 100 : 1);
}

async function readGrid(page, fields) {
  const raw = await page.locator(root).evaluate(grid => {
    const select = (node, selector) => Array.from(node.querySelectorAll(selector));
    const cells = row => select(row, '.report-v2-cell--metric').map(cell => cell.innerText);
    const main = grid.querySelector('.el-table-v2__main');
    const left = grid.querySelector('.el-table-v2__left');
    const total = main.querySelector('.el-table-v2__fixed-header-row');
    const rows = scope => select(scope, '.el-table-v2__row[rowkey]').filter(row => row.getClientRects().length);
    return {
      headers: select(main, '.el-table-v2__dynamic-header-row .el-table-v2__header-cell').map(cell => cell.innerText.trim()),
      total: total ? cells(total) : null,
      metrics: rows(main).map(row => [row.getAttribute('rowkey'), cells(row)]),
      labels: rows(left).map(row => ({
        key:row.getAttribute('rowkey'), label:row.innerText.trim(),
        expanded:row.classList.contains('is-expanded'),
      })),
    };
  });
  const pagination = await page.getByText(/^共\s*\d+\s*条$/).innerText();
  const count = Number(pagination.match(/\d+/)[0]);
  if (!count || !raw.total) throw new Error('主表未返回可核验的合计与项目数据');
  if (await page.getByRole('button', {name:'下一页'}).isEnabled()) throw new Error('主表有多页，当前配置无法完整核对');
  const indexes = Object.fromEntries(Object.entries(fields).map(([name,label]) => [name, raw.headers.indexOf(label)]));
  if (Object.values(indexes).includes(-1)) throw new Error('主表指标列已变化');
  function parse(cells) {
    if (cells?.length !== raw.headers.length) throw new Error('项目指标未完整加载');
    return Object.fromEntries(Object.entries(indexes).map(([field,index]) => [field,asNumber(cells[index],field)]));
  }
  const metrics = new Map(raw.metrics);
  if (metrics.size !== raw.metrics.length || metrics.size !== raw.labels.length ||
      new Set(raw.labels.map(item=>item.key)).size !== raw.labels.length ||
      raw.labels.some(item=>!item.key || !item.label || !metrics.has(item.key))) {
    throw new Error('主表标签与指标行无法一一对应');
  }
  const apps = new Map();
  let current;
  for (const item of raw.labels) {
    const projectLabel = item.label.match(/^(.*?)\s*APPID\s*(\d+)\s*$/s);
    if (projectLabel) {
      const [,label,id] = projectLabel;
      if (apps.has(id)) throw new Error('重复 APPID：' + id);
      current = {key:item.key, name:label.trim() || 'APPID '+id, expanded:item.expanded,
        data:parse(metrics.get(item.key)), media:new Map()};
      apps.set(id,current);
    } else {
      if (!current || current.media.has(item.label)) throw new Error('媒体行未能唯一匹配项目');
      current.media.set(item.label,parse(metrics.get(item.key)));
    }
  }
  if (apps.size !== count) throw new Error('主表项目未全部加载，已停止导出');
  return {total:parse(raw.total),apps};
}

async function readAppGroupTotal(page, ids, fields, timeout) {
  await page.getByRole('button', {name:/^表内筛选\/\s*0$/}).click({timeout});
  const dialog = page.getByRole('dialog', {name:'表内筛选'});
  await dialog.getByText('请选择', {exact:true}).first().click({timeout});
  await page.getByRole('option', {name:'产品',exact:true}).click({timeout});
  await dialog.getByText('操作符', {exact:true}).click({timeout});
  await page.getByRole('option', {name:'等于',exact:true}).click({timeout});
  await dialog.getByText('请选择', {exact:true}).click({timeout});
  const picker = page.getByRole('tooltip').filter({
    has:page.getByRole('textbox', {name:'请输入搜索，支持空格分隔'}),
  });
  for (const id of ids) {
    await picker.getByText(new RegExp('\\b'+id+'\\b')).click({timeout});
  }
  await dialog.getByRole('heading').click({timeout});
  await waitForReportTotals(page, () => dialog.getByRole('button', {name:'应用筛选'}).click({timeout}), timeout);
  const filtered = await readGrid(page,fields);
  if (filtered.apps.size !== ids.length || ids.some(id=>!filtered.apps.has(id))) {
    throw new Error('引力 APP 分组合计的筛选范围与配置不一致');
  }
  return filtered.total;
}

export async function collect(page, {report,project} = defaults) {
  const timeout = report.timeoutSeconds * 1000;
  const grid = page.locator(root);
  await grid.waitFor({timeout});
  // Read each project's media independently to keep the virtual table compact.
  const collapse = grid.getByRole('button', {name:'收起当前行',exact:true});
  for (let i=0; i<20 && await collapse.count(); i++) await collapse.first().click();
  if (await collapse.count()) throw new Error('主表存在未收起的行');
  const base = await readGrid(page,report.fields);
  for (const [id,app] of base.apps) {
    if (app.data.spend === 0) continue;
    const row = grid.locator('.el-table-v2__left [rowkey]').filter({hasText:new RegExp('APPID\\s*'+id+'\\b')});
    const expand = row.getByRole('button', {name:'展开当前行',exact:true});
    if (!await expand.count()) throw new Error('APPID '+id+' 有消耗但无法展开媒体明细');
    // The visible row initially contains provisional ratios. Wait for the report's rollup response.
    await waitForReportTotals(page, () => expand.click(), timeout);
    await row.getByRole('button', {name:'收起当前行',exact:true}).waitFor();
    await row.locator('xpath=following-sibling::*[1][contains(@class,"el-table-v2__row-depth-1")]').waitFor({state:'visible',timeout});
    app.media = (await readGrid(page,report.fields)).apps.get(id).media;
    const mediaSpend = [...app.media.values()].reduce((sum,item)=>sum+item.spend,0);
    if (Math.abs(mediaSpend-app.data.spend) > 0.01+0.005*app.media.size) {
      throw new Error('APPID '+id+' 媒体消耗合计 '+mediaSpend.toFixed(4)+
        ' 与项目消耗 '+app.data.spend.toFixed(4)+' 不一致，可能存在漏行');
    }
    await row.getByRole('button', {name:'收起当前行',exact:true}).click();
  }
  const appGroup = project.groups.find(group=>group.name.toUpperCase()==='APP' && group.projects.length>1);
  const appIds = appGroup?.projects.map(({id})=>id).filter(id=>base.apps.has(id)) ?? [];
  if (appIds.length) {
    base.appGroupTotal = await readAppGroupTotal(page,appIds,report.fields,timeout);
  }
  return base;
}

export function outputRows({total,apps,appGroupTotal}, project = defaults.project) {
  const rows = [];
  const add = (group,name,media,metrics) => {
    if (metrics && metrics.spend !== 0) rows.push([group,name,media,metrics.spend,metrics.activationCost,metrics.payCost,metrics.roi]);
  };
  const addProject = (group,name,app) => {
    add(group,name,'合计',app.data);
    for (const [label,metrics] of app.media) add(group,name,label,metrics);
  };
  const assigned = new Set();
  add('全盘','','合计',total);
  for (const {name,projects} of project.groups) {
    if (name.toUpperCase()==='APP' && projects.length>1) add(name,'','合计',appGroupTotal);
    for (const item of projects) {
      const app = apps.get(item.id);
      assigned.add(item.id);
      if (app) addProject(name,item.name,app);
    }
  }
  const groupNames = new Set(project.groups.map(group=>group.name));
  let unassigned = '未分组';
  while (groupNames.has(unassigned)) unassigned += '·';
  for (const [id,app] of apps) {
    if (!assigned.has(id)) addProject(unassigned,app.name+'（'+id+'）',app);
  }
  if (!rows.some(row=>row[3]!==null)) throw new Error('当前没有投放数据可导出');
  return rows;
}

export async function writeWorkbook(rows, date, output, deps, renderImage = false, projectName = defaults.project.name) {
  const require = createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile} = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  const JSZip = require('jszip');
  const wb = Workbook.create();
  const sheet = wb.worksheets.add('投放播报');
  sheet.showGridLines = false;
  const last = 4 + rows.length;
  for (const [row, value] of [[1,projectName+'｜投放播报'],[2,date+' · 北京时间「今日」累计'],
    [last+2,'指标取自引力报表。仅展示有消耗的项目及媒体。']]) {
    sheet.getRange('A'+row+':G'+row).merge();
    sheet.getRange('A'+row).values = [[value]];
  }
  const displayRows = rows.map(([group,name,media,spend,...metrics]) =>
    [group,name,media,spend === null ? null : spend / 10_000,...metrics]);
  sheet.getRange('A4:G'+last).values = [['分组','项目','媒体','消耗','激活成本','首付成本','ROI'],...displayRows];
  const all = sheet.getRange('A1:G'+(last+2));
  all.format.font = {name:'Microsoft YaHei',size:11,color:'#18334B'};
  all.format.rowHeight = 25;
  all.format.verticalAlignment = 'center';
  const heading = sheet.getRange('A1:G1');
  heading.format.fill = '#EAF2FF';
  heading.format.rowHeight = 38;
  heading.format.font = {name:'Microsoft YaHei',size:17,bold:true,color:'#153B69'};
  sheet.getRange('A2:G2').format.font.color = '#536779';
  sheet.getRange('A3:G3').format.rowHeight = 10;
  sheet.getRange('A'+(last+1)+':G'+(last+1)).format.rowHeight = 9;
  sheet.getRange('A'+(last+2)+':G'+(last+2)).format.font = {name:'Microsoft YaHei',size:10,color:'#536779'};
  const header = sheet.getRange('A4:G4');
  header.format.fill = '#256FF0';
  header.format.rowHeight = 29;
  header.format.font = {name:'Microsoft YaHei',size:11,bold:true,color:'#FFFFFF'};
  const palette = [
    {label:'#E0ECFC',total:'#E5F0FF',detail:'#EDF5FF'},
    {label:'#DEF0E6',total:'#E3F3EA',detail:'#ECF7F0'},
    {label:'#F9EAD8',total:'#FBEEDC',detail:'#FFF4E6'},
    {label:'#F8E5EB',total:'#FAEBEF',detail:'#FCF1F4'},
  ];
  const groups = [...new Set(rows.map(([group])=>group).filter(group=>group!=='全盘'))];
  const colors = new Map(groups.map((group,index)=>[group,palette[index%palette.length]]));
  rows.forEach(([group,name,media],index) => {
    const row = index+5;
    const range = sheet.getRange('A'+row+':G'+row);
    const groupTotal = media === '合计' && (!name || name === group);
    if (group === '全盘') {
      range.format.fill = '#D5E7FF';
      range.format.font = {name:'Microsoft YaHei',size:11,bold:true,color:'#184A91'};
      range.format.rowHeight = 29;
    } else {
      const tint = colors.get(group);
      const total = media === '合计' || name === '媒体合计';
      range.format.fill = total ? tint.total : tint.detail;
      if (total) range.format.font.bold = true;
      if (groupTotal && !name) sheet.getRange('B'+row).values = [[group+'项目合计']];
      if (name === '媒体合计') sheet.getRange('B'+row).values = [[group+'媒体合计']];
    }
  });
  [84,220,130,134,105,105,108].forEach((width,index) => {
    const column = String.fromCharCode(65+index);
    sheet.getRange(column+':'+column).format.columnWidthPx = width;
  });
  sheet.getRange('D5:D'+last).setNumberFormat('#,##0.00"万"');
  sheet.getRange('E5:F'+last).setNumberFormat('#,##0.00');
  sheet.getRange('G5:G'+last).setNumberFormat('#,##0.00%');
  const table = sheet.getRange('A4:G'+last);
  table.format.horizontalAlignment = 'center';
  table.format.borders = {preset:'all',style:'thin',color:'#697480'};
  for (let start=0;start<rows.length;) {
    let end=start+1;
    while (end<rows.length && rows[end][0]===rows[start][0]) end++;
    const wideLabel = rows[start][0]==='全盘' || rows.slice(start,end).every(([group,name])=>group===name);
    const groupCell = sheet.getRange('A'+(start+5)+':'+(wideLabel?'B':'A')+(end+4));
    if (wideLabel || end-start>1) groupCell.merge();
    groupCell.format.font.bold = true;
    groupCell.format.fill = rows[start][0]==='全盘' ? '#D5E7FF' : colors.get(rows[start][0]).label;
    if (!wideLabel) {
      for (let first=start;first<end;) {
        let next=first+1;
        while (next<end && rows[next][1]===rows[first][1]) next++;
        if (next-first>1) sheet.getRange('B'+(first+5)+':B'+(next+4)).merge();
        first=next;
      }
    }
    start=end;
  }
  sheet.getRange('F5:F'+last).conditionalFormats.add('dataBar',{color:'#A9A8DF',thresholds:[0,'max'],gradient:false});
  sheet.getRange('G5:G'+last).conditionalFormats.add('dataBar',{color:'#9DD4C1',thresholds:[0,1],gradient:false});
  const screenshot = renderImage
    ? await wb.render({sheetName:'投放播报',range:'A1:G'+(last+2),scale:1})
    : null;
  const workbook = await SpreadsheetFile.exportXlsx(wb);
  await fs.mkdir(path.dirname(output),{recursive:true});
  const pending = output+'.'+process.pid+'.tmp';
  try {
    await workbook.save(pending);
    const zip = await JSZip.loadAsync(await fs.readFile(pending));
    const part = 'xl/worksheets/sheet1.xml';
    const xml = await zip.file(part).async('string');
    let changed = 0;
    const patched = xml.replace(/<(x|x14):dataBar\b[^>]*>[\s\S]*?<\/\1:dataBar>/g, element => {
      if (!element.includes('FF9DD4C1')) return element;
      changed++;
      return element.replace('>', ' minLength="0" maxLength="100">');
    });
    if (changed !== 2) throw new Error('ROI 数据条导出校验失败');
    zip.file(part,patched);
    await fs.writeFile(pending,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
    await fs.rename(pending,output);
  } finally {
    await fs.rm(pending,{force:true});
  }
  return screenshot ? Buffer.from(await screenshot.arrayBuffer()) : null;
}

export async function sendWeComReport(webhook, screenshot, title) {
  const target = new URL(webhook);
  if (target.origin !== 'https://qyapi.weixin.qq.com' ||
      target.pathname !== '/cgi-bin/webhook/send' || !target.searchParams.get('key')) {
    throw new Error('企微 Webhook 地址无效');
  }
  if (!screenshot.length || screenshot.length > 2 * 1024 * 1024) {
    throw new Error('企微截图为空或超过 2 MB');
  }
  const messages = [
    {msgtype:'image',image:{
      base64:screenshot.toString('base64'),
      md5:createHash('md5').update(screenshot).digest('hex'),
    }},
    {msgtype:'text',text:{content:title}},
  ];
  for (const message of messages) {
    const label = message.msgtype === 'image' ? '截图' : '标题';
    let result;
    try {
      const response = await fetch(target, {
        method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
        body:JSON.stringify(message),signal:AbortSignal.timeout(25_000),redirect:'error',
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      result = await response.json();
    } catch {
      throw new Error('企微' + label + '请求结果无法确认');
    }
    if (result.errcode !== 0) throw new Error('企微' + label + '发送失败，错误码 ' + result.errcode);
    console.log('企微' + label + '发送成功');
  }
}

async function connectExistingChrome(chromium) {
  let endpoint = process.env.GRAVITY_CHROME_CDP;
  if (!endpoint) {
    const activePort = path.join(process.env.LOCALAPPDATA,'Google','Chrome','User Data','DevToolsActivePort');
    const content = await fs.readFile(activePort,'utf8').catch(error => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    const [port, socket] = content.trim().split(/\r?\n/);
    if (/^\d+$/.test(port) && socket?.startsWith('/devtools/browser/')) {
      endpoint = 'ws://127.0.0.1:'+port+socket;
    } else if (/^\d+$/.test(port)) {
      endpoint = 'http://127.0.0.1:'+port;
    }
  }
  if (!endpoint) throw new Error('未发现可连接的 Chrome，请打开 chrome://inspect/#remote-debugging 并开启远程调试');
  const address = URL.parse(endpoint);
  if (!address || address.hostname !== '127.0.0.1' || !['http:','ws:'].includes(address.protocol)) {
    throw new Error('Chrome 调试地址必须为本机 127.0.0.1');
  }
  try {
    return await chromium.connectOverCDP(endpoint,{timeout:15_000});
  } catch {
    throw new Error('无法连接现有 Chrome，请确认远程调试已开启，并在 Chrome 中允许连接');
  }
}

async function main() {
  const config = await loadConfig();
  if (!config.report.url) throw new Error('请先在播报后台保存报表配置');
  const {report,project} = config;
  const deps = process.env.GRAVITY_NODE_MODULES ?? path.join(process.env.USERPROFILE,
    '.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules');
  const require = createRequire(path.join(deps,'package.json'));
  const {chromium} = require('playwright');
  const date = day();
  const slot = process.env.GRAVITY_REPORT_SLOT;
  if (slot && (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3])$/.test(slot) || slot.slice(0,10) !== date)) {
    throw new Error('定时任务时点与当前报表日期不符');
  }
  const hour = slot?.slice(11) ?? new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23',
  }).format(new Date());
  const webhook = process.env.GRAVITY_WECOM_WEBHOOK;
  const output = path.resolve(process.argv[2] ?? path.join('outputs','gravity-wecom',date+'_'+Date.now()+'.xlsx'));
  if (path.extname(output).toLowerCase() !== '.xlsx') throw new Error('输出路径需以 .xlsx 结尾');
  const profile = process.env.GRAVITY_PROFILE ?? path.join(process.env.LOCALAPPDATA,'GravityWeComReport','Chrome');
  const reuse = report.browserMode === 'existing';
  const browser = reuse ? await connectExistingChrome(chromium) :
    await chromium.launchPersistentContext(profile,{channel:'chrome',headless:false,viewport:{width:1600,height:1000}});
  let page;
  try {
    if (reuse) {
      const context = browser.contexts()[0];
      if (!context) throw new Error('现有 Chrome 未提供可用的浏览器会话');
      page = await context.newPage();
      await page.setViewportSize({width:1600,height:1000});
    } else {
      page = browser.pages()[0] ?? await browser.newPage();
    }
    let data;
    for (let attempt=0; attempt<=report.retries; attempt++) {
      let stage = '打开报表或登录';
      try {
        await openReport(page,report);
        stage = '刷新报表';
        await refreshReport(page,date,report.timeoutSeconds*1000,report.product);
        stage = '读取和校验数据';
        data = await collect(page,config);
        if (day() !== date) throw new Error('取数期间跨过北京时间日期');
        break;
      } catch (error) {
        const reason = stage+'失败：'+error.message.split('\n')[0];
        if (attempt===report.retries || day()!==date) throw new Error(reason);
        console.warn(reason+'。重新加载报表后重试。');
      }
    }
    const catalog = {date,reportUrl:report.url,product:report.product,
      projects:[...data.apps].map(([id,app])=>({id,name:app.name,
        media:[...app.media].filter(([,metrics])=>metrics.spend!==0).map(([name])=>name)}))};
    await fs.mkdir(path.dirname(discoveryPath),{recursive:true});
    const pendingDiscovery = discoveryPath+'.'+process.pid+'.tmp';
    await fs.writeFile(pendingDiscovery,JSON.stringify(catalog),'utf8');
    await fs.rename(pendingDiscovery,discoveryPath);
    const screenshot = await writeWorkbook(outputRows(data,project),date,output,deps,Boolean(webhook),project.name);
    console.log(output);
    if (webhook) {
      const [year,month,dayOfMonth] = date.split('-');
      await sendWeComReport(webhook,screenshot,'【'+project.name+'】'+year+'年'+month+'月'+dayOfMonth+'日'+hour+'时 - 小时报');
    }
  } finally {
    if (reuse && page) await page.close().catch(()=>{});
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('播报生成失败：'+error.message.split('\n')[0]);
    process.exitCode = 1;
  });
}
