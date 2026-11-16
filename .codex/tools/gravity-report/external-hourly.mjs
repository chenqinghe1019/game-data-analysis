import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const taColumns = ['累计新进','累计活跃','累计付费人数','累计收入','当前 ARPU','付费率','付费次留','注册次留',
  '首日付费玩家人均付费频次','首日付费玩家数'];
export const externalWorkbookName = '外部小时报_累计.xlsx';

export function externalPeriod(hour) {
  return '截至北京时间 '+Number(hour)+' 点';
}

export function parseTaHourly(csv, date) {
  const rows = csv.replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/).map(line=>
    line.split(',').map(cell=>cell.trim().replace(/^"(.*)"$/,'$1')));
  const [headers,...data] = rows;
  const indexes = ['日期',...taColumns].map(label=>{
    const index = headers.indexOf(label);
    if (index === -1 || index !== headers.lastIndexOf(label)) throw new Error('数数指标列缺失或重复：'+label);
    return index;
  });
  const matches = data.filter(row=>row[indexes[0]] === date);
  if (matches.length !== 1) throw new Error('数数查询结果没有唯一的 '+date+' 数据行');
  if (matches[0].length !== headers.length) throw new Error('数数目标日期的数据列不完整');
  const values = indexes.slice(1).map(index=>{
    const value = matches[0][index];
    if (value === '') return null;
    const numeric = Number(value);
    if (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(numeric)) {
      throw new Error('数数指标不是有效的非负数：'+headers[index]);
    }
    return numeric;
  });
  const [newUsers,active,payers,revenue,arpu,payRate,payerRetention,registrationRetention,firstDayFrequency,firstDayPayers] = values;
  if (![newUsers,active,payers].every(Number.isSafeInteger) || revenue === null) {
    throw new Error('数数新进、活跃、付费人数或收入缺失，或人数不是整数');
  }
  if (active === 0 ? arpu !== null || payRate !== null :
      arpu === null || payRate === null || Math.abs(arpu-revenue/active) > 0.0051+0.005/active ||
      Math.abs(payRate-payers/active) > 0.0000501) {
    throw new Error('数数 ARPU 或付费率与当日基础指标不一致');
  }
  if ([payerRetention,registrationRetention].some(value=>value !== null && value > 1)) {
    throw new Error('数数次留比例超出 0% 至 100%');
  }
  if (!Number.isSafeInteger(firstDayPayers) || firstDayPayers > Math.min(newUsers,payers) ||
      (firstDayPayers === 0 ? firstDayFrequency !== null : firstDayFrequency === null || firstDayFrequency < 1)) {
    throw new Error('数数首日付费玩家数与付费频次不一致');
  }
  return values.slice(0,-1);
}

export async function readTaHourly(chromium, url, date, timeout, retries) {
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9223',{timeout:Math.min(timeout,10_000)});
  } catch {
    throw new Error('数数 Chrome 未连接，请启动数数专用 Chrome 并登录');
  }
  let page;
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error('数数 Chrome 没有可用会话');
    page = await context.newPage();
    page.setDefaultTimeout(timeout);
    for (let attempt=0;attempt<=retries;attempt++) {
      try {
        if (attempt && page.url() === url) await page.reload({waitUntil:'commit',timeout});
        else await page.goto(url,{waitUntil:'commit',timeout});
        const calculate = page.getByRole('button',{name:'计算',exact:true});
        const result = page.getByRole('tabpanel',{name:'查询结果'});
        const queryId = result.getByText(/^SQL_ID[：:]\s*\d{8}_\d{6}_[\w-]+$/).filter({visible:true});
        const queryError = result.getByText(/SQLException|查询失败|计算失败/).filter({visible:true});
        const download = result.getByRole('button',{name:'全量下载',exact:true});
        await calculate.waitFor({timeout:Math.min(timeout,30_000)});
        if (page.url() !== url) throw new Error('数数未进入指定查询，请检查登录状态和报表权限');
        const previous = await queryId.isVisible() ? await queryId.innerText() : '';
        await calculate.click();
        const fresh = previous ? queryId.filter({hasNotText:previous}) : queryId;
        // The query engine can legitimately queue requests longer than normal report loads.
        await fresh.or(queryError).first().waitFor({timeout:Math.max(timeout,300_000)});
        if (!await fresh.isVisible()) throw new Error('数数查询失败：'+await queryError.first().innerText());
        const completed = await fresh.innerText();
        const [file] = await Promise.all([page.waitForEvent('download',{timeout}),download.click()]);
        const filename = await file.path();
        if (!filename || !await fresh.isVisible() || await fresh.innerText() !== completed) {
          throw new Error('数数下载未对应本次查询结果');
        }
        return parseTaHourly(await fs.readFile(filename,'utf8'),date);
      } catch (error) {
        if (attempt === retries) throw error;
        console.warn('数数取数失败，重新加载查询后重试：'+error.message.split('\n')[0]);
      }
    }
  } finally {
    if (page) await page.close().catch(()=>{});
    await browser.close();
  }
}

