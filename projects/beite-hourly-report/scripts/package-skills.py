"""Synchronize canonical knowledge, package Codex/GPT files, install personal skill."""
from pathlib import Path
import json
import os
import shutil
import zipfile

project = Path(__file__).resolve().parents[1]
root = project.parents[1]
skill = root / '.codex/skills/beite-hourly-report'
references = skill / 'references'
references.mkdir(parents=True, exist_ok=True)
for document in (project / 'docs').glob('*.md'):
    shutil.copy2(document, references / document.name)
packages = project / 'packages'
packages.mkdir(exist_ok=True)
with zipfile.ZipFile(packages / 'beite-hourly-report-codex-skill.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    for source in sorted(skill.rglob('*')):
        if source.is_file():
            bundle.write(source, Path(skill.name) / source.relative_to(skill))
with zipfile.ZipFile(packages / 'beite-hourly-report-gpt-knowledge.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    bundle.write(project / 'gpt/INSTRUCTIONS.md', 'INSTRUCTIONS.md')
    for source in sorted((project / 'docs').glob('*.md')):
        bundle.write(source, 'knowledge/' + source.name)
personal = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills' / skill.name
shutil.copytree(skill, personal, dirs_exist_ok=True)
print(json.dumps({'installed': str(personal), 'codex': str(packages / 'beite-hourly-report-codex-skill.zip'),
                  'gpt': str(packages / 'beite-hourly-report-gpt-knowledge.zip')}, ensure_ascii=False))
