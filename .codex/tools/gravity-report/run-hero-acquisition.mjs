import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadConfig,heroConfigPath} from './config.mjs';
import {openReport,selectReportProduct,refreshReport,collect} from './run.mjs';
import {readAcquisitionCards} from './hero-acquisition-source.mjs';
import {aggregateAcquisition,appendAcquisition} from './hero-acquisition.mjs';
import {readConversionDashboard} from './hero-conversion-source.mjs';
import {conversionDefaults} from './hero-conversion.mjs';
import {appendConversionHistory} from './hero-conversion-history.mjs';
import {readWebhook} from './webhook.mjs';
import {externalDelivery} from './external-retry.mjs';
import {sendImageBatch} from './wecom-image-batch.mjs';

async function captureGravity(chromium,config,date) {
  const browser=await chromium.launchPersistentContext(path.join(process.env.LOCALAPPDATA,'GravityWeComReport/Chrome'),
    {channel:'chrome',headless:config.report.browserMode === 'headless',viewport:{width:1600,height:1000}});
  try {
    const page=browser.pages()[0] ?? await browser.newPage();
    for(let attempt=0;attempt<=config.report.retries;attempt++) {
      try {
        await openReport(page,config.report,'hero',attempt>0);
        await selectReportProduct(page,config.report);
        const source=await refreshReport(page,date,config.report.timeoutSeconds*1000,config.report.product,'external',config.report.productAppId);
        const data=await collect(page,config,date,source);
        return {date,project:config.project.name,rollups:data,observedAt:new Date().toISOString()};
      } catch(error) {if(attempt===config.report.retries) throw error;console.warn('引力重新加载后重试：'+error.message.split('\n')[0]);}
    }
  } finally {await browser.close();}
}

export function gravityMetrics(source,date) {
  if(source.date!==date || source.project!=='英雄就是我') throw new Error('引力日期或项目不一致');
  if(source.rollups) {
    const {paid,total}=source.rollups;
    if(!paid || !total || ![paid.spend,paid.roi,total.spend,total.roi].every(value=>Number.isFinite(value) && value>=0) || Math.abs(paid.spend-total.spend)>0.01) throw new Error('引力买量与含自然量原始汇总无效');
    return {spend:paid.spend,paidRoi:paid.roi,totalRoi:total.roi};
  }
  const totals=source.rows.filter(row=>row[0]==='全盘');
  const media=source.rows.filter(row=>row[2]!=='合计' && row[2]!=='自然量');
  if(totals.length!==1 || !media.length) throw new Error('缺少完整的引力项目及媒体数据');
  const spend=totals[0][3];
  if(!Number.isFinite(spend) || spend<0 || Math.abs(media.reduce((sum,row)=>sum+row[3],0)-spend)>0.01) throw new Error('引力买量媒体消耗之和与全盘不一致');
  if(media.length!==1) throw new Error('多媒体ROI需读取引力非自然量原始汇总，不能平均媒体ROI');
  return {spend,totalRoi:totals[0][6],paidRoi:media[0][6]};
}