export async function updateExternalHourly(snapshot, output, deps, archive, startAt = '') {
  const {date,time} = snapshot;
  if (date+'T'+time < startAt) throw new Error('该快照早于外部小时报的正式首报时点');
  const [firstDate,firstTime=''] = startAt.split('T');
  const {DatabaseSync} = await import('node:sqlite');
  await fs.mkdir(path.dirname(archive),{recursive:true});
  const db = new DatabaseSync(archive);
  try {
    db.exec(`PRAGMA busy_timeout=30000;
      CREATE TABLE IF NOT EXISTS snapshots (date TEXT, time TEXT, payload TEXT NOT NULL, PRIMARY KEY(date,time))`);
    db.prepare(`INSERT INTO snapshots VALUES (?, ?, ?) ON CONFLICT(date,time) DO UPDATE SET payload=excluded.payload`)
      .run(date,time,JSON.stringify(snapshot));
    // Keep the saved snapshot even if Excel has the destination file open.
    // Serialize workbook replacements so an older export cannot replace a newer one.
    db.exec('BEGIN IMMEDIATE');
    const rows = db.prepare('SELECT payload FROM snapshots WHERE (date,time) >= (?,?) ORDER BY date,time')
      .all(firstDate,firstTime).map(({payload})=>JSON.parse(payload));
    const png = await writeExternalHourly(snapshot,output,deps,rows);
    db.exec('COMMIT');
    return png;
  } finally {
    db.close();
  }
}

export async function writeExternalHourly(snapshot, output, deps, snapshots = [snapshot]) {
  const require = createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile} = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
  const latestDate = snapshots.reduce((latest,row)=>row.date > latest ? row.date : latest,snapshot.date);
  const settledDates = new Set(snapshots.filter(row=>row.time === '24:00').map(row=>row.date));
  const visible = snapshots.filter(row=>row.time === '24:00' ||
    (row.date === latestDate && !settledDates.has(row.date)));
  const previousDate = new Date(Date.parse(snapshot.date+'T00:00:00Z')-86_400_000).toISOString().slice(0,10);
  const daily = visible.filter(row=>row.date === snapshot.date ||
    (snapshot.time !== '24:00' && row.date === previousDate && row.time === '24:00'));
  const all = buildExternalWorkbook(Workbook,visible,snapshot);
  const preview = daily.length === visible.length ? all : buildExternalWorkbook(Workbook,daily,snapshot);
  const png = Buffer.from(await (await preview.render({sheetName:'外部小时报',range:'A1:R'+(daily.length+5),headers:false,scale:1})).arrayBuffer());
  await fs.mkdir(path.dirname(output),{recursive:true});
  const pending = output.slice(0,-5)+'.'+randomUUID()+'.xlsx';
  try {
    await (await SpreadsheetFile.exportXlsx(all)).save(pending);
    await fs.rename(pending,output);
  } catch (error) {
    if (['EBUSY','EPERM','EACCES'].includes(error.code)) throw new Error('无法更新累计 Excel。请关闭正在打开的文件后重试。',{cause:error});
    throw error;
  } finally {
    await fs.rm(pending,{force:true});
    await fs.rm(pending+'.inspect.ndjson',{force:true});
  }
  await fs.writeFile(output.slice(0,-5)+'.png',png);
  return png;
}

