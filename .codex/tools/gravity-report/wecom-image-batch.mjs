import {createHash} from 'node:crypto';
import {webhookUrl} from './webhook.mjs';

export function imageBatchMessages(images,title) {
  if(!Array.isArray(images) || !images.length || images.some(image=>!Buffer.isBuffer(image) || !image.length || image.length>2*1024*1024)) throw new Error('每张企微图片必须为非空且不超过2MB');
  if(typeof title!=='string' || !title.trim() || Buffer.byteLength(title,'utf8')>2048) throw new Error('企微标题为空或过长');
  return [...images.map((image,index)=>({key:'image-'+(index+1),body:{msgtype:'image',image:{base64:image.toString('base64'),md5:createHash('md5').update(image).digest('hex')}}})),
    {key:'text',body:{msgtype:'text',text:{content:title}}}];
}

export async function sendImageBatch(webhook,images,title,{delivery,fetchImpl=fetch}={}) {
  const target=webhookUrl(webhook);
  const messages=imageBatchMessages(images,title); // Validate the whole batch before the first request.
  for(const {key,body} of messages) {
    const state=await delivery?.status(key);
    if(state==='sent') continue;
    if(state!==undefined) throw new Error('企微'+key+'上次请求结果未确认，暂停重复发送');
    await delivery?.begin(key);
    let result;
    try {
      const response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
        body:JSON.stringify(body),signal:AbortSignal.timeout(25000),redirect:'error'});
      if(!response.ok) throw new Error('HTTP错误');
      result=await response.json();if(!Number.isInteger(result?.errcode)) throw new Error('响应缺少结果');
    } catch {throw new Error('企微'+key+'请求结果未确认');}
    if(result.errcode!==0) {await delivery?.rejected(key);throw new Error('企微'+key+'发送失败，错误码 '+result.errcode);}
    await delivery?.sent(key);console.log('企微'+key+'发送成功');
  }
}
