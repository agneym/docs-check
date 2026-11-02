"""Synthetic append-only assembly regression tests; no network."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import assemble as a


class AssemblyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.old, self.new, self.view = [self.base / n for n in ('old', 'new', 'view')]
        self.schedule = [{'execution_id': n} for n in ('failed', 'pending')]
        config = {'fixture_mode': True}
        self.hash = hashlib.sha256(json.dumps(config, separators=(',', ':')).encode()).hexdigest()
        for root in (self.old, self.new):
            root.mkdir()
            self.put(root / 'manifest.json', {'config': config})
            self.put(root / 'campaign-terminal.json', {'status': 'pass-ended'})
        for eid, status in [('failed', 'failed'), ('pending', 'not_run')]:
            self.put(self.old / f'executions/{eid}/outcome.json', {'status': status, 'config_hash': self.hash})
        self.put(self.new / 'executions/pending/outcome.json', {'status': 'completed', 'config_hash': self.hash})
        self.schedule_file(self.old, self.schedule)
        self.schedule_file(self.new, self.schedule[1:])
        self.launch(self.old, config)
        self.put(self.new / 'manifest.json', {'phase': 'full-first-pass-continuation', 'config': config, 'origin': {'run': str(self.old), 'manifest_sha256': a.sha(self.old / 'manifest.json'), 'launch_sha256': a.sha(self.old / 'launch.json'), 'outcomes': {r['execution_id']: a.sha(self.old / f"executions/{r['execution_id']}/outcome.json") for r in self.schedule}}})
        self.launch(self.new, config)

    def put(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value))

    def schedule_file(self, root, rows):
        (root / 'schedule.jsonl').write_text(''.join(json.dumps(r) + '\n' for r in rows))

    def launch(self, root, config):
        self.put(root / 'launch.json', {'manifest_sha256': a.sha(root / 'manifest.json'), 'resolved_config': config, 'execution_config_hash': self.hash})

    def test_append_only(self):
        a.assemble(self.old, self.new, self.view)
        self.assertEqual(a.load(self.view / 'executions/failed/outcome.json')['status'], 'failed')
        self.assertEqual(a.load(self.old / 'executions/pending/outcome.json')['status'], 'not_run')
        self.assertEqual((self.old / 'manifest.json').read_bytes(), (self.view / 'manifest.json').read_bytes())
        self.assertTrue(a.validate_view(self.view)['campaign_complete'])
        with self.assertRaises(ValueError):
            a.assemble(self.old, self.new, self.view)

    def test_bad_schedule(self):
        for rows in (self.schedule, self.schedule[1:] * 2, []):
            self.schedule_file(self.new, rows)
            with self.assertRaises(ValueError):
                a.assemble(self.old, self.new, self.view)

    def test_old_outcome_tamper(self):
        for eid in ('failed', 'pending'):
            p = self.old / f'executions/{eid}/outcome.json'
            original = p.read_bytes()
            p.write_bytes(original + b' ')
            with self.assertRaises(ValueError):
                a.assemble(self.old, self.new, self.view)
            p.write_bytes(original)

    def test_source_and_copy_tamper(self):
        a.assemble(self.old, self.new, self.view)
        for root in (self.new, self.view):
            p = root / 'executions/pending/outcome.json'
            original = p.read_bytes()
            p.write_bytes(original + b' ')
            with self.assertRaises(ValueError):
                a.validate_view(self.view)
            p.write_bytes(original)

    def test_optional_origin_terminal_and_claim_hashes(self):
        claim = self.base / 'claim.json'
        claim.write_text('{}')
        manifest = a.load(self.new / 'manifest.json')
        manifest['origin'].update({'terminal_sha256': a.sha(self.old / 'campaign-terminal.json'),
                                   'schedule_sha256': a.sha(self.old / 'schedule.jsonl'),
                                   'claim_path': str(claim), 'claim_sha256': a.sha(claim)})
        self.put(self.new / 'manifest.json', manifest)
        self.launch(self.new, {'fixture_mode': True})
        a.assemble(self.old, self.new, self.view)
        for path in (claim, self.old / 'campaign-terminal.json', self.old / 'schedule.jsonl'):
            before = path.read_bytes()
            path.write_bytes(before + b' ')
            with self.assertRaises(ValueError):
                a.validate_view(self.view)
            path.write_bytes(before)

    def test_incomplete(self):
        self.put(self.new / 'executions/pending/outcome.json', {'status': 'not_run', 'config_hash': self.hash})
        a.assemble(self.old, self.new, self.view)
        self.assertFalse(a.validate_view(self.view)['campaign_complete'])
