"""Deterministic knowledge builds and offline repository checks (stdlib only)."""
from pathlib import Path
import argparse
import ast
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = 'catalog/project-registry.json'
STATE = 'catalog/generated-state.json'
TEXT = {'.md', '.json', '.yaml', '.yml', '.py', '.js', '.mjs', '.ps1', '.html', '.sql', '.csv', '.jsonl', '.txt'}

def text_bytes(value):
    return value.replace('\r\n', '\n').replace('\r', '\n').encode('utf-8')

def file_bytes(path):
    raw = (ROOT / path).read_bytes()
    return text_bytes(raw.decode('utf-8-sig')) if Path(path).suffix in TEXT else raw

def sha(data):
    return hashlib.sha256(data).hexdigest()

def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def local_path(relative):
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or '\\' in relative:
        raise ValueError('Expected repository-relative path')
    result = (ROOT / relative).resolve()
    if not result.is_relative_to(ROOT.resolve()):
        raise ValueError('Path escapes repository')
    return result

def validate_registry(registry):
    if registry.get('schemaVersion') != 1 or not isinstance(registry.get('projects'), list):
        raise ValueError('Unsupported registry schema')
    seen_ids, names, sources = set(), {}, {}
    valid_status = {'implemented','maintained','documented','context-required','materials-missing','historical'}
    for project in registry['projects']:
        for key in ('id','name','kind','entry','status','sources','aliases'):
            if key not in project:
                raise ValueError('Project missing '+key)
        if project['id'] in seen_ids or not re.fullmatch('[a-z0-9-]+', project['id']):
            raise ValueError('Duplicate or invalid project id')
        seen_ids.add(project['id'])
        if project['status'] not in valid_status or not local_path(project['entry']).is_file():
            raise ValueError('Invalid project status or entry: '+project['id'])
        if project.get('code') and not local_path(project['code']).exists():
            raise ValueError('Missing project code: '+project['id'])
        for name in [project['name'], *project['aliases']]:
            if name in names:
                raise ValueError('Ambiguous name/alias: '+name)
            names[name] = project['id']
        for source in project['sources']:
            if not isinstance(source.get('id'), str) or not source.get('system'):
                raise ValueError('Invalid source identity')
            sources.setdefault((source['system'], source['id']), []).append((project, source))
    for key, values in sources.items():
        if len(values) > 1 and not all(s.get('requiresContext') is True and p.get('note') for p, s in values):
            raise ValueError('Shared source identity must declare explicit context: '+str(key))
    skills = registry['skills']
    if len({s['id'] for s in skills}) != len(skills):
        raise ValueError('Duplicate skill')
    plugin = local_path(registry['pluginMirror']['path'])
    for skill in skills:
        source = local_path(skill['path']) / 'SKILL.md'
        if not source.is_file() or Path(skill['path']).name != skill['id']:
            raise ValueError('Invalid skill source: '+skill['id'])
        for name in skill['pluginSkills']:
            if not (plugin / 'skills' / name / 'SKILL.md').is_file():
                raise ValueError('Unknown plugin skill: '+name)
    targets = set()
    for copy in registry['generatedReferences']:
        if not local_path(copy['source']).is_file() or copy['target'] in targets:
            raise ValueError('Missing reference source or repeated target')
        if not copy['target'].startswith('.codex/skills/') or '/references/' not in copy['target']:
            raise ValueError('Generated reference outside skill references')
        local_path(copy['target'])
        targets.add(copy['target'])

