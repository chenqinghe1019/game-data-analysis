import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';

const taColumns = ['累计新进','累计活跃','累计付费人数','累计收入','当前 ARPU','付费率','付费次留','注册次留',
  '首日付费玩家人均付费频次','首日付费玩家数'];
export const externalWorkbookName = '外部小时报_累计.xlsx';
const tenThousands = new Intl.NumberFormat('zh-CN',{useGrouping:false,minimumFractionDigits:1,maximumFractionDigits:1});

function displayAmount(value) {
  if (value == null) return null;
  return value >= 10_000 ? tenThousands.format(value/10_000)+'万' : value;
}

export function externalPeriod(hour) {
  return '截至北京时间 '+Number(hour)+' 点';
}

function readTaDate(csv, date, labels, optionalDate = false) {
  const rows = csv.replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/).map(line=>
    line.split(',').map(cell=>cell.trim().replace(/^"(.*)"$/,'$1')));
  const [headers,...data] = rows;
  const indexes = ['日期',...labels].map(label=>{
    const index = headers.indexOf(label);
    if (index === -1 || index !== headers.lastIndexOf(label)) throw new Error('数数指标列缺失或重复：'+label);
    return index;
  });
  const matches = data.filter(row=>row[indexes[0]] === date);
  if ((!optionalDate && !matches.length) || matches.some(row=>row.length !== headers.length)) {
    throw new Error('数数缺少完整的 '+date+' 数据');
  }
  return matches.map(row=>indexes.slice(1).map(index=>row[index]));
}

function taNumber(value,label) {
  if (value === '') return null;
  const numeric = Number(value);
  if (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(numeric)) {
    throw new Error('数数指标不是有效的非负数：'+label);
  }
  return numeric;
}

export function parseTaHourly(csv, date, {includeFirstDayAmount=false,optionalDate=false} = {}) {
  const labels=includeFirstDayAmount ? [...taColumns,'首日付费金额'] : taColumns;
  const matches = readTaDate(csv,date,labels,optionalDate);
  if (!matches.length) return null;
  if (matches.length !== 1) throw new Error('数数查询结果没有唯一的 '+date+' 数据行');
  const values = matches[0].map((value,index)=>taNumber(value,labels[index]));
  const [newUsers,active,payers,revenue,arpu,payRate,payerRetention,registrationRetention,firstDayFrequency,firstDayPayers,firstDayAmount] = values;
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
  if (includeFirstDayAmount && (firstDayAmount === null || firstDayAmount > revenue+0.01 ||
      (firstDayPayers === 0 && firstDayAmount !== 0))) {
    throw new Error('数数首日付费金额缺失或与累计收入、首日付费人数不一致');
  }
  return includeFirstDayAmount ? [...values.slice(0,9),firstDayAmount] : values.slice(0,9);
}

function shiftDate(date,days) {
  return new Date(Date.parse(date+'T00:00:00Z')+days*86_400_000).toISOString().slice(0,10);
}

export function parseTaPaidHourly(csv,date) {
  const labels = ['媒体','累计新进','累计付费人数','首日付费玩家数','首日付费玩家人均付费频次'];
  const seen = new Set();
  let registrations=0, payers=0, newPayers=0, minEvents=0, maxEvents=0;
  for (const [media,...values] of readTaDate(csv,date,labels)) {
    const name = media.trim();
    if (!name || seen.has(name)) throw new Error('数数分媒体结果存在空白或重复媒体');
    seen.add(name);
    if (name === '自然量') continue;
    const [newUsers,paid,firstDayPayers,frequency] = values.map((value,index)=>taNumber(value,labels[index+1]));
    if (![newUsers,paid,firstDayPayers].every(Number.isSafeInteger) ||
        firstDayPayers > Math.min(newUsers,paid) ||
        (firstDayPayers === 0 ? frequency !== null : frequency === null || frequency < 1)) {
      throw new Error('数数分媒体人数或首日付费频次校验失败：'+name);
    }
    registrations += newUsers;
    payers += paid;
    newPayers += firstDayPayers;
    if (firstDayPayers) {
      // TA rounds each media rate to two decimals. Recover the range of possible integer event counts.
      const cents = Math.round(frequency*100);
      const min = Math.max(firstDayPayers,Math.ceil((2*cents-1)*firstDayPayers/200));
      const max = Math.ceil((2*cents+1)*firstDayPayers/200)-1;
      if (max < min) throw new Error('数数分媒体首日付费频次与人数不一致：'+name);
      minEvents += min;
      maxEvents += max;
    }
  }
  if ([...seen].every(name=>name === '自然量')) return null;
  const minRate = newPayers ? Math.round(minEvents*100/newPayers)/100 : null;
  const maxRate = newPayers ? Math.round(maxEvents*100/newPayers)/100 : null;
  return {registrations,payers,firstDayPayers:newPayers,firstDayFrequency:minRate === maxRate ? minRate : null,
    ambiguousFrequency:minRate !== maxRate};
}

