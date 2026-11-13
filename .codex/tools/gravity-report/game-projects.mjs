import {fileURLToPath} from 'node:url';
import {configPath,iaaConfigPath,towerConfigPath,towerName} from './config.mjs';

const scripts = {
  'gravity-report': {
    name:'引力投放小时报',
    entry:fileURLToPath(new URL('./run.mjs',import.meta.url)),
  },
  'gravity-iaa': {
    name:'引力 IAA 小时报',
    entry:fileURLToPath(new URL('./run-iaa.mjs',import.meta.url)),
  },
};

export const gravityProject = {id:'gravity', scriptId:'gravity-report', settings:'/', config:configPath};
export const gameProjects = [
  gravityProject,
  {id:'iaa', name:'IAA 项目', scriptId:'gravity-iaa', settings:'/iaa',
    config:iaaConfigPath},
  {id:'tower', name:towerName, scriptId:'gravity-report', settings:'/tower', config:towerConfigPath},
];

export function projectScript(project) {
  return scripts[project.scriptId];
}
