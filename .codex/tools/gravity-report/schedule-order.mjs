import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const defaultScheduleOrder=['external','hero','gravity','iaa'];

export function validateScheduleOrder(order,projects) {
  const ids=projects.map(project=>project.id);
  if(!Array.isArray(order) || order.length!==ids.length || new Set(order).size!==order.length ||
      order.some(id=>typeof id!=='string' || !ids.includes(id))) throw new Error('执行顺序须包含全部项目，且不能重复');
  return [...order];
}

export function orderProjects(projects,order=defaultScheduleOrder) {
  const known=new Set(projects.map(project=>project.id));
  const ids=[...new Set([...order.filter(id=>known.has(id)),...projects.map(project=>project.id)])];
  return ids.map(id=>projects.find(project=>project.id===id));
}

export async function readScheduleOrder(file,projects) {
  let settings;
  try {settings=JSON.parse(await readFile(file,'utf8'));}
  catch(error) {if(error.code==='ENOENT') return orderProjects(projects).map(project=>project.id);throw error;}
  if(!Array.isArray(settings.order) || settings.order.some(id=>typeof id!=='string') || new Set(settings.order).size!==settings.order.length) throw new Error('定时执行顺序配置无效');
  // Keep saved priorities while appending newly added projects and dropping retired ones.
  return orderProjects(projects,settings.order).map(project=>project.id);
}

export async function saveScheduleOrder(file,order,projects) {
  const normalized=validateScheduleOrder(order,projects);
  await mkdir(path.dirname(file),{recursive:true});
  const pending=file+'.'+randomUUID()+'.tmp';
  try {await writeFile(pending,JSON.stringify({order:normalized},null,2)+'\n',{flag:'wx'});await rename(pending,file);}
  finally {await rm(pending,{force:true});}
  return normalized;
}
