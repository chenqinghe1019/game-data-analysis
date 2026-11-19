import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configPath, defaults, externalConfigPath, iaaConfigPath, loadConfig, validateTaMediaUrl } from './config.mjs';
import { readLogin } from './login.mjs';
import { externalPeriod, externalPushTitle, externalWorkbookName, parseTaHourly, parseTaPaidHourly, readTaDashboard, readTaHourly, updateExternalHourly, writeExternalHourly } from './external-hourly.mjs';
import { externalDelivery } from './external-retry.mjs';
import {applyVerifiedGravityMetrics,canValidateProjectRollups,parseProjectRollups,validateGravityRollup} from './gravity-validation.mjs';

const root = '.el-table-v2__root';
const timeout = 120_000;
const reportEndpoint = '/report/api/v3/adreport/custom_get/';
const rollupEndpoint = '/report/api/v3/adreport/custom_get/calc_total/';
const standardMetrics = {
  spend:'ap_cost',activations:'standard_activate_cnt',activationCost:'standard_activate_cost',
  payers:'standard_1day_pay_uv',payCost:'standard_1day_pay_cost',revenue:'standard_1day_pay_amount',
  roi:'standard_1day_pay_amount_roi',
};
const day = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date());
const previousDay = date => new Date(Date.parse(date+'T00:00:00Z')-86_400_000).toISOString().slice(0,10);

class GravityLoginPending extends Error {}

async function waitForReportTotals(page, trigger, timeout, endpoint = rollupEndpoint, matches = () => true) {
  // Ignore responses from requests already in flight before this refresh or expansion.
  const requests = new Set();
  const observe = request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === endpoint) requests.add(request);
  };
  page.on('request',observe);
  let response;
  try {
    [response] = await Promise.all([
      page.waitForResponse(result=>requests.has(result.request()) && matches(result.request()),{timeout}),
      trigger(),
    ]);
  } finally {
    page.off('request',observe);
  }
  if (!response.ok() || await response.finished()) throw new Error('引力报表汇总查询失败');
  // Let the page apply the response to the virtual table before copying its cells.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return response;
}

async function readMediaRollup(page, expand, app, id, expectedDay, timeout, validate = false) {
  let groups;
  const response = await waitForReportTotals(page, () => expand.click(), timeout, rollupEndpoint, request => {
    let query;
    try { query = request.postDataJSON(); } catch { return false; }
    const batches = query?.data_list;
    if (query?.date_list?.length !== 2 || query.date_list.some(date=>date !== expectedDay) ||
        !Array.isArray(batches) || !batches.length) return false;
    const matchesProject = batches.every(batch => {
      const first = batch?.[0];
      return first?.parentId?.startsWith(app.key+'-') && first.click_company && batch.every(row =>
        String(row.app_id) === id && row.field === 'operator_id' &&
        row.parentId === first.parentId && row.click_company === first.click_company);
    });
    if (matchesProject) groups = batches;
    return matchesProject;
  });
  const {code,data} = await response.json();
  const rows = data?.list;
  if (code !== 0 || !Array.isArray(rows) || rows.length !== groups.length) {
    throw new Error('APPID '+id+' 的媒体汇总响应不完整');
  }
  const rollup = new Map();
  for (const [index,group] of groups.entries()) {
    const {parentId} = group[0];
    const result = rows[index];
    const spend = group.reduce((sum,row)=>sum+row.ap_cost,0);
    if (rollup.has(parentId) || !Number.isFinite(spend) || !Number.isFinite(result?.ap_cost) ||
        Math.abs(result.ap_cost-spend) > 0.01+0.005*group.length) {
      throw new Error('APPID '+id+' 的媒体汇总响应与请求明细不一致');
    }
    if (validate) validateGravityRollup(group,result,'APPID '+id+' 媒体 '+parentId);
    rollup.set(parentId,result);
  }
  return rollup;
}