async function connectTaBrowser(chromium,timeout) {
  const endpoint='http://127.0.0.1:9223';
  try {
    return await chromium.connectOverCDP(endpoint,{timeout:Math.min(timeout,5000)});
  } catch {
    console.warn('数数 Chrome 未连接，正在启动专用浏览器');
  }
  try {
    const bundled=path.resolve(path.dirname(process.execPath),'../../native/powershell/pwsh.exe');
    const powershell=await fs.access(bundled).then(()=>bundled,()=> 'pwsh.exe');
    await promisify(execFile)(powershell,['-NoProfile','-NonInteractive','-File',
      fileURLToPath(new URL('./start-external-ta.ps1',import.meta.url)),'-Background'],
    {windowsHide:true,timeout:15_000});
  } catch (error) {
    throw new Error('数数专用 Chrome 无法启动',{cause:error});
  }
  const deadline=Date.now()+20_000;
  while (Date.now()<deadline) {
    try { return await chromium.connectOverCDP(endpoint,{timeout:3000}); }
    catch { await delay(1000); }
  }
  throw new Error('数数专用 Chrome 启动后仍未连接');
}

export async function readTaHourly(chromium, url, date, timeout, retries, parse = parseTaHourly) {
  const browser=await connectTaBrowser(chromium,timeout);
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
        return parse(await fs.readFile(filename,'utf8'),date);
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

export async function readTaDashboard(chromium, report, date, timeout, retries) {
  const browser=await connectTaBrowser(chromium,timeout);
  let page;
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error('数数 Chrome 没有可用会话');
    page = await context.newPage();
    await page.bringToFront();
    page.setDefaultTimeout(timeout);
    for (let attempt=0;attempt<=retries;attempt++) {
      try {
        await page.goto(report.taPanelUrl,{waitUntil:'domcontentloaded',timeout});
        const query=page.getByRole('button',{name:'查询',exact:true});
        await query.waitFor({timeout:Math.min(timeout,30_000)});
        if (page.url() !== report.taPanelUrl) throw new Error('数数未进入指定看板');
        // Query using the dashboard's saved filters, then export each card's own current results.
        await query.click();
        const results=[];
        for (const name of [report.taTotalCard,report.taMediaCard]) {
          const card=page.getByTestId(/^panel-report-card-\d+$/)
            .filter({has:page.getByRole('link',{name,exact:true})});
          await card.waitFor({timeout:Math.min(timeout,30_000)});
          await card.locator('canvas').first().waitFor({timeout});
          const refreshedAt=Date.now();
          await card.hover();
          const refresh=card.getByTestId(/--header--refresh-btn$/);
          await refresh.click();
          await refresh.hover();
          let nextHover=Date.now()+5000;
          while (true) {
            const pageText=await page.locator('body').innerText();
            const time=pageText.match(/最后更新时间[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1];
            const updatedAt=Date.parse(time?.replace(/\s+/,'T')+'+08:00');
            if (updatedAt>=refreshedAt-3000) break;
            if (Date.now()-refreshedAt>=timeout) {
              throw new Error('看板卡片「'+name+'」未更新到本次查询时间'+(time ? '（'+time+'）' : ''));
            }
            if (!time && Date.now()>=nextHover) {
              await card.getByRole('link',{name,exact:true}).hover();
              await refresh.hover();
              nextHover=Date.now()+5000;
            }
            await page.waitForTimeout(1000);
          }
          await card.getByTestId(/--header--more-menu-btn$/).click();
          const item=page.getByRole('menuitem',{name:'数据导出',exact:true}).filter({visible:true});
          const [download]=await Promise.all([page.waitForEvent('download',{timeout}),item.click()]);
          const filename=await download.path();
          if (!filename || !download.suggestedFilename().toLowerCase().endsWith('.csv')) {
            throw new Error('看板卡片「'+name+'」没有导出 CSV');
          }
          results.push(await fs.readFile(filename,'utf8'));
        }
        const previousDate=shiftDate(date,-1);
        const previous= parseTaHourly(results[0],previousDate,{optionalDate:true});
        return {ta:parseTaHourly(results[0],date,{includeFirstDayAmount:true}),
          paidTa:parseTaPaidHourly(results[1],date),
          previousRetention:previous ? {date:previousDate,payer:previous[6],registration:previous[7]} : undefined};
      } catch (error) {
        if (attempt === retries) throw error;
        console.warn('数数看板取数失败，重新打开看板后重试：'+error.message.split('\n')[0]);
      }
    }
  } finally {
    if (page) await page.close().catch(()=>{});
    await browser.close();
  }
}

export async function updateExternalHourly(snapshot, output, deps, archive, startAt = '', previousRetention) {
  const {date,time} = snapshot;
  if (!snapshot.baseline && date+'T'+time < startAt) throw new Error('该快照早于外部小时报的正式首报时点');
  const [firstDate,firstTime=''] = startAt.split('T');
  const {DatabaseSync} = await import('node:sqlite');
  await fs.mkdir(path.dirname(archive),{recursive:true});
  const db = new DatabaseSync(archive);
  try {
    db.exec(`PRAGMA busy_timeout=30000;
      CREATE TABLE IF NOT EXISTS snapshots (date TEXT, time TEXT, payload TEXT NOT NULL, PRIMARY KEY(date,time))`);
    db.exec('BEGIN IMMEDIATE');
    if (time === '24:00' && !snapshot.baseline) {
      const prior=db.prepare("SELECT payload FROM snapshots WHERE date=? AND time='24:00'").get(date);
      if (prior && JSON.parse(prior.payload).baseline) throw new Error('该日期的 24 点行已设为底档');
    }
    const save=db.prepare(`INSERT INTO snapshots VALUES (?, ?, ?) ON CONFLICT(date,time) DO UPDATE SET payload=excluded.payload`);
    save.run(date,time,JSON.stringify(snapshot));
    if (previousRetention) {
      const {date:priorDate,payer,registration}=previousRetention;
      const previous=db.prepare("SELECT payload FROM snapshots WHERE date=? AND time='24:00'").get(priorDate);
      if (previous && (payer != null || registration != null)) {
        const row=JSON.parse(previous.payload);
        row.ta[6]=payer ?? row.ta[6];
        row.ta[7]=registration ?? row.ta[7];
        save.run(priorDate,'24:00',JSON.stringify(row));
      }
    }
    // Keep the saved snapshot even if Excel has the destination file open.
    // Serialize workbook replacements so an older export cannot replace a newer one.
    db.exec('COMMIT');
    db.exec('BEGIN IMMEDIATE');
    const current = db.prepare(`SELECT payload FROM snapshots WHERE (date,time) >= (?,?)
      OR json_extract(payload,'$.baseline')=1 ORDER BY date,time`).all(firstDate,firstTime)
      .map(({payload})=>JSON.parse(payload));
    const png = await writeExternalHourly(snapshot,output,deps,current);
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
  const baseline = snapshots.find(row=>row.baseline);
  const visible = snapshots.filter(row=>
    (!baseline || row.date > baseline.date || (row.date === baseline.date && row.time >= baseline.time)) &&
    (row.time === '24:00' || row.date === latestDate));
  const previousDate=shiftDate(snapshot.date,-1);
  const daily = visible.filter(row=>row.date === snapshot.date || (row.date === previousDate && row.time === '24:00'));
  const totals=externalTotals(visible,baseline);
  const all = buildExternalWorkbook(Workbook,visible,snapshot,totals);
  const preview = daily.length === visible.length ? all : buildExternalWorkbook(Workbook,daily,snapshot,totals);
  const png = Buffer.from(await (await preview.render({sheetName:'外部小时报',range:'A1:V'+(daily.length+4),headers:false,scale:1})).arrayBuffer());
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

function externalTotals(rows,baseline) {
  const daily = row=>[row.ta[0],row.ta[3],row.gravity.paid?.spend ?? (row.gravity.total ? 0 : null)];
  const closed = new Map(rows.filter(row=>row.time === '24:00').map(row=>[row.date,daily(row)]));
  const totals = new Map();
  if (!baseline) return totals;
  let sum=[0,0,0];
  let date=baseline.date;
  for (const row of rows) {
    while (date < row.date) {
      const final=closed.get(date) ?? [];
      sum=sum.map((value,i)=>Number.isFinite(value) && Number.isFinite(final[i]) ? value+final[i] : null);
      date=shiftDate(date,1);
    }
    totals.set(row,sum.map((value,i)=>Number.isFinite(value) && Number.isFinite(daily(row)[i]) ? value+daily(row)[i] : null));
  }
  return totals;
}

function buildExternalWorkbook(Workbook, snapshots, {projectName}, totals) {
  const wb = Workbook.create();
  const sheet = wb.worksheets.add('外部小时报');
  sheet.showGridLines = false;
  const merged = (address,text) => {
    sheet.getRange(address).merge();
    sheet.getRange(address.split(':')[0]).values = [[text]];
  };
  merged('A1:V1',projectName+'｜外部小时报');
  for (const [address,label] of [
    ['A2:B2','时间'],['C2:F2','用户'],['G2:L2','付费'],['M2:R2','买量'],['S2:T2','ROI'],['U2:V2','留存'],
  ]) merged(address,label);
  merged('A3:A4','日期');
  merged('B3:B4','时间段');
  sheet.getRange('C3:V4').values=[
    ['当日累计新进','当日累计活跃','当日累计付费','总累计新进','当日累计收入','当前 ARPU','付费率',
      '新增首日人均\n付费次数','新增首日付费\n金额','总累计收入','累计消耗','累计广告曝光','累计注册转化',
      '人均注册成本','人均付费成本','总累计消耗','ROI1\n（纯买量）','ROI1\n（含自然量）','实时付费次留','实时注册次留'],
    ['当日新进人数','当日活跃人数','当日付费人数','自 16 日累计','当日 IAP 收入','收入 ÷ 活跃','付费人数 ÷ 活跃',
      '新增付费次数 ÷\n新增付费人数','新增用户\n首日付费额','自 16 日累计','当日买量消耗','广告曝光次数','买量注册人数',
      '消耗 ÷ 买量注册','消耗 ÷ 首日付费人数\n（仅媒体）','自 16 日累计',null,null,null,null],
  ];
  const last = snapshots.length+4;
  if (snapshots.length) sheet.getRange('A5:V'+last).values = snapshots.map(row=>{
      const {date,period,ta,paidTa,gravity:{paid,total}}=row;
      const [newUsers,active,payers,revenue,arpu,payRate,payerRetention,registrationRetention,frequency,firstDayAmount]=ta;
      const [totalNew,totalRevenue,totalSpend]=totals.get(row) ?? [null,null,null];
      const registrations = paidTa === undefined ? paid?.tencentRegistrations : paidTa?.registrations;
      const spend=paid?.spend ?? null;
      const costPayers=row.baseline ? payers : paidTa?.firstDayPayers;
      return [
        date,period.replace(/^截至北京时间 (\d{2}):\d{2}$/,(_,hour)=>externalPeriod(hour)),
        newUsers,active,payers,totalNew,displayAmount(revenue),arpu,payRate,frequency ?? null,
        displayAmount(firstDayAmount),displayAmount(totalRevenue),
        displayAmount(spend),paid?.impressions ?? null,registrations ?? null,
        spend !== null && registrations>0 ? spend/registrations : null,
        spend !== null && costPayers>0 ? spend/costPayers : null,displayAmount(totalSpend),
        paid?.roi ?? '-',total?.roi ?? '-',payerRetention ?? '-',registrationRetention ?? '-',
      ];
    });
  for (let start=0;start<snapshots.length;) {
    let end=start+1;
    while (end<snapshots.length && snapshots[end].date === snapshots[start].date) end++;
    if (end>start+1) merged('A'+(start+5)+':A'+(end+4),snapshots[start].date);
    start=end;
  }
  const all = sheet.getRange('A1:V'+last);
  all.format.font = {name:'Microsoft YaHei',size:11,color:'#223046'};
  all.format.rowHeight = 26;
  all.format.verticalAlignment = 'center';
  const title = sheet.getRange('A1:V1');
  title.format.fill = '#EFF6FC';
  title.format.font = {name:'Microsoft YaHei',size:15,bold:true,color:'#163761'};
  title.format.rowHeight = 34;
  const table = sheet.getRange('A2:V'+last);
  table.format.horizontalAlignment = 'center';
  table.format.borders = {preset:'all',style:'thin',color:'#C2CBD5'};
  const header = sheet.getRange('A2:V3');
  sheet.getRange('A2:V2').format.fill = '#00A5E6';
  sheet.getRange('A3:V4').format.fill = '#7DBFE7';
  header.format.font = {name:'Microsoft YaHei',size:11,bold:true,color:'#FFFFFF'};
  sheet.getRange('A3:V4').format.wrapText = true;
  sheet.getRange('A3:V4').format.rowHeightPx = 38;
  sheet.getRange('A4:V4').format.font = {name:'Microsoft YaHei',size:9,color:'#173B56'};
  if (snapshots.length) {
    sheet.getRange('A5:V'+last).format.fill = '#FFFFFF';
    snapshots.forEach((row,index)=>{
      if (row.baseline) for (const column of ['O','Q']) sheet.getRange(column+(index+5)).format.fill='#90DDF5';
    });
    for (const column of ['H','J','P','Q']) sheet.getRange(column+'5:'+column+last).setNumberFormat('#,##0.00');
    for (const column of ['I','S','T','U','V']) sheet.getRange(column+'5:'+column+last).setNumberFormat('0.00%');
    for (const column of ['C','D','E','F','G','K','L','M','N','O','R']) sheet.getRange(column+'5:'+column+last).setNumberFormat('#,##0');
  }
  [105,150,108,108,108,103,111,94,78,112,112,105,105,112,112,115,120,105,92,98,108,108].forEach((width,index)=>{
    const column = String.fromCharCode(65+index);
    sheet.getRange(column+':'+column).format.columnWidthPx = width;
  });
  return wb;
}
