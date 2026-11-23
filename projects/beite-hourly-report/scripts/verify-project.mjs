// Offline invariant checks. No browser, credentials, live DB writes or network.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {externalTotals,externalSnapshotForCutoff} from '../../../.codex/tools/gravity-report/external-hourly.mjs';
import {aggregateAcquisition,acquisitionView} from '../../../.codex/tools/gravity-report/hero-acquisition.mjs';
import {imageBatchMessages,sendImageBatch} from '../../../.codex/tools/gravity-report/wecom-image-batch.mjs';
import {docSyncHour} from '../../../.codex/tools/gravity-report/wecom-doc-sync.mjs';
const code=new URL('../../../.codex/tools/gravity-report/',import.meta.url);
assert.equal(docSyncHour('10:00'),false);
assert.equal(docSyncHour('00:00'),false);
assert.equal(docSyncHour('11:00'),true);
assert.equal(docSyncHour('24:00'),true);
const closing={date:'2026-11-23',time:'24:00',ta:[12,20,3,100,5,0.15,0.8,0.5,1.2,30]};
const prepared=externalSnapshotForCutoff(closing);
assert.deepEqual(prepared.ta.slice(6,8),[null,null]);
assert.deepEqual(prepared.ta.slice(0,6),closing.ta.slice(0,6));
assert.deepEqual(prepared.ta.slice(8),closing.ta.slice(8));
assert.deepEqual(closing.ta.slice(6,8),[0.8,0.5]);
assert.equal(externalSnapshotForCutoff({...closing,time:'11:00'}).ta,closing.ta);
assert.equal(externalSnapshotForCutoff({...closing,baseline:true}).ta,closing.ta);
for(const name of await fs.readdir(code)) if(name.endsWith('.mjs')) {
  const check=spawnSync(process.execPath,['--check',fileURLToPath(new URL(name,code))],{encoding:'utf8'});
  assert.equal(check.status,0,name+': '+check.stderr);
}
const baseline={date:'2026-11-16',time:'24:00',baseline:true,ta:[548,552,45,1804],gravity:{paid:{spend:3661.27}}};
const morning={date:'2026-11-17',time:'09:00',ta:[10,20,2,100],gravity:{paid:{spend:50}}};
const later={...morning,time:'10:00',ta:[15,30,3,120],gravity:{paid:{spend:70}}};
assert.deepEqual(externalTotals([baseline,morning,later],baseline).get(later),[563,1924,3731.27]);
const row=(date,time,spend)=>({date,time,gravity:{spend,paidRoi:0.1,totalRoi:0.2},paid:{registrations:10,payers:2,payRate:0.2,arppu:20},total:{}});
const view=acquisitionView([row('2026-11-20','23:00',90),row('2026-11-20','24:00',100),row('2026-11-21','01:00',10)],'2026-11-20');
assert.equal(view.visible.length,2);
assert.equal(view.values.at(-1)[7],110);
const headers='新增日期,媒体平台,新增,新增首日付费人数,新增首日付费金额,新增首日付费率,新增首日ARPPU';
const media=headers+'\n2026-11-20,tencent,100,10,100,10%,10\n2026-11-20,bytedance,20,10,300,50%,30';
const total='新增日期,新增,新增首日付费人数,新增首日付费金额,新增首日付费率,新增首日ARPPU\n2026-11-20,150,30,600,20%,20';
const aggregated=aggregateAcquisition(media,total,'2026-11-20');
assert.equal(aggregated.paid.arppu,20);
assert.equal(aggregated.paid.payRate,20/120);
assert.throws(()=>aggregateAcquisition(media+'\n2026-11-20,tencent,100,10,100,10%,10',total,'2026-11-20'));
const pictures=[Buffer.from('image1'),Buffer.from('image2')];
assert.deepEqual(imageBatchMessages(pictures,'test').map(x=>x.key),['image-1','image-2','text']);
assert.throws(()=>imageBatchMessages([Buffer.alloc(2*1024*1024+1)],'test'));
const states=new Map([['image-1','sent']]),sent=[];
await sendImageBatch('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=00000000-0000-0000-0000-000000000000',pictures,'test',{
 delivery:{status:async k=>states.get(k),begin:async k=>states.set(k,'sending'),sent:async k=>states.set(k,'sent')},
 fetchImpl:async (_url,req)=>{sent.push(JSON.parse(req.body).msgtype);return {ok:true,json:async()=>({errcode:0})};}
});
assert.deepEqual(sent,['image','text']);
console.log('PASS: syntax, cumulative snapshots, prior-day24 visibility, weighted media, duplicate rejection, image resume; no network used.');