function buildExternalWorkbook(Workbook, snapshots, {gravity,projectName,template=false}) {
  const wb = Workbook.create();
  const sheet = wb.worksheets.add('外部小时报');
  sheet.showGridLines = false;
  const merged = (address,text) => {
    sheet.getRange(address).merge();
    sheet.getRange(address.split(':')[0]).values = [[text]];
  };
  merged('A1:R1',projectName+'｜外部小时报');
  for (const [address,label] of [
    ['A2:B2','时间'],['C2:E2','用户数'],['F2:H2','收入'],['I2:N2','买量'],['O2:P2','ROI'],['Q2:R2','留存'],
  ]) merged(address,label);
  const last = snapshots.length+3;
  const footer = last+2;
  sheet.getRange('A3:R'+last).values = [
    ['日期','时间段','累计新进','累计活跃','累计付费','累计收入','当前 ARPU','付费率',
      '累计消耗','累计广告曝光','累计注册转化','人均注册成本','人均付费成本','新增首日人均付费次数',
      'ROI1','ROI(含自然量)','实时付费次留','实时注册次留'],
    ...snapshots.map(({date,period,ta,gravity:{paid,total}})=>{
      const hasTaFrequency = ta.length>8;
      const payCost = hasTaFrequency ? (paid && ta[2]>0 ? paid.spend/ta[2] : null) : paid?.payCost ?? null;
      return [
        date,period.replace(/^截至北京时间 (\d{2}):\d{2}$/,(_,hour)=>externalPeriod(hour)),
        ...ta.slice(0,6),paid?.spend ?? null,paid?.impressions ?? null,paid?.tencentRegistrations ?? null,
        paid?.tencentRegistrations === undefined ? null : paid.registrationCost,
        payCost,hasTaFrequency ? ta[8] : paid?.frequency ?? null,
        paid?.roi ?? null,total?.roi ?? null,ta[6],ta[7],
      ];
    }),
  ];
  for (let start=0;start<snapshots.length;) {
    let end=start+1;
    while (end<snapshots.length && snapshots[end].date === snapshots[start].date) end++;
    if (end>start+1) merged('A'+(start+4)+':A'+(end+3),snapshots[start].date);
    start=end;
  }
  const {paid,total} = gravity;
  const sourceNote = '经营、留存与首日付费频次取数数。人均付费成本按非自然量消耗 ÷ 数数累计付费人数计算。ROI(含自然量) 取引力项目合计。历史日期仅显示 24 点汇总。';
  const missingNote = template ? ' 格式预览，数据待取。统计窗口从当天 00:00 开始。'
    : !total ? ' 本次取数时引力当日无记录。' : !paid ? ' 本次取数时引力当日无非自然量记录。' : '';
  const legacyNote = snapshots.some(row=>row.gravity.paid && row.gravity.paid.tencentRegistrations === undefined)
    ? ' 旧口径的注册指标留空。' : '';
  const oldPaymentNote = snapshots.some(row=>row.ta.length<=8 && row.gravity.paid)
    ? ' 旧版快照的付费成本与频次保留归档值。' : '';
  merged('A'+footer+':R'+footer,sourceNote+missingNote+legacyNote+oldPaymentNote);
  const all = sheet.getRange('A1:R'+footer);
  all.format.font = {name:'Microsoft YaHei',size:11,color:'#223046'};
  all.format.rowHeight = 26;
  all.format.verticalAlignment = 'center';
  const title = sheet.getRange('A1:R1');
  title.format.fill = '#EAF2FF';
  title.format.font = {name:'Microsoft YaHei',size:15,bold:true,color:'#163761'};
  title.format.rowHeight = 34;
  const table = sheet.getRange('A2:R'+last);
  table.format.horizontalAlignment = 'center';
  table.format.borders = {preset:'all',style:'thin',color:'#C2CBD5'};
  const header = sheet.getRange('A2:R3');
  header.format.fill = '#414141';
  header.format.font = {name:'Microsoft YaHei',size:11,bold:true,color:'#FFFFFF'};
  header.format.rowHeight = 30;
  sheet.getRange('A4:R'+last).format.fill = '#F3F7FC';
  for (const column of ['F','G','I','L','M','N']) sheet.getRange(column+'4:'+column+last).setNumberFormat('#,##0.00');
  for (const column of ['H','O','P','Q','R']) sheet.getRange(column+'4:'+column+last).setNumberFormat('0.00%');
  for (const column of ['C','D','E','J','K']) sheet.getRange(column+'4:'+column+last).setNumberFormat('#,##0');
  [105,150,84,84,84,90,91,72,90,110,110,112,112,181,70,120,109,109].forEach((width,index)=>{
    const column = String.fromCharCode(65+index);
    sheet.getRange(column+':'+column).format.columnWidthPx = width;
  });
  return wb;
}
