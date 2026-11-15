import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const taColumns = ['累计新进','累计活跃','累计付费人数','累计收入','当前 ARPU','付费率','付费次留','注册次留'];

export function parseTaHourly(csv, date) {
  const rows = csv.replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/).map(line=>
    line.split(',').map(cell=>cell.trim().replace(/^"(.*)"$/,'$1')));
  const [headers,...data] = rows;
  const indexes = ['日期',...taColumns].map(label=>headers.indexOf(label));
  if (indexes.includes(-1)) throw new Error('数数查询结果缺少小时报所需列');
  const matches = data.filter(row=>row[indexes[0]] === date);
  if (matches.length !== 1) throw new Error('数数查询结果没有唯一的 '+date+' 数据行');
  return indexes.slice(1).map(index=>{
    const value = matches[0][index];
    if (value === '') return null;
    if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error('数数指标不是有效数值：'+headers[index]);
    return Number(value);
  });
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
        const queryId = result.getByText(/^SQL_ID[：:]/);
        const download = result.getByRole('button',{name:'全量下载',exact:true});
        await calculate.waitFor({timeout:Math.min(timeout,30_000)});
        if (page.url() !== url) throw new Error('数数未进入指定查询，请检查登录状态和报表权限');
        await queryId.or(download).first().waitFor({timeout});
        const previous = await queryId.count() ? await queryId.innerText() : '';
        await calculate.click();
        await (previous ? queryId.filter({hasNotText:previous}) : queryId).waitFor({timeout});
        const [file] = await Promise.all([page.waitForEvent('download',{timeout}),download.click()]);
        return parseTaHourly(await fs.readFile(await file.path(),'utf8'),date);
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

export async function writeExternalHourly({date,period,ta,gravity,projectName}, output, deps) {
  const require = createRequire(path.join(deps,'package.json'));
  const {Workbook,SpreadsheetFile} = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
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
  const {paid,total} = gravity;
  sheet.getRange('A3:R4').values = [
    ['日期','时间段','累计新进','累计活跃','累计付费','累计收入','当前 ARPU','付费率',
      '累计消耗','累计广告曝光','累计注册转化','人均注册成本','人均付费成本','新增首日人均付费次数',
      'ROI1','ROI(含自然量)','实时付费次留','实时注册次留'],
    [date,period,...ta.slice(0,6),paid?.spend ?? null,paid?.impressions ?? null,paid?.registrations ?? null,
      paid?.registrationCost ?? null,paid?.payCost ?? null,paid?.frequency ?? null,
      paid?.roi ?? null,total?.roi ?? null,ta[6],ta[7]],
  ];
  const sourceNote = '经营与留存取数数同日行。买量和 ROI1 取引力非自然量。ROI(含自然量) 取引力项目合计。';
  const missingNote = !total ? ' 引力当日无记录。' : !paid ? ' 引力当日无非自然量记录。' : '';
  merged('A6:R6',sourceNote+missingNote);
  const all = sheet.getRange('A1:R6');
  all.format.font = {name:'Microsoft YaHei',size:11,color:'#223046'};
  all.format.rowHeight = 26;
  all.format.verticalAlignment = 'center';
  const title = sheet.getRange('A1:R1');
  title.format.fill = '#EAF2FF';
  title.format.font = {name:'Microsoft YaHei',size:15,bold:true,color:'#163761'};
  title.format.rowHeight = 34;
  const table = sheet.getRange('A2:R4');
  table.format.horizontalAlignment = 'center';
  table.format.borders = {preset:'all',style:'thin',color:'#C2CBD5'};
  const header = sheet.getRange('A2:R3');
  header.format.fill = '#414141';
  header.format.font = {name:'Microsoft YaHei',size:11,bold:true,color:'#FFFFFF'};
  header.format.rowHeight = 30;
  sheet.getRange('A4:R4').format.fill = '#F3F7FC';
  for (const column of ['F','G','I','L','M','N']) sheet.getRange(column+'4').setNumberFormat('#,##0.00');
  for (const column of ['H','O','P','Q','R']) sheet.getRange(column+'4').setNumberFormat('0.00%');
  for (const column of ['C','D','E','J','K']) sheet.getRange(column+'4').setNumberFormat('#,##0');
  [105,110,84,84,84,90,91,72,90,110,110,112,112,181,70,120,109,109].forEach((width,index)=>{
    const column = String.fromCharCode(65+index);
    sheet.getRange(column+':'+column).format.columnWidthPx = width;
  });
  const png = Buffer.from(await (await wb.render({sheetName:'外部小时报',range:'A1:R6',headers:false,scale:1})).arrayBuffer());
  await fs.mkdir(path.dirname(output),{recursive:true});
  await (await SpreadsheetFile.exportXlsx(wb)).save(output);
  await fs.writeFile(output.slice(0,-5)+'.png',png);
  return png;
}