def zip_bytes(entries):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, content in sorted(entries.items()):
            entry = zipfile.ZipInfo(name, date_time=(2000,1,1,0,0,0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_STORED
            archive.writestr(entry, content)
    return stream.getvalue()

def generated_files(registry):
    generated, inputs, copies, packages = {}, {}, [], []
    def read(relative):
        data = generated.get(relative)
        if data is None:
            data = file_bytes(relative)
        inputs[relative] = sha(data)
        return data
    read(REGISTRY)
    read('scripts/repo-maintenance.py')
    read('catalog/legacy-artifacts.json')
    for copy in registry['generatedReferences']:
        data = read(copy['source'])
        if copy.get('suffix'):
            data = data.rstrip() + b'\n' + text_bytes(copy['suffix'])
        generated[copy['target']] = data
        copies.append({**copy, 'sha256':sha(data)})
    project_index = ['# 项目注册索引（自动生成）','',
        '维护源：[project-registry.json](project-registry.json)。这不是实时调度配置；请勿直接修改本文件。','',
        '| 项目 | 状态 | 系统编号 / 上下文 | 资料入口 |','|---|---|---|---|']
    for p in registry['projects']:
        identities = '；'.join(s['system']+':'+s['id']+('（需核对上下文）' if s.get('requiresContext') else '') for s in p['sources']) or '按具体任务确认'
        project_index.append('| '+p['name']+' | '+p['status']+' | '+identities+' | [入口](../'+p['entry']+') |')
    project_index += ['', '## 编号冲突与待核实说明', '']
    project_index += ['- **'+p['name']+'**：'+p['note'] for p in registry['projects'] if p.get('note')]
    generated['catalog/PROJECT_INDEX.md'] = text_bytes('\n'.join(project_index)+'\n')
    skill_index = ['# 技能与插件职责对照（自动生成）','',
        '维护源：[project-registry.json](project-registry.json)。Codex技能与云端插件分别安装 / 发布，不做自动覆盖。','',
        '| Codex技能 | 职责 | 对应插件技能 |','|---|---|---|']
    for s in registry['skills']:
        skill_index.append('| ['+s['id']+'](../'+s['path']+'/SKILL.md) | '+s['purpose']+' | '+('、'.join(s['pluginSkills']) or '无直接对应')+' |')
    skill_index += ['', '插件发布镜像：[游戏数据分析之旅](../'+registry['pluginMirror']['path']+'/README.md)。快照版本以其sync-state为准。','']
    generated['catalog/SKILL_INDEX.md'] = text_bytes('\n'.join(skill_index))

    def skill_files(skill):
        folder = local_path(skill['path'])
        return sorted(p for p in folder.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
    hourly = next(s for s in registry['skills'] if s['id']=='beite-hourly-report')
    skill_sources = [(str(p.relative_to(ROOT).as_posix()), p.relative_to(local_path(hourly['path'])).as_posix()) for p in skill_files(hourly)]
    def package(destination, sources):
        entries = {archive_path:read(source) for source, archive_path in sources}
        generated[destination] = zip_bytes(entries)
        packages.append({'path':destination,'sha256':sha(generated[destination]),'files':len(entries),'bytes':len(generated[destination])})
    package('projects/beite-hourly-report/packages/beite-hourly-report-codex-skill.zip',
            [(source,'beite-hourly-report/'+name) for source,name in skill_sources])
    package('projects/beite-hourly-report/packages/beite-hourly-report-gpt-knowledge.zip',
            [('projects/beite-hourly-report/gpt/INSTRUCTIONS.md','INSTRUCTIONS.md')]+
            [(p.relative_to(ROOT).as_posix(),'knowledge/'+p.name) for p in sorted((ROOT/'projects/beite-hourly-report/docs').glob('*.md'))])
    all_skills = [(p.relative_to(ROOT).as_posix(),'skills/'+s['id']+'/'+p.relative_to(local_path(s['path'])).as_posix())
                  for s in registry['skills'] for p in skill_files(s)]
    package('projects/auto-project/packages/auto-project-codex-skills.zip', all_skills)
    handoff = [(p.relative_to(ROOT).as_posix(),p.name) for p in sorted((ROOT/'projects/auto-project').glob('*.md'))]
    for path in ['PROJECT_WORKING_RULES.md','project_memory.yaml','knowledge/CANONICAL_INDEX.md',
                 'knowledge/global/metric_definitions.md','knowledge/global/payment_policy.md','knowledge/global/analysis_method.md',
                 'projects/beite-hourly-report/docs/metrics.md','projects/beite-hourly-report/docs/archive.md','projects/beite-hourly-report/docs/operations.md']:
        handoff.append((path,path))
    package('projects/auto-project/packages/auto-project-chatgpt-knowledge.zip',handoff)
    generated[STATE] = dump({'schemaVersion':1,'textEncoding':'UTF-8/LF; BOM removed',
        'sourceFingerprint':sha(dump(dict(sorted(inputs.items())))), 'inputs':dict(sorted(inputs.items())), 'references':copies, 'packages':packages})
    return generated

def tracked_files():
    result = subprocess.run(['git','ls-files','-z'],cwd=ROOT,capture_output=True,check=True)
    return [ROOT/p.decode('utf-8') for p in result.stdout.split(b'\0') if p]

def check_links(paths):
    errors = []
    for file in paths:
        for target in re.findall(r'\]\(([^)]+)\)', file.read_text(encoding='utf-8-sig')):
            if '://' in target or target.startswith(('#','C:','/')):
                continue
            target = target.split('#')[0].strip('<>')
            if target and not (file.parent / target).exists():
                errors.append('Broken local link: '+str(file.relative_to(ROOT))+':'+target)
    return errors

def credential_errors(files):
    errors = []
    legacy = json.loads((ROOT/'catalog/legacy-artifacts.json').read_text(encoding='utf-8'))['exceptions']
    exceptions = {e['path']:e for e in legacy}
    pattern = re.compile(r'(?i)qyapi\.weixin\.qq\.com/cgi-bin/webhook/(?:send|upload_media)\?[^\s"\x27<>]*key=(?!\[REDACTED\]|00000000-0000-0000-0000-000000000000)[0-9a-f-]{36}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{30,}')
    for file in files:
        if not file.is_file():
            continue
        if file.suffix.lower() in {'.dpapi','.pem','.key'} or any(p in {'Chrome','TA-Chrome','node_modules'} for p in file.relative_to(ROOT).parts):
            errors.append('Authentication/runtime file must not be tracked: '+str(file.relative_to(ROOT)))
            continue
        if file.suffix in TEXT:
            payloads = [file.read_bytes()]
        elif file.suffix in {'.xlsx','.zip'}:
            try:
                with zipfile.ZipFile(file) as bundle:
                    payloads = [bundle.read(i) for i in bundle.infolist() if Path(i.filename).suffix in TEXT|{'.xml','.rels'}]
            except (OSError, zipfile.BadZipFile):
                record = exceptions.get(file.relative_to(ROOT).as_posix())
                if record and record['sha256']==sha(file.read_bytes()):
                    continue
                errors.append('Unreadable package without matching legacy record: '+str(file.relative_to(ROOT)))
                continue
        else:
            continue
        if any(pattern.search(data.decode('utf-8',errors='replace')) for data in payloads):
            errors.append('Credential-like value: '+str(file.relative_to(ROOT)))
    return errors

def stale_files(expected):
    stale = []
    for relative, data in expected.items():
        target = ROOT/relative
        actual = file_bytes(relative) if target.exists() and target.suffix in TEXT else target.read_bytes() if target.exists() else None
        if actual != data:
            stale.append(relative)
    return stale

def check_repository(registry, expected):
    errors = ['Generated file is stale; run build: '+p for p in stale_files(expected)]
    entries = [ROOT/'README.md',ROOT/'AGENTS.md',ROOT/'catalog/PROJECT_INDEX.md',ROOT/'catalog/SKILL_INDEX.md',
               ROOT/'docs/repository-maintenance.md',ROOT/'docs/optimization-impact-20261120.md',
               *sorted((ROOT/'projects/auto-project').glob('*.md'))]
    errors += check_links(entries)
    all_files = sorted(set(tracked_files()+[p for base in ('catalog','scripts','.github') for p in (ROOT/base).rglob('*') if p.is_file() and '__pycache__' not in p.parts]))
    errors += credential_errors(all_files)
    for file in all_files:
        if file.is_file() and file.suffix=='.json':
            try:
                json.loads(file.read_text(encoding='utf-8-sig'))
            except (ValueError, UnicodeError):
                errors.append('Invalid JSON: '+str(file.relative_to(ROOT)))
    for skill in registry['skills']:
        text = (local_path(skill['path'])/'SKILL.md').read_text(encoding='utf-8-sig')
        metadata = text.split('---',2)[1] if text.startswith('---') and text.count('---')>=2 else ''
        if not re.search(r'^name:\s*'+re.escape(skill['id'])+r'\s*$',metadata,re.M) or not re.search(r'^description:\s*\S',metadata,re.M):
            errors.append('Missing/invalid skill metadata: '+skill['id'])
    for path in (ROOT/'scripts').glob('*.py'):
        ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path))
    plugin = local_path(registry['pluginMirror']['path'])
    sync = json.loads((plugin/'sync-state.json').read_text(encoding='utf-8'))
    if sync['version'] != json.loads((plugin/'plugin.json').read_text(encoding='utf-8'))['version']:
        errors.append('Plugin snapshot version mismatch')
    for name, digest in sync['files'].items():
        data = file_bytes((plugin/ name).relative_to(ROOT).as_posix())
        blob = hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        if blob != digest:
            errors.append('Plugin mirror changed outside recorded release: '+name)
    if errors:
        raise ValueError('\n'.join(errors))
    count = len([f for f in all_files if f.is_file()])
    print(json.dumps({'result':'PASS','projects':len(registry['projects']),'codexSkills':len(registry['skills']),
        'generatedReferences':len(registry['generatedReferences']),'trackedAndMaintenanceFiles':count,
        'repositoryBytes':sum(f.stat().st_size for f in all_files if f.is_file()),
        'sourceFingerprint':json.loads(expected[STATE])['sourceFingerprint']},ensure_ascii=False))
    print('Known legacy package exception: docs/塔防类产品_外挂治理搭建流程_思维导图.xlsx (unchanged; XML not verified).')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['build','check'])
    parser.add_argument('--install',action='append',default=[],help='Explicitly install one registered Codex skill after build')
    args = parser.parse_args()
    if args.command=='check' and args.install:
        parser.error('check never installs skills')
    registry = json.loads((ROOT/REGISTRY).read_text(encoding='utf-8'))
    validate_registry(registry)
    if any(name not in {s['id'] for s in registry['skills']} for name in args.install):
        raise ValueError('Unknown skill to install')
    expected = generated_files(registry)
    if args.command=='build':
        for relative,data in expected.items():
            target = ROOT/relative
            target.parent.mkdir(parents=True,exist_ok=True)
            if not target.exists() or target.read_bytes()!=data:
                target.write_bytes(data)
        for name in args.install:
            skill = next((s for s in registry['skills'] if s['id']==name),None)
            if not skill:
                raise ValueError('Unknown skill to install: '+name)
            destination = Path(os.environ.get('CODEX_HOME',str(Path.home()/'.codex')))/'skills'/name
            shutil.copytree(local_path(skill['path']),destination,dirs_exist_ok=True)
        print('Built indexes, references, four deterministic packages and provenance; production untouched.')
    else:
        check_repository(registry,expected)

if __name__=='__main__':
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        print(str(error),file=sys.stderr)
        raise SystemExit(1)