async function main() {
  const output=path.resolve(process.argv[2] ?? fileURLToPath(new URL('../../../outputs/gravity-wecom/hero/英雄就是我_小时报_累计.xlsx',import.meta.url)));
  const directory=path.dirname(output);
  if(path.extname(output).toLowerCase()!=='.xlsx') throw new Error('输出文件须为xlsx');
  const runDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const slot=process.env.GRAVITY_REPORT_SLOT;
  if(slot && (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3])$/.test(slot) || slot.slice(0,10)!==runDate)) throw new Error('定时时点与当前北京时间不符');
  const clockHour=slot?.slice(11) ?? new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(new Date());
  const date=clockHour==='00' ? new Date(Date.parse(runDate+'T00:00:00Z')-86400000).toISOString().slice(0,10) : runDate;
  const hour=clockHour==='00' ? '24' : clockHour;
  const settingsFile=path.join(directory,'report-settings.json');
  const settings=await fs.readFile(settingsFile,'utf8').then(JSON.parse,error=>{if(error.code==='ENOENT') return {};throw error;});
  const deps=process.env.GRAVITY_NODE_MODULES ?? path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  const require=createRequire(path.join(deps,'package.json'));
  const chromium=require('playwright').chromium;
  const activeConfigPath=process.env.GRAVITY_REPORT_CONFIG ?? heroConfigPath;
  const config=await loadConfig(activeConfigPath,'hero');
  const startDate=process.env.HERO_ACQUISITION_START_DATE ?? config.report.acquisition?.startDate ?? settings.startDate ?? date;
  const roiMode=process.env.HERO_ACQUISITION_ROI ?? config.report.acquisition?.roiMode ?? settings.roiMode ?? 'gravity';
  await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(settingsFile,JSON.stringify({startDate,roiMode},null,2));
  const sourceDirectory=path.join(directory,'sources',Date.now().toString());
  await fs.mkdir(sourceDirectory,{recursive:true});
  const gravity=process.env.HERO_ACQUISITION_GRAVITY_JSON
    ? JSON.parse(await fs.readFile(process.env.HERO_ACQUISITION_GRAVITY_JSON,'utf8'))
    : await captureGravity(chromium,config,date);
  if(gravity.hour && gravity.hour!==clockHour) throw new Error('引力快照不是当前小时，请重新拉取');
  await fs.writeFile(path.join(sourceDirectory,'gravity.json'),JSON.stringify(gravity,null,2));
  console.log('正在读取数数投放汇总与分媒体数据');
  const cards=await readAcquisitionCards(chromium,sourceDirectory,{...config.report.acquisition,
    timeout:config.report.timeoutSeconds*1000,retries:config.report.retries,browserMode:config.report.browserMode});
  const data=aggregateAcquisition(cards.media,cards.total,date);
  console.log('正在读取数数前期转化');
  const conversion=await readConversionDashboard(chromium,config.report.conversion ?? conversionDefaults().report,date,
    (csv,attempt)=>fs.writeFile(path.join(sourceDirectory,'conversion.attempt-'+attempt+'.csv'),csv),config.report.browserMode);
  if(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())!==runDate) throw new Error('取数期间跨天');
  const snapshot={...data,time:hour+':00',gravity:gravityMetrics(gravity,date),source:cards.source};
  const conversionSnapshot={...conversion.data,time:hour+':00',source:conversion.source};
  await fs.writeFile(path.join(sourceDirectory,'snapshot.json'),JSON.stringify(snapshot,null,2));
  await fs.writeFile(path.join(sourceDirectory,'conversion.snapshot.json'),JSON.stringify(conversionSnapshot,null,2));
  const archive=path.join(directory,'hourly-snapshots.sqlite');
  const acquisitionImage=path.join(directory,'英雄就是我_买量小时报.png');
  const conversionImage=path.join(directory,'英雄就是我_前期转化.png');
  const result=await appendAcquisition(snapshot,archive,output,deps,{startDate,roiMode,deferSave:true,pngOutput:acquisitionImage});
  const conversionArchive=path.join(directory,'conversion-snapshots.sqlite');
  const converted=await appendConversionHistory(conversionSnapshot,conversionArchive,output,deps,{workbook:result.workbook,pngOutput:conversionImage});
  const images=[acquisitionImage,conversionImage];
  const bundle={date,time:hour+':00',images,workbooks:[output],archive,conversionArchive};
  await fs.writeFile(path.join(directory,'latest-bundle.json'),JSON.stringify(bundle,null,2));
  const webhook=process.argv.includes('--send') ? await readWebhook(activeConfigPath) : process.env.GRAVITY_WECOM_WEBHOOK;
  if(process.argv.includes('--send') && !webhook) throw new Error('英雄就是我尚未配置Webhook');
  if(webhook && !process.argv.includes('--preview')) {
    const sentDirectory=path.join(directory,'sent-slots',date+'T'+hour);
    await fs.mkdir(sentDirectory,{recursive:true});
    await sendImageBatch(webhook,await Promise.all(images.map(image=>fs.readFile(image))),
      '【'+config.project.name+'】'+date+' 截至北京时间 '+Number(hour)+' 点',
      {delivery:slot ? externalDelivery(sentDirectory,'bundle') : undefined});
  }
  console.log(JSON.stringify({...bundle,startDate,roiMode,rows:result.rows,conversionRows:converted.rows,latest:result.values.at(-1)}));
}
// A preview uses the same persisted data and layout, but never sends messages.
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{
  console.error('英雄买量小时报测试失败：'+error.message);process.exitCode=1;
});
