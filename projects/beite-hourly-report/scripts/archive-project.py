"""Create a reviewable, credential-free report archive without altering production."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import shutil
import sqlite3
import zipfile

ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
SENSITIVE = re.compile(r'^(?:password|passwd|secret|client_secret|appsecret|access_token|refresh_token|authorization|cookie|cookies|storageState|webhook|webhookUrl|webhook_url|botSecret)$', re.I)
WEBHOOK = re.compile(r'(https://qyapi\.weixin\.qq\.com/cgi-bin/webhook/(?:send|upload_media)\?[^\s\x22\x27<>]*?key=)[^&\s\x22\x27<>]+', re.I)
BEARER = re.compile(r'Bearer\s+[A-Za-z0-9._~+/=-]{12,}', re.I)

def clean_text(text):
    return BEARER.sub('Bearer [REDACTED]', WEBHOOK.sub(r'\1[REDACTED]', text))

def sanitize(value):
    if isinstance(value, dict):
        return {k: '[REDACTED]' if SENSITIVE.match(k) else sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    return clean_text(value) if isinstance(value, str) else value

def main():
    stamp = datetime.now().astimezone().strftime('%Y%m%d-%H%M%S')
    destination = PROJECT / 'archives' / stamp
    destination.mkdir(parents=True, exist_ok=False)
    manifest = {'createdAt': datetime.now(timezone.utc).isoformat(), 'files': [], 'databases': [],
                'notes': ['Per-file snapshots; separate databases are not an atomic cross-database snapshot.',
                          'Aggregated business data publication explicitly authorized by user.',
                          'Restore is manual; credentials must be reauthorized; schedules must first be disabled.'],
                'excluded': ['Chrome and TA-Chrome profiles', 'CLI credentials and QR codes', '*.dpapi',
                             'dependency packages', 'live sent-slot marker files', '*.inspect.ndjson (render diagnostics)',
                             'unrelated workspace files and unprovided chat attachments']}

    def record(target, source, kind):
        manifest['files'].append({'path': target.relative_to(destination).as_posix(), 'source': source,
                                  'kind': kind, 'bytes': target.stat().st_size,
                                  'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})

    def copy(source, relative, origin):
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        suffix = source.suffix.lower()
        if suffix == '.sqlite':
            src = sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True, timeout=5)
            dst = sqlite3.connect(target)
            try:
                src.backup(dst)
                tables = [r[0] for r in dst.execute("SELECT name FROM sqlite_master WHERE type='table'")]
                if 'snapshots' in tables:
                    rows = []
                    for date, time, payload in dst.execute('SELECT date,time,payload FROM snapshots ORDER BY date,time').fetchall():
                        data = sanitize(json.loads(payload))
                        if data.get('date') != date or data.get('time') != time:
                            raise ValueError('snapshot key does not match payload: ' + str(source))
                        dst.execute('UPDATE snapshots SET payload=? WHERE date=? AND time=?',
                                    (json.dumps(data, ensure_ascii=False), date, time))
                        rows.append(data)
                    dst.commit()
                    exported = target.with_suffix('.snapshots.json')
                    exported.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
                    record(exported, origin, 'readable-snapshots')
                    manifest['databases'].append({'path': target.relative_to(destination).as_posix(),
                                                  'rows': len(rows),
                                                  'first': (rows[0]['date'] + ' ' + rows[0]['time']) if rows else None,
                                                  'last': (rows[-1]['date'] + ' ' + rows[-1]['time']) if rows else None})
                if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('SQLite integrity check failed: ' + str(source))
            finally:
                dst.close()
                src.close()
            kind = 'consistent-sqlite-backup'
        elif suffix in {'.json', '.jsonl', '.ndjson', '.log', '.csv', '.txt'}:
            text = source.read_text(encoding='utf-8-sig')
            if suffix == '.json':
                text = json.dumps(sanitize(json.loads(text)), ensure_ascii=False, indent=2)
            elif suffix in {'.jsonl', '.ndjson'}:
                text = '\n'.join(json.dumps(sanitize(json.loads(line)), ensure_ascii=False) for line in text.splitlines() if line.strip())
            else:
                text = clean_text(text)
            target.write_text(text, encoding='utf-8')
            kind = 'text-sanitized'
        else:
            if suffix == '.xlsx':
                with zipfile.ZipFile(source) as workbook:
                    for item in workbook.infolist():
                        if item.filename.endswith(('.xml', '.rels')):
                            text = workbook.read(item).decode('utf-8')
                            if clean_text(text) != text:
                                raise ValueError('Credential-like content in workbook; stop before publication: ' + str(source))
            shutil.copy2(source, target)
            kind = 'report-copy'
        record(target, origin, kind)

    output = ROOT / 'outputs' / 'gravity-wecom'
    allowed = {'.sqlite', '.xlsx', '.png', '.csv', '.json', '.jsonl', '.txt'}
    if output.exists():
        for source in sorted(output.rglob('*')):
            if source.is_file() and source.suffix.lower() in allowed:
                relative = source.relative_to(output)
                copy(source, Path('reports') / relative, 'workspace:outputs/gravity-wecom/' + relative.as_posix())
    local = Path(os.environ['LOCALAPPDATA']) / 'GravityWeComReport'
    if local.exists():
        for folder, directories, filenames in os.walk(local):
            directories[:] = sorted(d for d in directories if d not in {'Chrome', 'TA-Chrome', 'wecom-cli', 'node_modules', 'sent-slots'})
            for filename in sorted(filenames):
                source = Path(folder) / filename
                relative = source.relative_to(local)
                if source.suffix.lower() in allowed | {'.log'}:
                    copy(source, Path('runtime') / relative, 'LOCALAPPDATA:GravityWeComReport/' + relative.as_posix())
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'archive': str(destination), 'files': len(manifest['files']),
                      'databases': manifest['databases']}, ensure_ascii=False))

if __name__ == '__main__':
    main()
