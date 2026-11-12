import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { configPath, defaults, iaaConfigPath, loadConfig } from './config.mjs';
import { readLogin } from './login.mjs';

const root = '.el-table-v2__root';
const timeout = 120_000;
const day = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date());

async function waitForReportTotals(page, trigger, timeout, endpoint = '/report/api/v3/adreport/custom_get/calc_total/') {
  const [response] = await Promise.all([
    page.waitForResponse(result =>
      new URL(result.url()).pathname === endpoint &&
      result.request().method() === 'POST', {timeout}),
    trigger(),
  ]);
  if (!response.ok() || await response.finished()) throw new Error('引力报表汇总查询失败');
  // Let the page apply the response to the virtual table before copying its cells.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openReport(page, {url:reportUrl,title,timeoutSeconds,browserMode}, kind) {
  await page.goto(reportUrl, {waitUntil:'domcontentloaded',timeout:timeoutSeconds*1000});
  const report = kind === 'iaa'
    ? page.getByRole('button', {name:'刷新数据',exact:true})
    : page.getByText(title, {exact:true});
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
    throw new Error('登录后未进入指定引力报表');
  }
}

export async function refreshReport(page, expectedDay, wait = timeout, product = defaults.report.product, layout) {
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
  }, undefined, {timeout:remaining()}), remaining(),
    layout === 'daily' || layout === 'flat' ? '/report/api/v3/adreport/custom_get/' : undefined);
  await page.locator('html[data-gravity-refresh-started=true]').waitFor({state:'attached',timeout:remaining()});
  await ready();
  if (day() !== expectedDay || !await dateFilter.isVisible() || !await productFilter.isVisible()) {
    throw new Error('查询完成后的日期或产品范围与预期不符');
  }
}

function asNumber(value, field, percent) {
  const cleaned = value?.replace(/^\((?:sum|WtAvg)\)\s*/, '').replace(/,/g,'').trim();
  const pattern = percent ? /^-?\d+(?:\.\d+)?%$/ : /^-?\d+(?:\.\d+)?$/;
  if (!cleaned || !pattern.test(cleaned)) throw new Error('指标格式无效：' + field);
  return Number(cleaned.replace('%','')) / (percent ? 100 : 1);
}

