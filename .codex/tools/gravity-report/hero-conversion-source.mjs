import fs from 'node:fs/promises';
import {openTaSession} from './external-hourly.mjs';
import {parseConversion} from './hero-conversion.mjs';

export async function readConversionDashboard(chromium,report,date,onDownload=async()=>{},browserMode) {
  const timeout=report.timeoutSeconds*1000;
  const {context,close}=await openTaSession(chromium,timeout,browserMode);
  let page;
  try {
    page=await context.newPage();page.setDefaultTimeout(timeout);
    for (let attempt=0;attempt<=report.retries;attempt++) {
      try {
        await page.goto(report.url,{waitUntil:'domcontentloaded',timeout});
        const query=page.getByRole('button',{name:'查询',exact:true});
        await query.waitFor({timeout:Math.min(timeout,30000)});
        if(page.url()!==report.url) throw new Error('数数未进入指定看板，请检查登录状态');
        await query.click();
        const card=page.getByTestId(/^panel-report-card-\d+$/).filter({has:page.getByRole('link',{name:report.title,exact:true})});
        await card.waitFor();await card.locator('canvas').first().waitFor();
        const refreshedAt=Date.now();
        await card.hover();
        const refresh=card.getByTestId(/--header--refresh-btn$/);
        await refresh.click();await refresh.hover();
        let nextHover=Date.now()+5000;
        while(true) {
          const text=await page.locator('body').innerText();
          const time=text.match(/最后更新时间[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1];
          if(Date.parse(time?.replace(/\s+/,'T')+'+08:00')>=refreshedAt-3000) break;
          if(Date.now()-refreshedAt>=timeout) throw new Error('激活登录卡片未更新到本次查询时间');
          if(Date.now()>=nextHover) {await refresh.hover();nextHover=Date.now()+5000;}
          await page.waitForTimeout(1000);
        }
        await card.getByTestId(/--header--more-menu-btn$/).click();
        const item=page.getByRole('menuitem',{name:'数据导出',exact:true}).filter({visible:true});
        const [download]=await Promise.all([page.waitForEvent('download',{timeout}),item.click()]);
        const filename=await download.path();
        if(!filename || !download.suggestedFilename().toLowerCase().endsWith('.csv')) throw new Error('激活登录卡片未返回CSV');
        const csv=await fs.readFile(filename,'utf8');
        await onDownload(csv,attempt+1);
        return {data:parseConversion(csv,date),csv,source:{panel:report.url,card:report.title,observedAt:new Date().toISOString()}};
      } catch(error) {
        if(attempt===report.retries) throw error;
        console.warn('前期转化取数失败，重新打开看板后重试：'+error.message.split('\n')[0]);
      }
    }
  } finally {if(page) await page.close().catch(()=>{});await close();}
}