async function openReport(page, {url:reportUrl,title,timeoutSeconds}, kind, retry) {
  const target = new URL(reportUrl);
  const current = new URL(page.url());
  // The report/login locator below checks readiness without waiting on unrelated page resources.
  const options = {waitUntil:'commit',timeout:timeoutSeconds*1000};
  if (retry && current.origin === target.origin && current.hash === target.hash) {
    console.log('正在刷新当前引力网页后重试');
    await page.reload(options);
  } else {
    console.log('正在访问引力报表链接');
    await page.goto(reportUrl, options);
  }
  const report = kind === 'iaa'
    ? page.getByRole('button', {name:'刷新数据',exact:true})
    : page.getByText(title, {exact:true});
  const login = page.getByRole('button', {name:'登录', exact:true});
  await report.or(login).first().waitFor({timeout:timeoutSeconds*1000});
  if (await login.isVisible()) {
    const loginUrl = new URL(page.url());
    if (loginUrl.origin !== target.origin || !loginUrl.hash.startsWith('#/login')) {
      throw new Error('登录页地址校验失败');
    }
    const credentials = await readLogin();
    if (credentials) {
      try {
        await page.getByPlaceholder('请输入邮箱地址',{exact:true}).fill(credentials.email,{timeout:10_000});
        await page.getByPlaceholder('请输入登录密码',{exact:true}).fill(credentials.password,{timeout:10_000});
      } catch {
        throw new Error('引力登录表单无法填写');
      }
      const label = page.locator('label').filter({hasText:/^我已阅读并同意$/});
      const checkbox = label.locator('input[type=checkbox]');
      try {
        // The checkbox input is covered by Element UI's visible label.
        if (!await checkbox.isChecked({timeout:5_000})) await label.click({timeout:5_000});
        if (!await checkbox.isChecked({timeout:5_000})) throw new Error('勾选状态未生效');
      } catch {
        throw new Error('引力同意条款未能勾选');
      }
      console.log('引力条款已勾选，正在自动登录。');
      try {
        await login.click({timeout:10_000});
        await report.waitFor({timeout:timeoutSeconds*1000});
      } catch {
        throw new Error('引力已尝试登录，未进入报表，请检查账号或额外验证要求');
      }
    } else {
      console.log('当前未配置引力账号，请在 Chrome 窗口登录。最多等待 5 分钟。');
      try {
        await report.waitFor({timeout:300_000});
      } catch {
        throw new GravityLoginPending('等待引力登录超时');
      }
    }
  }
  const actual = new URL(page.url());
  if (actual.origin + actual.hash !== new URL(reportUrl).origin + new URL(reportUrl).hash) {
    throw new Error('登录后未进入指定引力报表');
  }
}

