"""Verify exported file hashes/SQLite/JSON and detect obvious publication secrets."""
from pathlib import Path
import hashlib
import json
import re
import sqlite3
import zipfile

project = Path(__file__).resolve().parents[1]
root = project.parents[1]
errors = []
files = 0
secret = re.compile(r'(?i)qyapi\.weixin\.qq\.com/cgi-bin/webhook/(?:send|upload_media)\?[^\s"\x27<>]*key=(?!\[REDACTED\]|00000000-0000-0000-0000-000000000000)[0-9a-f-]{36}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}')
for manifest_file in (project / 'archives').glob('*/manifest.json'):
    manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
    base = manifest_file.parent
    for entry in manifest['files']:
        target = base / entry['path']
        if not target.resolve().is_relative_to(base.resolve()):
            errors.append('invalid manifest path')
            continue
        if hashlib.sha256(target.read_bytes()).hexdigest() != entry['sha256']:
            errors.append('hash mismatch: ' + str(target.relative_to(root)))
        files += 1
    for database in manifest['databases']:
        file = base / database['path']
        with sqlite3.connect(file.resolve().as_uri() + '?mode=ro', uri=True) as db:
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                errors.append('broken SQLite: ' + str(file.relative_to(root)))
            if db.execute('SELECT count(*) FROM snapshots').fetchone()[0] != database['rows']:
                errors.append('row count mismatch: ' + str(file.relative_to(root)))
for folder in (project, root / '.codex/tools/gravity-report', root / '.codex/skills/beite-hourly-report'):
    for file in folder.rglob('*'):
        if not file.is_file() or file.suffix in {'.sqlite', '.png', '.pyc'}:
            continue
        if file.suffix in {'.xlsx', '.zip'}:
            with zipfile.ZipFile(file) as archive:
                texts = [(str(file.relative_to(root)) + ':' + i.filename, archive.read(i)) for i in archive.infolist() if i.filename.endswith(('.xml', '.rels', '.md', '.yaml', '.mjs', '.py'))]
        else:
            texts = [(str(file.relative_to(root)), file.read_bytes())]
        for label, data in texts:
            if secret.search(data.decode('utf-8', errors='replace')):
                errors.append('credential-like content: ' + label)
if errors:
    raise SystemExit('\n'.join(errors))
print(json.dumps({'result': 'PASS', 'manifestFilesVerified': files,
                  'checks': ['SHA256', 'SQLite integrity and count', 'secret signatures in text/workbook/skill packages']}, ensure_ascii=False))
