"""Exercise stale-build, identity collision and deterministic-package behavior offline."""
from pathlib import Path
import copy
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('maintenance',Path(__file__).with_name('repo-maintenance.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class MaintenanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads((m.ROOT/m.REGISTRY).read_text(encoding='utf-8'))
        cls.expected = m.generated_files(cls.registry)

    def test_same_inputs_produce_identical_packages_and_state(self):
        again = m.generated_files(self.registry)
        self.assertEqual(self.expected,again)
        self.assertEqual(m.zip_bytes({'b':b'2','a':b'1'}),m.zip_bytes({'a':b'1','b':b'2'}))

    def test_source_edit_changes_reference_package_and_fingerprint(self):
        original = m.file_bytes
        source = 'projects/beite-hourly-report/docs/metrics.md'
        def changed(path):
            return original(path)+(b'\nUpdated verified metric.\n' if path==source else b'')
        with patch.object(m,'file_bytes',side_effect=changed):
            expected = m.generated_files(self.registry)
        for path in ['.codex/skills/beite-hourly-report/references/metrics.md',
                     'projects/beite-hourly-report/packages/beite-hourly-report-codex-skill.zip',m.STATE]:
            self.assertNotEqual(self.expected[path],expected[path])
            self.assertIn(path,m.stale_files(expected))

    def test_manual_reference_edit_is_detected(self):
        original = m.file_bytes
        target = '.codex/skills/beite-hourly-report/references/metrics.md'
        with patch.object(m,'file_bytes',side_effect=lambda p:original(p)+(b'changed' if p==target else b'')):
            self.assertIn(target,m.stale_files(self.expected))

    def test_shared_id_cannot_silently_merge_projects(self):
        registry = copy.deepcopy(self.registry)
        hero = next(p for p in registry['projects'] if p['id']=='hero-hourly')
        hero['sources'][0].pop('requiresContext')
        with self.assertRaisesRegex(ValueError,'explicit context'):
            m.validate_registry(registry)

    def test_alias_and_unknown_plugin_target_rejected(self):
        registry = copy.deepcopy(self.registry)
        registry['projects'][1]['aliases'].append(registry['projects'][0]['name'])
        with self.assertRaisesRegex(ValueError,'Ambiguous name'):
            m.validate_registry(registry)
        registry = copy.deepcopy(self.registry)
        registry['skills'][0]['pluginSkills'].append('missing-skill')
        with self.assertRaisesRegex(ValueError,'Unknown plugin skill'):
            m.validate_registry(registry)

    def test_real_shaped_webhook_is_rejected_without_printing_secret(self):
        with tempfile.TemporaryDirectory(dir=m.ROOT/'outputs') as temp:
            path = Path(temp)/'message.json'
            key = '-'.join(['1'*8,'1'*4,'1'*4,'1'*4,'1'*12])
            path.write_text(json.dumps({'url':'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key='+key}),encoding='utf-8')
            self.assertEqual(len(m.credential_errors([path])),1)
            path.write_text('{"url":"[REDACTED]"}',encoding='utf-8')
            self.assertEqual(m.credential_errors([path]),[])

    def test_windows_and_unix_text_are_equivalent(self):
        self.assertEqual(m.text_bytes('甲\r\n乙\r\n'),m.text_bytes('甲\n乙\n'))

if __name__=='__main__':
    # CI checkout does not contain ignored output folders.
    (m.ROOT/'outputs').mkdir(exist_ok=True)
    unittest.main()