async function readGrid(page, {fields,metrics:configuredMetrics,layout}) {
  const raw = await page.locator(root).evaluate((grid,flat) => {
    const select = (node, selector) => Array.from(node.querySelectorAll(selector));
    const cells = row => select(row, '.report-v2-cell--metric').map(cell => cell.innerText);
    const main = grid.querySelector('.el-table-v2__main');
    const left = grid.querySelector('.el-table-v2__left');
    const total = main.querySelector('.el-table-v2__fixed-header-row');
    const rows = scope => select(scope, '.el-table-v2__row[rowkey]').filter(row => row.getClientRects().length);
    const flatRows = scope => select(scope,'.el-table-v2__row:not(.is-fixed)').filter(row=>row.getClientRects().length);
    const position = row => row.getBoundingClientRect().top.toFixed(1);
    return {
      headers: select(main, '.el-table-v2__dynamic-header-row .el-table-v2__header-cell').map(cell => cell.innerText.trim()),
      total: total ? cells(total) : null,
      dimensionText: left?.innerText ?? '',
      metrics: rows(main).map(row => [row.getAttribute('rowkey'), cells(row)]),
      labels: rows(left).map(row => ({
        key:row.getAttribute('rowkey'), label:row.innerText.trim(),
        expanded:row.classList.contains('is-expanded'),
      })),
      flatLabels: flat ? flatRows(left).map(row=>[position(row),select(row,'.el-table-v2__row-cell').map(cell=>cell.innerText.trim())]) : [],
      flatMetrics: flat ? flatRows(main).map(row=>[position(row),cells(row)]) : [],
    };
  },layout === 'flat');
  const pagination = await page.getByText(/^共\s*\d+\s*条$/).innerText();
  const count = Number(pagination.match(/\d+/)[0]);
  if (!count || !raw.total) throw new Error('主表未返回可核验的合计与项目数据');
  if (await page.getByRole('button', {name:'下一页'}).isEnabled()) throw new Error('主表有多页，当前配置无法完整核对');
  const indexes = Object.fromEntries(Object.entries(fields).map(([name,label]) => [name, raw.headers.indexOf(label)]));
  if (Object.values(indexes).includes(-1)) throw new Error('主表指标列已变化');
  const percentFields = new Set(configuredMetrics
    ? configuredMetrics.flatMap(({format},index)=>format === 'percent' ? ['metric'+index] : []) : ['roi']);
  function parse(cells) {
    if (cells?.length !== raw.headers.length) throw new Error('项目指标未完整加载');
    return Object.fromEntries(Object.entries(indexes).map(([field,index]) =>
      [field,asNumber(cells[index],fields[field],percentFields.has(field))]));
  }
  if (layout === 'daily') {
    const dateLabels = raw.dimensionText.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
    if (!dateLabels.length || dateLabels.some(value=>value !== day())) {
      throw new Error('日期报表的明细与北京时间今日不一致');
    }
    return {total:parse(raw.total),apps:new Map()};
  }
  if (layout === 'flat') {
    const metrics = new Map(raw.flatMetrics);
    if (raw.flatLabels.length !== count || raw.flatMetrics.length !== count || metrics.size !== count ||
        new Set(raw.flatLabels.map(([position])=>position)).size !== count) {
      throw new Error('平铺报表的项目与媒体行未完整加载');
    }
    const apps = new Map();
    for (const [position,dimensions] of raw.flatLabels) {
      const [date,product,media] = dimensions;
      const project = product?.match(/^(.*?)\s*APPID\s*(\d+)\s*$/s);
      if (dimensions.length !== 3 || date !== day() || !project || !media || !metrics.has(position)) {
        throw new Error('平铺报表须按「日期、产品、媒体平台」排列，且只包含北京时间今日');
      }
      const [,label,id] = project;
      if (!apps.has(id)) apps.set(id,{name:label.trim() || 'APPID '+id,media:new Map()});
      const app = apps.get(id);
      if (app.media.has(media)) throw new Error('平铺报表中同一项目出现重复媒体：'+media);
      app.media.set(media,parse(metrics.get(position)));
    }
    return {total:parse(raw.total),apps};
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

async function readAppGroupTotal(page, ids, report, timeout) {
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
  const filtered = await readGrid(page,report);
  if (filtered.apps.size !== ids.length || ids.some(id=>!filtered.apps.has(id))) {
    throw new Error('引力项目合计的筛选范围与配置不一致');
  }
  if (report.layout === 'flat') {
    await page.getByRole('button',{name:/^表内筛选\/\s*1$/}).click({timeout});
    await dialog.getByRole('button',{name:'全部清空'}).click({timeout});
    await dialog.getByRole('button',{name:'应用筛选'}).click({timeout});
    await page.getByRole('button',{name:/^表内筛选\/\s*0$/}).waitFor({timeout});
    await refreshReport(page,day(),timeout,report.product,report.layout);
  }
  return filtered.total;
}

export async function collect(page, {report,project} = defaults) {
  const timeout = report.timeoutSeconds * 1000;
  const grid = page.locator(root);
  await grid.waitFor({timeout});
  if (report.layout === 'daily') return readGrid(page,report);
  if (report.layout === 'flat') {
    const base = await readGrid(page,report);
    for (const [id,app] of base.apps) {
      const media = [...app.media.values()];
      app.data = media.length === 1 || media.every(row=>row.spend === 0)
        ? media[0] : await readAppGroupTotal(page,[id],report,timeout);
    }
    const group = project.groups.find(group=>group.name.toUpperCase()==='APP' && group.projects.length>1);
    const ids = group?.projects.map(({id})=>id).filter(id=>base.apps.has(id)) ?? [];
    if (ids.length === 1) base.appGroupTotal = base.apps.get(ids[0]).data;
    if (ids.length > 1 && ids.some(id=>base.apps.get(id).data.spend !== 0)) {
      base.appGroupTotal = await readAppGroupTotal(page,ids,report,timeout);
    }
    return base;
  }
  // Read each project's media independently to keep the virtual table compact.
  const collapse = grid.getByRole('button', {name:'收起当前行',exact:true});
  for (let i=0; i<20 && await collapse.count(); i++) await collapse.first().click();
  if (await collapse.count()) throw new Error('主表存在未收起的行');
  const base = await readGrid(page,report);
  for (const [id,app] of base.apps) {
    if (app.data.spend === 0) continue;
    const row = grid.locator('.el-table-v2__left [rowkey]').filter({hasText:new RegExp('APPID\\s*'+id+'\\b')});
    const expand = row.getByRole('button', {name:'展开当前行',exact:true});
    if (!await expand.count()) throw new Error('APPID '+id+' 有消耗但无法展开媒体明细');
    // The visible row initially contains provisional ratios. Wait for the report's rollup response.
    await waitForReportTotals(page, () => expand.click(), timeout);
    await row.getByRole('button', {name:'收起当前行',exact:true}).waitFor();
    await row.locator('xpath=following-sibling::*[1][contains(@class,"el-table-v2__row-depth-1")]').waitFor({state:'visible',timeout});
    app.media = (await readGrid(page,report)).apps.get(id).media;
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
    base.appGroupTotal = await readAppGroupTotal(page,appIds,report,timeout);
  }
  return base;
}

export function outputRows({total,apps,appGroupTotal}, project = defaults.project, kind = 'gravity', metrics) {
  const rows = [];
  const add = (group,name,media,source) => {
    if (source && source.spend !== 0) {
      const values = metrics ? metrics.map((_,index)=>source['metric'+index])
        : [source.activationCost,kind === 'iaa' ? source.revenue : source.payCost,source.roi];
      rows.push([group,name,media,source.spend,...values]);
    }
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

export async function writeWorkbook(rows, date, output, deps, renderImage = false, projectName = defaults.project.name, hour, kind = 'gravity', metrics, layout = 'project', spendUnit) {
  const require = createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile} = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  const JSZip = require('jszip');
  const wb = Workbook.create();
  const sheet = wb.worksheets.add('投放播报');
  sheet.showGridLines = false;
  const last = 4 + rows.length;
  const daily = layout === 'daily';
  const isFlatReport = daily || layout === 'flat';
  const spendInYuan = spendUnit ? spendUnit === 'yuan' : isFlatReport;
  const spendLabel = spendInYuan ? '消耗（元）' : '消耗';
  const baseColumns = daily ? ['日期',spendLabel] : ['分组','项目','媒体',spendLabel];
  const reportColumns = metrics ?? [
    {label:'激活成本',format:'number'},
    {label:kind === 'iaa' ? '广告收入' : '首付成本',format:'number',bar:true},
    {label:'ROI',format:'percent'},
  ];
  const lastColumn = String.fromCharCode(64+baseColumns.length+reportColumns.length);
  const period = hour === undefined ? date : date+' '+hour+':00';
  const title = kind === 'iaa' ? 'IAA 播报' : '投放播报';
  for (const [row, value] of [[1,projectName+'｜'+title],[2,period+' · 北京时间「今日」累计'],
    [last+2,daily ? '指标取自引力报表的当日合计。' : '指标取自引力报表。仅展示有消耗的项目及媒体。']]) {
    sheet.getRange('A'+row+':'+lastColumn+row).merge();
    sheet.getRange('A'+row).values = [[value]];
  }
  const spendIndex = baseColumns.length-1;
  const displayRows = spendInYuan ? rows : rows.map(row=>
    row.map((value,index)=>index === spendIndex && value !== null ? value/10_000 : value));
  sheet.getRange('A4:'+lastColumn+last).values = [[...baseColumns,...reportColumns.map(({label})=>label)],...displayRows];
  const all = sheet.getRange('A1:'+lastColumn+(last+2));
  all.format.font = {name:'Microsoft YaHei',size:11,color:'#18334B'};
  all.format.rowHeight = 25;
  all.format.verticalAlignment = 'center';
  const heading = sheet.getRange('A1:'+lastColumn+'1');
  heading.format.fill = '#EAF2FF';
  heading.format.rowHeight = 38;
  heading.format.font = {name:'Microsoft YaHei',size:17,bold:true,color:'#153B69'};
  sheet.getRange('A2:'+lastColumn+'2').format.font.color = '#536779';
  sheet.getRange('A3:'+lastColumn+'3').format.rowHeight = 10;
  sheet.getRange('A'+(last+1)+':'+lastColumn+(last+1)).format.rowHeight = 9;
  sheet.getRange('A'+(last+2)+':'+lastColumn+(last+2)).format.font = {name:'Microsoft YaHei',size:10,color:'#536779'};
  const header = sheet.getRange('A4:'+lastColumn+'4');
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
    const range = sheet.getRange('A'+row+':'+lastColumn+row);
    const groupTotal = media === '合计' && (!name || name === group);
    if (daily || group === '全盘') {
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
  const baseWidths = daily ? [120,106] : [84,220,130,134];
  [...baseWidths,...reportColumns.map(({label,format})=>metrics
    ? Math.max(108,Math.min(240,label.length*15+28)) : format === 'percent' ? 108 : 105)].forEach((width,index) => {
    const column = String.fromCharCode(65+index);
    sheet.getRange(column+':'+column).format.columnWidthPx = width;
  });
  const spendColumn = daily ? 'B' : 'D';
  const spendDecimals = spendUnit ? '#,##0' : '#,##0.00';
  sheet.getRange(spendColumn+'5:'+spendColumn+last).setNumberFormat(spendDecimals+(spendInYuan ? '' : '"万"'));
  const formats = {number:isFlatReport ? '#,##0.0000' : '#,##0.00',integer:'#,##0',percent:'#,##0.00%'};
  for (const [index,{format,bar}] of reportColumns.entries()) {
    const column = String.fromCharCode(65+baseColumns.length+index);
    const range = sheet.getRange(column+'5:'+column+last);
    range.setNumberFormat(formats[format]);
    if (format === 'percent') range.conditionalFormats.add('dataBar',{color:'#9DD4C1',thresholds:[0,1],gradient:false});
    else if (bar) range.conditionalFormats.add('dataBar',{color:'#A9A8DF',thresholds:[0,'max'],gradient:false});
  }
  const table = sheet.getRange('A4:'+lastColumn+last);
  table.format.horizontalAlignment = 'center';
  table.format.borders = {preset:'all',style:'thin',color:'#697480'};
  for (let start=0;!daily && start<rows.length;) {
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
  const screenshot = renderImage
    ? await wb.render({sheetName:'投放播报',range:'A1:'+lastColumn+(last+2),scale:1,headers:false})
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
    if (changed !== 2*reportColumns.filter(({format})=>format === 'percent').length) {
      throw new Error('百分比数据条导出校验失败');
    }
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

async function main(kind) {
  const file = kind === 'iaa' && !process.env.GRAVITY_REPORT_CONFIG ? iaaConfigPath : configPath;
  const config = await loadConfig(file,kind);
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
  const preview = process.argv[3] === '--preview';
  const webhook = preview ? undefined : process.env.GRAVITY_WECOM_WEBHOOK;
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
        console.log('正在打开引力报表（第 '+(attempt+1)+' 次）');
        await openReport(page,report,kind);
        stage = '刷新报表';
        console.log('正在刷新引力报表');
        await refreshReport(page,date,report.timeoutSeconds*1000,report.product,report.layout);
        stage = '读取和校验数据';
        console.log('正在读取和校验项目、媒体及指标');
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
    const discoveryPath = file+'.projects.json';
    await fs.mkdir(path.dirname(discoveryPath),{recursive:true});
    const pendingDiscovery = discoveryPath+'.'+process.pid+'.tmp';
    await fs.writeFile(pendingDiscovery,JSON.stringify(catalog),'utf8');
    await fs.rename(pendingDiscovery,discoveryPath);
    console.log('正在生成 Excel'+(webhook ? ' 和企微截图' : ''));
    const rows = report.layout === 'daily'
      ? [[date,data.total.spend,...report.metrics.map((_,index)=>data.total['metric'+index])]]
      : outputRows(data,project,kind,report.metrics);
    const screenshot = await writeWorkbook(rows,date,output,deps,
      preview||Boolean(webhook),project.name,hour,kind,report.metrics,report.layout,report.spendUnit);
    console.log(output);
    if (preview) await fs.writeFile(output.slice(0,-5)+'.png',screenshot);
    if (webhook) {
      const [year,month,dayOfMonth] = date.split('-');
      const reportName = kind === 'iaa' ? 'IAA 小时报' : '小时报';
      await sendWeComReport(webhook,screenshot,'【'+project.name+'】'+year+'年'+month+'月'+dayOfMonth+'日'+hour+'时 - '+reportName);
    }
  } finally {
    if (reuse && page) await page.close().catch(()=>{});
    await browser.close();
  }
}

export function runFromCli(kind = 'gravity') {
  return main(kind).catch(error => {
    console.error('播报生成失败：'+error.message.split('\n')[0]);
    process.exitCode = 1;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runFromCli();
