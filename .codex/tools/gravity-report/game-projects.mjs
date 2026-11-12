import {fileURLToPath} from 'node:url';

const scripts = {
  'gravity-report': {
    name:'引力投放小时报',
    entry:fileURLToPath(new URL('./run.mjs',import.meta.url)),
  },
};

export const gravityProject = {id:'gravity', scriptId:'gravity-report', settings:'/'};
export const gameProjects = [
  gravityProject,
  {id:'iaa', name:'IAA 项目', scriptId:null, settings:null},
];

export function projectScript(project) {
  return project.scriptId ? scripts[project.scriptId] : null;
}
