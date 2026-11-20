"""Check handoff provenance, hashes, local links, package contents and obvious secrets."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]

def main():
    errors = []
    manifest = json.loads((PROJECT / 'evidence/materials-manifest.json').read_text(encoding='utf-8'))
    for entry in manifest['files']:
        file = PROJECT / entry['path']
        if not file.resolve().is_relative_to(PROJECT.resolve()):
            errors.append('invalid manifest path')
            continue
        if hashlib.sha256(file.read_bytes()).hexdigest() != entry['sha256']:
            errors.append('SHA256 mismatch: ' + entry['path'])
    history = json.loads((PROJECT / 'evidence/conversation-review.json').read_text(encoding='utf-8'))
    assert len(history['threads']) == 16
    assert all(t['historyPaginationComplete'] for t in history['threads'])
    assert sum(t['reviewedTurns'] or 0 for t in history['threads']) == 153
    secret = re.compile(r'(?i)qyapi\.weixin\.qq\.com/cgi-bin/webhook/(?:send|upload_media)\?[^\s"\x27<>]*key=(?!\[REDACTED\]|00000000-0000-0000-0000-000000000000)[0-9a-f-]{36}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}')
    for file in PROJECT.rglob('*'):
        if not file.is_file() or '__pycache__' in file.parts or file.suffix in {'.pyc','.png','.jpg'}:
            continue
        if file.suffix in {'.xlsx','.zip'}:
            with zipfile.ZipFile(file) as bundle:
                for entry in bundle.infolist():
                    if entry.filename.endswith(('.xml','.rels','.md','.json','.yaml','.mjs','.js','.py')) and secret.search(bundle.read(entry).decode('utf-8', errors='replace')):
                        errors.append('credential-like content in package: ' + file.name + ':' + entry.filename)
        elif secret.search(file.read_text(encoding='utf-8-sig')):
            errors.append('credential-like content: ' + str(file.relative_to(PROJECT)))
    for file in list(PROJECT.glob('*.md')) + [ROOT / 'AGENTS.md', ROOT / '.codex/skills/auto-project-handoff/SKILL.md']:
        for target in re.findall(r'\]\(([^)]+)\)', file.read_text(encoding='utf-8')):
            if '://' in target or target.startswith('#'):
                continue
            if not (file.parent / target.split('#')[0]).exists():
                errors.append('broken link: ' + str(file.relative_to(ROOT)) + ':' + target)
    if errors:
        raise SystemExit('\n'.join(errors))
    print(json.dumps({'result':'PASS', 'materials':len(manifest['files']), 'knownMissing':len(manifest['missing']),
                      'threads':16,'reviewedHistoricalTurns':153,'checks':['SHA256','source coverage','entry links','credential signatures']}))

if __name__ == '__main__':
    main()
