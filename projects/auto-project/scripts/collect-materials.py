"""Collect explicitly selected handoff files; never modify their original paths."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import importlib.util
import json
import shutil
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('hourly_archive', ROOT / 'projects/beite-hourly-report/scripts/archive-project.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def main():
    manifest = {'createdAtBeijing': datetime.now(timezone(timedelta(hours=8))).isoformat(),
                'files': [], 'missing': [], 'notes': ['Selected final deliverables and source evidence, not every temporary file.',
                    'Historical files are not a new online verification. No production inputs modified.',
                    'Excluded wrong-project27 report, intermediate previews, render inspection dumps, authentication material.']}

    def copy(source, relative, status='historical-deliverable'):
        source = Path(source)
        if not source.is_file():
            manifest['missing'].append({'source': str(source), 'target': relative})
            return
        destination = PROJECT / 'materials' / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix in {'.md', '.sql', '.mjs', '.js', '.json', '.csv', '.yaml', '.ps1'}:
            text = source.read_text(encoding='utf-8-sig')
            if source.suffix == '.json':
                text = json.dumps(module.sanitize(json.loads(text)), ensure_ascii=False, indent=2)
            else:
                text = module.clean_text(text)
            destination.write_text(text, encoding='utf-8')
        else:
            if source.suffix == '.xlsx':
                with zipfile.ZipFile(source) as workbook:
                    for entry in workbook.infolist():
                        if entry.filename.endswith(('.xml', '.rels')):
                            text = workbook.read(entry).decode('utf-8')
                            if module.clean_text(text) != text:
                                raise RuntimeError('Credential-like content in workbook: ' + source.name)
            shutil.copy2(source, destination)
        manifest['files'].append({'path': destination.relative_to(PROJECT).as_posix(), 'source': str(source),
                                  'status': status, 'bytes': destination.stat().st_size,
                                  'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})

    luobo = ROOT / 'outputs/01a04687-6ed7-72d3-a3a4-54d899bde3bf'
    for source in sorted(luobo.glob('*.xlsx')):
        copy(source, 'luobo4-analysis/' + source.name)
    tracking = ROOT / 'outputs/01a0f147-6210-7d30-92e9-64f858d75d05'
    for name in ['喵喵岛_52埋点验收差异_20261023.xlsx', 'T埋点_属性名修正_保留格式.xlsx',
                 'T埋点差异总览_修正版_20260930.xlsx', 'T埋点验收初查_20260930.xlsx']:
        copy(tracking / name, 'tracking-review/' + name)
    for directory, label in [('luobo4_overview_20261119','luobo4-overview'), ('yishuajiushangtou_20261102','yishua-dashboards')]:
        for source in sorted((ROOT / 'outputs' / directory).glob('*')):
            if source.is_file() and (source.suffix == '.md' or source.name.startswith('report_') or source.name in {'qa.sql','一致性检查.sql'}):
                copy(source, label + '/' + source.name, 'final-sql-and-validation')
    for name in ['关卡汇总.sql','失败汇总.sql','失败剩余螺丝分布.sql','交付说明.md','验证结果.json','关卡分析_完成.png']:
        copy(ROOT / 'outputs/yishua_level_analysis' / name, 'yishua-level/' + name, 'final-sql-and-validation')
    for name in ['build_wechat_billing_compare.mjs','update_trend_duration.mjs','create_baoweiluobo_collector_report_15.js',
                 'finalize_baoweiluobo_collector_dashboard_250.js','refresh_baoweiluobo_collector_dashboard_data.js',
                 'verify_baoweiluobo_collector_report_15.js']:
        copy(ROOT / name, 'reference-tools/' + name, 'historical-source-review-before-execution')
    downloads = Path.home() / 'Downloads'
    encoded = '%E6%B8%B8%E6%88%8F%E8%BF%90%E8%90%A5%E6%8A%95%E6%94%BE%E5%88%86%E6%9E%90%E6%A8%A1%E6%9D%BF_%E5%A4%9ASheet_%E5%8D%87%E7%BA%A7%E7%89%88.xlsx'
    copy(downloads / encoded, 'templates/游戏运营投放分析模板_多Sheet_升级版.xlsx', 'analysis-template')
    copy(downloads / '游戏运营投放分析模板_流程图版.xlsx', 'templates/游戏运营投放分析模板_流程图版.xlsx', 'analysis-template')
    for name in ['.codex/tools/ta-dashboard-collector/README.md', 'baoweiluoboshe_tracking.yaml']:
        if not (ROOT / name).exists():
            manifest['missing'].append({'source': name, 'reason': 'Historical conversation references this path, but it is absent now; not recreated.'})
    evidence = PROJECT / 'evidence'
    evidence.mkdir(exist_ok=True)
    (evidence / 'materials-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    runtime = {'observedAtBeijing': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'readOnly': True, 'projects': []}
    for route in ['', '/external', '/hero', '/iaa']:
        try:
            with urllib.request.urlopen('http://127.0.0.1:8732' + route + '/api/config', timeout=5) as response:
                config = json.load(response)
            runtime['projects'].append({'route': route or '/', 'project': config['project']['name'],
                                        'schedule': config['schedule'], 'gravityUrl': config['report']['url']})
        except Exception as error:
            runtime['projects'].append({'route': route or '/', 'error': type(error).__name__})
    result = subprocess.run(['pwsh.exe','-NoProfile','-Command',"Get-ScheduledTask -TaskName GravityWeComReport | Select-Object TaskName,@{Name='State';Expression={$_.State.ToString()}} | ConvertTo-Json -Compress"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=15)
    runtime['task'] = json.loads(result.stdout) if result.returncode == 0 else {'error': 'Unable to query task'}
    (evidence / 'runtime-status.json').write_text(json.dumps(runtime, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'files': len(manifest['files']), 'missing': len(manifest['missing']), 'projectStatusCount': len(runtime['projects'])}))

if __name__ == '__main__':
    main()
