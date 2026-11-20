import fs from 'node:fs/promises';
import {connectTaBrowser} from './external-hourly.mjs';

export async function readAcquisitionCards(chromium,directory,{timeout=120000,retries=1,
  url='https://ta-data.feiyu.com/#/panel/panel/44_1749_0',mediaCard='投放数据',totalCard='【汇总】投放数据'}={}) {
  const names=[mediaCard,totalCard];
  const browser=await connectTaBrowser(chromium,timeout);
  let page;
  try {
    page=await browser.contexts()[0].newPage();page.setDefaultTimeout(timeout);
    for(let attempt=0;attempt<=retries;attempt++) {
      try {
        await page.goto(url,{waitUntil:'domcontentloaded',timeout});
        const query=page.getByRole('button',{name:'查询',exact:true});
        await query.waitFor();if(page.url()!==url) throw new Error('未进入指定数数看板');
        await query.click();
        const result={source:{panel:url,cards:names,observedAt:new Date().toISOString()}};
        for(const [index,name] of names.entries()) {
          const card=page.getByTestId(/^panel-report-card-\d+$/).filter({has:page.getByRole('link',{name,exact:true})});
          await card.waitFor();await card.locator('canvas').first().waitFor();await card.hover();
          const refresh=card.getByTestId(/--header--refresh-btn$/);
          const started=Date.now();await refresh.click();await refresh.hover();
          let nextHover=Date.now()+5000;
          while(true) {
            const text=await page.locator('body').innerText();
            const time=text.match(/最后更新时间[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1];
            if(Date.parse(time?.replace(/\s+/,'T')+'+08:00')>=started-3000) break;
            if(Date.now()-started>=timeout) throw new Error(name+'未刷新到本次查询时间');
            if(Date.now()>=nextHover) {await refresh.hover();nextHover=Date.now()+5000;}
            await page.waitForTimeout(1000);
          }
          await card.getByTestId(/--header--more-menu-btn$/).click();
          const item=page.getByRole('menuitem',{name:'数据导出',exact:true}).filter({visible:true});
          const [download]=await Promise.all([page.waitForEvent('download',{timeout}),item.click()]);
          const filename=await download.path();if(!filename) throw new Error(name+'下载失败');
          const csv=await fs.readFile(filename,'utf8');
          await fs.mkdir(directory,{recursive:true});
          await fs.writeFile(directory+'/'+(index ? 'total' : 'media')+'.attempt-'+(attempt+1)+'.csv',csv);
          result[index ? 'total' : 'media']=csv;
        }
        return result;
      } catch(error) {
        if(attempt===retries) throw error;
        console.warn('重新加载看板后重试：'+error.message.split('\n')[0]);
      }
    }
  } finally {if(page) await page.close().catch(()=>{});await browser.close();}
}