export async function refreshReport(page, expectedDay, wait = timeout, product = defaults.report.product, layout, productAppId) {
  const deadline = Date.now() + wait;
  const remaining = () => Math.max(1, deadline - Date.now());
  const refresh = page.getByRole('button', {name:'刷新数据', exact:true}).and(page.locator('button:not(.is-round)'));
  const ready = () => page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll('button'))
      .find(item => item.innerText.includes('刷新数据'));
    return button && !button.disabled &&
      !document.querySelector('.el-table-v2__root')?.innerText.includes('计算中，请稍候');
  }, null, {timeout:remaining()});
  const today = day();
  const preset = expectedDay === today ? '今日' : '昨日';
  if (preset === '昨日' && expectedDay !== previousDay(today)) throw new Error('报表日期须为北京时间今日或昨日');
  const dateFilter = page.getByRole('button', {name:preset+'|'+expectedDay+'至'+expectedDay,exact:true});
  const dateControl = page.getByRole('button', {name:/^(?:(?:今日|昨日|过去\d+天)\|\d{4}-\d{2}-\d{2}至\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2})$/});
  const productText = page.getByText(product,{exact:true});
  const productFilter = productAppId
    ? page.locator('.el-select__selected-item .label-text').and(productText)
    : productText;
  await dateControl.waitFor({timeout:remaining()});
  if (!await dateFilter.isVisible()) {
    await dateControl.click({timeout:remaining()});
    // The first preset is a quick date-range shortcut. It applies both endpoints.
    await page.getByText(preset,{exact:true}).filter({visible:true}).first().click({timeout:remaining()});
    await dateFilter.waitFor({timeout:remaining()});
  }
  await productFilter.waitFor({timeout:remaining()});
  await ready();
  const external = layout === 'external';
  const unfilteredTable = page.getByRole('button',{name:/^表内筛选\/\s*0$/});
  if (external && !await unfilteredTable.isVisible()) throw new Error('外部小时报需要先清除引力表内筛选');
  const matchesExternalTable = request => {
    let query;
    try { query = request.postDataJSON(); } catch { return false; }
    return query?.data_dims?.[0] === 'app_id' && query.data_dims.includes('click_company') &&
      query.date_list?.length === 2 && query.date_list.every(date=>date === expectedDay) &&
      query.filters?.some(({field,operator,values})=>field === 'app_id' && operator === 'EQUALS' &&
        values?.length === 1 && String(values[0]) === productAppId);
  };
  // Trigger the exact button without pointer scrolling, and observe that same button.
  const response = await waitForReportTotals(page, () => refresh.evaluate(button => {
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
    layout === 'daily' || layout === 'flat' || external ? reportEndpoint : undefined,
    external ? matchesExternalTable : undefined);
  await page.locator('html[data-gravity-refresh-started=true]').waitFor({state:'attached',timeout:remaining()});
  await ready();
  let source;
  if (external) {
    const query = response.request().postDataJSON();
    const {code,data} = await response.json();
    const count = data?.page_info?.total;
    if (code !== 0 || !Number.isInteger(count) || count < 0 || !Array.isArray(data.list) ||
        data.list.length !== count || data.list.some(row=>String(row.app_id) !== productAppId)) {
      throw new Error('引力项目及媒体主表未返回有效记录');
    }
    if (query.filters.length !== 1 || !await unfilteredTable.isVisible()) {
      throw new Error('含自然量 ROI 需要仅按 APPID 查询完整项目，当前报表存在额外筛选');
    }
    const pagination = count === 0 ? /^共\s*0\s*条$/ : /^共\s*[1-9]\d*\s*条$/;
    await page.getByText(pagination).waitFor({timeout:remaining()});
    if (count > 0 && !Number.isFinite(data.total?.ap_cost)) throw new Error('引力原始项目汇总缺少消耗');
    source = {kind:'external',count,spend:data.total?.ap_cost};
  } else if (layout !== 'daily' && layout !== 'flat') {
    const query=response.request().postDataJSON();
    if (canValidateProjectRollups(query)) source=parseProjectRollups(query,await response.json(),expectedDay);
  }
  if (day() !== today || !await dateFilter.isVisible() || !await productFilter.isVisible()) {
    throw new Error('查询完成后的日期或产品范围与预期不符');
  }
  return source;
}

async function selectReportProduct(page, {product,productAppId,timeoutSeconds}) {
  const timeout = timeoutSeconds*1000;
  const selected = page.locator('.el-select__selected-item .label-text').filter({visible:true});
  await selected.waitFor({timeout});
  if ((await selected.innerText()).trim() === product) return;
  await selected.click({timeout});
  const search = page.getByRole('textbox',{name:/搜索应用名称/});
  await search.fill(productAppId,{timeout});
  const picker = page.getByRole('tooltip').filter({has:search});
  const option = picker.getByText(product,{exact:true});
  await option.click({timeout});
  await selected.and(page.getByText(product,{exact:true})).waitFor({timeout});
}

function asNumber(value, field, percent) {
  const cleaned = value?.replace(/^\((?:sum|WtAvg)\)\s*/, '').replace(/,/g,'').trim();
  const pattern = percent ? /^-?\d+(?:\.\d+)?%$/ : /^-?\d+(?:\.\d+)?$/;
  if (!cleaned || !pattern.test(cleaned)) throw new Error('指标格式无效：' + field);
  return Number(cleaned.replace('%','')) / (percent ? 100 : 1);
}

async function readGrid(page, {fields,metrics:configuredMetrics,layout}, expectedDay) {
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
  if (Object.values(indexes).includes(-1) ||
      Object.values(fields).some(label=>raw.headers.indexOf(label)!==raw.headers.lastIndexOf(label))) {
    throw new Error('主表指标列已变化或出现重复列');
  }
  const percentFields = new Set(configuredMetrics
    ? configuredMetrics.flatMap(({format},index)=>format === 'percent' ? ['metric'+index] : []) : ['roi']);
  function parse(cells) {
    if (cells?.length !== raw.headers.length) throw new Error('项目指标未完整加载');
    return Object.fromEntries(Object.entries(indexes).map(([field,index]) =>
      [field,asNumber(cells[index],fields[field],percentFields.has(field))]));
  }
  if (layout === 'daily') {
    const dateLabels = raw.dimensionText.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
    if (!dateLabels.length || dateLabels.some(value=>value !== expectedDay)) {
      throw new Error('日期报表的明细与目标日期不一致');
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
      if (dimensions.length !== 3 || date !== expectedDay || !project || !media || !metrics.has(position)) {
        throw new Error('平铺报表须按「日期、产品、媒体平台」排列，且只包含目标日期');
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
        data:parse(metrics.get(item.key)), media:new Map(),mediaKeys:new Map()};
      apps.set(id,current);
    } else {
      if (!current || current.media.has(item.label)) throw new Error('媒体行未能唯一匹配项目');
      current.media.set(item.label,parse(metrics.get(item.key)));
      current.mediaKeys.set(item.label,item.key);
    }
  }
  if (apps.size !== count) throw new Error('主表项目未全部加载，已停止导出');
  return {total:parse(raw.total),apps};
}

async function applyTableFilter(page, dimension, values, timeout, matches) {
  await page.getByRole('button', {name:/^表内筛选\/\s*0$/}).click({timeout});
  const dialog = page.getByRole('dialog', {name:'表内筛选'});
  await dialog.getByText('请选择', {exact:true}).first().click({timeout});
  await page.getByRole('option', {name:dimension,exact:true}).click({timeout});
  await dialog.getByText('操作符', {exact:true}).click({timeout});
  await page.getByRole('option', {name:'等于',exact:true}).click({timeout});
  await dialog.getByText('请选择', {exact:true}).click({timeout});
  const picker = page.getByRole('tooltip').filter({
    has:page.getByRole('textbox', {name:'请输入搜索，支持空格分隔'}),
  });
  for (const value of values) {
    await picker.getByText(value,{exact:true}).click({timeout});
  }
  await dialog.getByRole('heading').click({timeout});
  return waitForReportTotals(page, () => dialog.getByRole('button', {name:'应用筛选'}).click({timeout}),
    timeout, rollupEndpoint, matches);
}

async function readAppGroupTotal(page, ids, report, timeout, expectedDay) {
  const response=await applyTableFilter(page,'产品',ids.map(id=>new RegExp('\\b'+id+'\\b')),timeout);
  const filtered = await readGrid(page,report,expectedDay);
  if (filtered.apps.size !== ids.length || ids.some(id=>!filtered.apps.has(id))) {
    throw new Error('引力项目合计的筛选范围与配置不一致');
  }
  const query=response.request().postDataJSON();
  if (report.layout !== 'flat' && canValidateProjectRollups(query)) {
    const verified=parseProjectRollups(query,await response.json(),expectedDay);
    if (verified.apps.size!==ids.length || ids.some(id=>!verified.apps.has(id))) {
      throw new Error('APP 分组合计的原始汇总范围与配置不一致');
    }
    applyVerifiedGravityMetrics(filtered.total,verified.total,report,standardMetrics,defaults.report.fields,'APP 分组合计');
  }
  if (report.layout === 'flat') {
    const dialog = page.getByRole('dialog',{name:'表内筛选'});
    await page.getByRole('button',{name:/^表内筛选\/\s*1$/}).click({timeout});
    await dialog.getByRole('button',{name:'全部清空'}).click({timeout});
    await dialog.getByRole('button',{name:'应用筛选'}).click({timeout});
    await page.getByRole('button',{name:/^表内筛选\/\s*0$/}).waitFor({timeout});
    await refreshReport(page,expectedDay,timeout,report.product,report.layout);
  }
  return filtered.total;
}

export async function collect(page, {report,project} = defaults, expectedDay = day(), source) {
  const timeout = report.timeoutSeconds * 1000;
  const external = source?.kind === 'external';
  const grid = page.locator(root);
  await grid.waitFor({timeout});
  if (external) {
    const empty = await page.getByText(/^共\s*0\s*条$/).isVisible();
    if (empty !== (source.count === 0)) throw new Error('引力页面与本次查询记录数不一致');
    if (empty) {
      console.log('引力原始查询已确认当天无记录');
      return {total:null,paid:null};
    }
  }
  if (report.layout === 'daily') return readGrid(page,report,expectedDay);
  if (report.layout === 'flat') {
    const base = await readGrid(page,report,expectedDay);
    for (const [id,app] of base.apps) {
      const media = [...app.media.values()];
      app.data = media.length === 1 || media.every(row=>row.spend === 0)
        ? media[0] : await readAppGroupTotal(page,[id],report,timeout,expectedDay);
    }
    const group = project.groups.find(group=>group.name.toUpperCase()==='APP' && group.projects.length>1);
    const ids = group?.projects.map(({id})=>id).filter(id=>base.apps.has(id)) ?? [];
    if (ids.length === 1) base.appGroupTotal = base.apps.get(ids[0]).data;
    if (ids.length > 1 && ids.some(id=>base.apps.get(id).data.spend !== 0)) {
      base.appGroupTotal = await readAppGroupTotal(page,ids,report,timeout,expectedDay);
    }
    return base;
  }
  // Read each project's media independently to keep the virtual table compact.
  const collapse = grid.getByRole('button', {name:'收起当前行',exact:true});
  for (let i=0; i<20 && await collapse.count(); i++) await collapse.first().click();
  if (await collapse.count()) throw new Error('主表存在未收起的行');
  const base = await readGrid(page,report,expectedDay);
  if (source?.kind === 'hierarchy') {
    if (source.apps.size!==base.apps.size) throw new Error('项目列表与本次 APPID 汇总不一致');
    applyVerifiedGravityMetrics(base.total,source.total,report,standardMetrics,defaults.report.fields,'全盘');
    for (const [id,app] of base.apps) {
      const verified=source.apps.get(id);
      if (!verified || verified.key!==app.key) throw new Error('项目行与本次 APPID '+id+' 汇总不一致');
      applyVerifiedGravityMetrics(app.data,verified.metrics,report,standardMetrics,defaults.report.fields,'APPID '+id);
    }
  }
  if (report.productAppId && (base.apps.size !== 1 || !base.apps.has(report.productAppId))) {
    throw new Error('报表项目与配置的引力 APPID 不一致');
  }
  if (external) {
    const {data} = base.apps.get(report.productAppId);
    if (Math.abs(data.spend-source.spend) > 0.01 || Math.abs(data.spend-base.total.spend) > 0.01 ||
        Math.abs(data.roi-base.total.roi) > 0.000051) {
      throw new Error('引力项目行与本次完整项目汇总的消耗或 ROI 不一致');
    }
  }
  for (const [id,app] of base.apps) {
    if (!external && app.data.spend === 0) continue;
    const row = grid.locator('.el-table-v2__left [rowkey]').filter({hasText:new RegExp('APPID\\s*'+id+'\\b')});
    const expand = row.getByRole('button', {name:'展开当前行',exact:true});
    if (!await expand.count()) throw new Error('APPID '+id+' 有消耗但无法展开媒体明细');
    // The provisional row may have the right spend but different costs and ROI.
    const rollup = await readMediaRollup(page,expand,app,id,expectedDay,timeout,source?.kind === 'hierarchy');
    await row.getByRole('button', {name:'收起当前行',exact:true}).waitFor();
    await row.locator('xpath=following-sibling::*[1][contains(@class,"el-table-v2__row-depth-1")]').waitFor({state:'visible',timeout});
    const expanded = (await readGrid(page,report,expectedDay)).apps.get(id);
    if (expanded.media.size !== rollup.size) throw new Error('APPID '+id+' 的媒体行数与汇总不一致');
    for (const [name,metrics] of expanded.media) {
      const final = rollup.get(expanded.mediaKeys.get(name));
      if (!final || Math.abs(metrics.spend-final.ap_cost) > 0.01) {
        throw new Error('APPID '+id+' 的媒体「'+name+'」与汇总无法对应');
      }
      for (const [field,key] of Object.entries(standardMetrics)) {
        if (!report.fields[field] || report.fields[field] !== defaults.report.fields[field]) continue;
        if (!Number.isFinite(final[key])) throw new Error('媒体汇总缺少指标：'+report.fields[field]);
        metrics[field] = final[key];
      }
    }
    app.media = expanded.media;
    if (source?.kind === 'hierarchy') {
      validateGravityRollup([...rollup.values()],source.apps.get(id).metrics,'APPID '+id+' 全部媒体');
    }
    const mediaSpend = [...app.media.values()].reduce((sum,item)=>sum+item.spend,0);
    if (Math.abs(mediaSpend-app.data.spend) > 0.01+0.005*app.media.size) {
      throw new Error('APPID '+id+' 媒体消耗合计 '+mediaSpend.toFixed(4)+
        ' 与项目消耗 '+app.data.spend.toFixed(4)+' 不一致，可能存在漏行');
    }
    await row.getByRole('button', {name:'收起当前行',exact:true}).click();
  }
  if (external) {
    const app = base.apps.get(report.productAppId);
    // Preserve the full project rollup before applying any media filter.
    const total = app.data;
    const paid = [...app.media].filter(([name])=>name.trim() !== '自然量');
    let paidTotal = paid[0]?.[1];
    if (paid.length>1) {
      await applyTableFilter(page,'媒体平台',paid.map(([name])=>name),timeout,request=>{
        let query;
        try { query=request.postDataJSON(); } catch { return false; }
        const rows=query?.data_list?.flat();
        return query?.date_list?.length === 2 && query.date_list.every(date=>date === expectedDay) &&
          rows?.length > 0 && rows.every(row=>String(row.app_id) === report.productAppId &&
            row.click_company && row.click_company !== 'natural');
      });
      const filtered = await readGrid(page,report,expectedDay);
      if (filtered.apps.size !== 1 || !filtered.apps.has(report.productAppId) ||
          Math.abs(filtered.total.spend-paid.reduce((sum,[,row])=>sum+row.spend,0)) > 0.01) {
        throw new Error('引力非自然量汇总未通过校验');
      }
      paidTotal = filtered.total;
    }
    if (!paidTotal) return {total,paid:null};
    if (!report.fields.registrations) return {total,paid:paidTotal};
    const {registrations:tencentRegistrations,...metrics} = paidTotal;
    if (!Number.isSafeInteger(tencentRegistrations) || tencentRegistrations<0) {
      throw new Error('引力非自然量的腾讯注册人数须为非负整数');
    }
    return {total,paid:{...metrics,tencentRegistrations,
      registrationCost:tencentRegistrations === 0 ? null : metrics.spend/tencentRegistrations}};
  }
  const appGroup = project.groups.find(group=>group.name.toUpperCase()==='APP' && group.projects.length>1);
  const appIds = appGroup?.projects.map(({id})=>id).filter(id=>base.apps.has(id)) ?? [];
  if (appIds.length) {
    base.appGroupTotal = await readAppGroupTotal(page,appIds,report,timeout,expectedDay);
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

export async function writeWorkbook(rows, date, output, deps, renderImage = false, projectName = defaults.project.name, hour, kind = 'gravity', metrics, layout = 'project', spendUnit, fullDay = false) {
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
  const period = fullDay ? date+' 24:00' : hour === undefined ? date : date+' '+hour+':00';
  const title = kind === 'iaa' ? 'IAA 播报' : '投放播报';
  const periodLabel = fullDay ? ' · 北京时间「全天汇总」' : ' · 北京时间「今日」累计';
  for (const [row, value] of [[1,projectName+'｜'+title],[2,period+periodLabel],
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
  const spendDecimals = spendUnit === 'yuan' || spendUnit === 'wan' ? '#,##0' : '#,##0.00';
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

export async function sendWeComReport(webhook, screenshot, title, delivery) {
  const target = new URL(webhook);
  if (target.origin !== 'https://qyapi.weixin.qq.com' ||
      target.pathname !== '/cgi-bin/webhook/send' || !target.searchParams.get('key')) {
    throw new Error('企微 Webhook 地址无效');
  }
  const imageSent=await delivery?.status('image') === 'sent';
  if (!imageSent && (!screenshot.length || screenshot.length > 2 * 1024 * 1024)) {
    throw new Error('企微截图为空或超过 2 MB');
  }
  const messages = [
    ...(!imageSent ? [{msgtype:'image',image:{
      base64:screenshot.toString('base64'),
      md5:createHash('md5').update(screenshot).digest('hex'),
    }}] : []),
    {msgtype:'text',text:{content:title}},
  ];
  for (const message of messages) {
    const label = message.msgtype === 'image' ? '截图' : '标题';
    const status=await delivery?.status(message.msgtype);
    if (status === 'sent') continue;
    if (status !== undefined) throw new Error('企微'+label+'上一笔请求结果未确认，已暂停重发');
    await delivery?.begin(message.msgtype);
    let result;
    try {
      const response = await fetch(target, {
        method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
        body:JSON.stringify(message),signal:AbortSignal.timeout(25_000),redirect:'error',
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      result = await response.json();
      if (!Number.isInteger(result?.errcode)) throw new Error('企微响应缺少结果');
    } catch {
      throw new Error('企微' + label + '请求结果无法确认');
    }
    if (result.errcode !== 0) {
      await delivery?.rejected(message.msgtype);
      throw new Error('企微' + label + '发送失败，错误码 ' + result.errcode);
    }
    await delivery?.sent(message.msgtype);
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
  const backupCli = process.argv[2] === '--backup';
  const appendBackup = backupCli && process.argv[4] === '--append-to-history';
  if (backupCli && kind !== 'external') throw new Error('该备用入口仅用于外部小时报');
  if (appendBackup && process.argv.length > 5) throw new Error('写入累计小时报时不能另指定输出路径');
  const projectFiles = {iaa:iaaConfigPath,external:externalConfigPath};
  const file = appendBackup ? externalConfigPath : process.env.GRAVITY_REPORT_CONFIG ?? projectFiles[kind] ?? configPath;
  const config = await loadConfig(file,kind);
  if (!config.report.url) throw new Error('请先在播报后台保存报表配置');
  const {report,project} = config;
  const dashboard = Boolean(report.taPanelUrl);
  const mediaUrl = dashboard ? '' : backupCli ? validateTaMediaUrl(process.argv[3],report.taUrl) : report.taMediaUrl;
  const fromMedia = dashboard || Boolean(mediaUrl);
  if (fromMedia) delete report.fields.registrations;
  const deps = process.env.GRAVITY_NODE_MODULES ?? path.join(process.env.USERPROFILE,
    '.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules');
  const require = createRequire(path.join(deps,'package.json'));
  const {chromium} = require('playwright');
  const runDay = day();
  const slot = backupCli ? undefined : process.env.GRAVITY_REPORT_SLOT;
  if (slot && (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3])$/.test(slot) || slot.slice(0,10) !== runDay)) {
    throw new Error('定时任务时点与当前报表日期不符');
  }
  const hour = slot?.slice(11) ?? new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23',
  }).format(new Date());
  const fullDay = (Boolean(slot) || appendBackup || (!backupCli && fromMedia)) && hour === '00';
  const date = fullDay ? previousDay(runDay) : runDay;
  const preview = backupCli ? !appendBackup : process.argv[3] === '--preview';
  const webhook = preview || backupCli ? undefined : process.env.GRAVITY_WECOM_WEBHOOK;
  const cutoffHour = fullDay ? '24' : hour;
  const time = cutoffHour+':00';
  if (kind === 'external' && !preview && config.schedule.startAt && date+'T'+time < config.schedule.startAt) {
    throw new Error('该快照早于外部小时报的正式首报时点');
  }
  const rootOutput = path.join('outputs','gravity-wecom');
  const externalOutput = path.resolve(rootOutput,'external',externalWorkbookName);
  let outputPath = process.argv[2] ?? (kind === 'external' && !preview ? externalOutput
    : path.join(rootOutput,date+'_'+Date.now()+'.xlsx'));
  if (appendBackup) {
    outputPath = fileURLToPath(new URL('../../../outputs/gravity-wecom/external/'+externalWorkbookName,import.meta.url));
  } else if (backupCli) {
    outputPath = process.argv[4] ?? path.join(rootOutput,'external',date+'_'+Date.now()+'_备用小时报.xlsx');
  }
  const output = path.resolve(outputPath);
  if (path.extname(output).toLowerCase() !== '.xlsx') throw new Error('输出路径需以 .xlsx 结尾');
  if (kind === 'external' && preview && path.basename(output).toLowerCase() === externalWorkbookName.toLowerCase()) {
    throw new Error('请为格式预览使用单独的文件名，避免覆盖累计 Excel');
  }
  const archive = path.join(path.dirname(file),'hourly-snapshots.sqlite');
  const delivery=kind === 'external' && slot && webhook
    ? externalDelivery(path.join(path.dirname(file),'sent-slots'),slot) : undefined;
  const title=kind === 'external' ? externalPushTitle(report.pushTitleTemplate,project.name,date,cutoffHour) : '';
  if (await delivery?.status('image') === 'sent') {
    console.log('企微截图已有发送确认，本次只处理标题');
    await sendWeComReport(webhook,Buffer.alloc(0),title,delivery);
    return;
  }
  if (appendBackup) {
    await fs.access(archive).catch(error => {
      throw new Error('找不到原小时报的累计存档，请检查外部小时报配置',{cause:error});
    });
  }
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
        await openReport(page,report,kind,attempt > 0);
        if (report.productAppId) await selectReportProduct(page,report);
        stage = '刷新报表';
        console.log('正在刷新引力报表');
        const source = await refreshReport(page,date,report.timeoutSeconds*1000,report.product,
          kind === 'external' ? 'external' : report.layout,report.productAppId);
        stage = '读取和校验数据';
        console.log('正在读取和校验项目、媒体及指标');
        data = await collect(page,config,date,source);
        if (day() !== runDay) throw new Error('取数期间跨过北京时间日期');
        break;
      } catch (error) {
        const reason = stage+'失败：'+error.message.split('\n')[0];
        if (error instanceof GravityLoginPending || attempt===report.retries || day()!==runDay) throw new Error(reason);
        console.warn(reason+'。重新加载报表后重试。');
      }
    }
    if (kind === 'external') {
      const previewCsv = preview && !backupCli && !dashboard ? process.argv[4] : undefined;
      const taTimeout = report.timeoutSeconds*1000;
      let ta,paidTa,previousRetention,retentions;
      if (dashboard) {
        console.log('正在从数数看板导出总表和分媒体数据');
        ({ta,paidTa,previousRetention,retentions} = await readTaDashboard(chromium,report,date,taTimeout,report.retries));
      } else {
        console.log('正在读取数数每日累计指标');
        ta = previewCsv ? parseTaHourly(await fs.readFile(previewCsv,'utf8'),date)
          : await readTaHourly(chromium,report.taUrl,date,taTimeout,report.retries);
        if (mediaUrl) {
          console.log('正在读取数数分媒体买量指标');
          paidTa = await readTaHourly(chromium,mediaUrl,date,taTimeout,report.retries,parseTaPaidHourly);
        }
      }
      if (fromMedia && !paidTa) console.warn('数数分媒体当日没有非自然量记录，买量注册和付费相关字段留空');
      if (day() !== runDay) throw new Error('取数期间跨过北京时间日期');
      const period = previewCsv ? '数数导出快照' : externalPeriod(cutoffHour);
      const snapshot = {date,time,period,ta,gravity:data,projectName:project.name,
        ...(fromMedia ? {paidTa} : {})};
      const png = preview ? await writeExternalHourly(snapshot,output,deps)
        : await updateExternalHourly(snapshot,output,deps,archive,config.schedule.startAt,retentions ?? previousRetention);
      console.log(output);
      if (webhook) await sendWeComReport(webhook,png,title,delivery);
      return;
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
      preview||Boolean(webhook),project.name,hour,kind,report.metrics,report.layout,report.spendUnit,fullDay);
    console.log(output);
    if (preview) await fs.writeFile(output.slice(0,-5)+'.png',screenshot);
    if (webhook) {
      const [year,month,dayOfMonth] = date.split('-');
      const reportName = (kind === 'iaa' ? 'IAA ' : '')+(fullDay ? '全天汇总' : '小时报');
      await sendWeComReport(webhook,screenshot,'【'+project.name+'】'+year+'年'+month+'月'+dayOfMonth+'日'+(fullDay?'24':hour)+'时 - '+reportName);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromCli(process.env.GRAVITY_REPORT_KIND ?? 'gravity');
}
