"""Package project-owned skills and text knowledge; install the handoff skill only."""
from pathlib import Path
import os
import shutil
import zipfile

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
SKILL = ROOT / '.codex/skills/auto-project-handoff'

def main():
    references = SKILL / 'references'
    references.mkdir(parents=True, exist_ok=True)
    for name in ['STATUS.md','ACCOUNT_HANDOFF.md','ACCEPTANCE.md']:
        shutil.copy2(PROJECT / name, references / name)
    packages = PROJECT / 'packages'
    packages.mkdir(exist_ok=True)
    with zipfile.ZipFile(packages / 'auto-project-codex-skills.zip','w',zipfile.ZIP_DEFLATED) as bundle:
        for folder in sorted((ROOT / '.codex/skills').iterdir()):
            if folder.is_dir() and (folder / 'SKILL.md').is_file():
                for source in sorted(folder.rglob('*')):
                    if source.is_file() and '__pycache__' not in source.parts:
                        bundle.write(source, Path('skills') / source.relative_to(ROOT / '.codex/skills'))
    with zipfile.ZipFile(packages / 'auto-project-chatgpt-knowledge.zip','w',zipfile.ZIP_DEFLATED) as bundle:
        for source in sorted(PROJECT.glob('*.md')):
            bundle.write(source, source.name)
        for relative in ['PROJECT_WORKING_RULES.md','project_memory.yaml','knowledge/CANONICAL_INDEX.md',
                         'knowledge/global/metric_definitions.md','knowledge/global/payment_policy.md','knowledge/global/analysis_method.md',
                         'projects/beite-hourly-report/docs/metrics.md','projects/beite-hourly-report/docs/archive.md','projects/beite-hourly-report/docs/operations.md']:
            bundle.write(ROOT / relative, relative)
    target = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills' / SKILL.name
    shutil.copytree(SKILL, target, dirs_exist_ok=True)
    print('Packaged project skills and ChatGPT knowledge; handoff skill installed locally.')

if __name__ == '__main__':
    main()
