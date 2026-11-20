import {fileURLToPath} from 'node:url';
import {configPath,iaaConfigPath,externalConfigPath,externalName,heroConfigPath} from './config.mjs';

const scripts = {
  'hero-hourly': {
    name:'买量与前期转化双图小时报',
    entry:fileURLToPath(new URL('./run-hero-acquisition.mjs',import.meta.url)),
    workbookName:'英雄就是我_小时报_累计.xlsx',
  },
  'gravity-report': {
    name:'引力投放小时报',
    entry:fileURLToPath(new URL('./run.mjs',import.meta.url)),
  },
  'gravity-iaa': {
    name:'引力 IAA 小时报',
    entry:fileURLToPath(new URL('./run-iaa.mjs',import.meta.url)),
  },
  'external-hourly': {
    name:'数数与引力联合小时报',
    entry:fileURLToPath(new URL('./run.mjs',import.meta.url)),
  },
};

export const gravityProject = {id:'gravity', scriptId:'gravity-report', settings:'/', config:configPath};
export const gameProjects = [
  gravityProject,
  {id:'hero', name:'英雄就是我', scriptId:'hero-hourly', settings:'/hero', config:heroConfigPath},
  {id:'iaa', name:'IAA 项目', scriptId:'gravity-iaa', settings:'/iaa',
    config:iaaConfigPath},
  {id:'external', name:externalName, scriptId:'external-hourly', settings:'/external', config:externalConfigPath},
];

export function projectScript(project) {
  return scripts[project.scriptId];
}
