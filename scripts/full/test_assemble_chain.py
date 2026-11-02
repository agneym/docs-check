"""Offline chain validation, including the immutable real base."""
import unittest
from pathlib import Path
import assemble as a
import assemble_chain as chain
from test_assemble import AssemblyTests


class ChainTests(unittest.TestCase):
    put = AssemblyTests.put
    schedule_file = AssemblyTests.schedule_file
    launch = AssemblyTests.launch

    def setUp(self):
        AssemblyTests.setUp(self)
        self.schedule = [dict(r, question_id=r['execution_id'], workflow='parallel', repeat=1) for r in self.schedule]
        self.schedule_file(self.old, self.schedule)
        self.schedule_file(self.new, self.schedule[1:])
        for root, eid, status in [(self.old, 'failed', 'failed'), (self.old, 'pending', 'not_run'), (self.new, 'pending', 'not_run')]:
            row = next(r for r in self.schedule if r['execution_id'] == eid)
            self.put(root / f'executions/{eid}/outcome.json', dict(row, status=status, config_hash=self.hash))
        c = a.load(self.new / 'manifest.json')
        c['origin']['outcomes'] = {r['execution_id']: a.sha(self.old / f"executions/{r['execution_id']}/outcome.json") for r in self.schedule}
        self.put(self.new / 'manifest.json', c)
        self.launch(self.new, {'fixture_mode': True})
        a.assemble(self.old, self.new, self.view)
        self.second, self.dest = self.base / 'second', self.base / 'chain'
        self.second.mkdir()
        self.schedule_file(self.second, self.schedule[1:])
        self.put(self.second / 'manifest.json', {'phase': 'full-first-pass-continuation-2', 'base_view': {'run': str(self.view), 'provenance_sha256': a.sha(self.view / 'view-provenance.json'), 'manifest_sha256': a.sha(self.view / 'manifest.json'), 'launch_sha256': a.sha(self.view / 'launch.json'), 'outcomes': {r['execution_id']: a.sha(self.view / f"executions/{r['execution_id']}/outcome.json") for r in self.schedule}}})
        self.launch(self.second, {'fixture_mode': True})
        self.put(self.second / 'campaign-terminal.json', {'status': 'pass-ended'})
        self.put(self.second / 'executions/pending/outcome.json', dict(self.schedule[1], status='completed', config_hash=self.hash))

    # Override inherited first-view tests: this fixture intentionally leaves pending work.
    def test_append_only(self):
        chain.assemble(self.view, self.second, self.dest)
        metadata = a.validate_view(self.dest)
        self.assertTrue(metadata['campaign_complete'])
        self.assertEqual(len(metadata['source_roots']), 3)
        incident = metadata['operational_incident']
        self.assertEqual(incident['prior'], a.load(self.view / 'view-provenance.json')['operational_incident'])
        self.assertEqual(incident['stage'], 'second-continuation')
        self.assertIsNone(incident['sensitivity_plan'])
        self.assertIn('plaintext', incident['classification'])
        self.assertIn('pause', incident['implementation_change'])
        self.assertEqual((self.dest / 'manifest.json').read_bytes(), (self.view / 'manifest.json').read_bytes())
        self.assertEqual(a.load(self.view / 'executions/pending/outcome.json')['status'], 'not_run')
        with self.assertRaises(ValueError):
            chain.assemble(self.view, self.second, self.dest)
        (self.second / 'executions/pending/outcome.json').write_text('{}')
        with self.assertRaises((ValueError, KeyError)):
            a.validate_view(self.dest)

    def test_operations_all_three_roots(self):
        import operations
        chain.assemble(self.view, self.second, self.dest)
        output = self.base / 'operations'
        operations.report(self.dest, output)
        self.assertEqual(len(a.load(output / 'operations.json')['source_terminal_audits']), 3)

    def test_predeclared_sensitivity_plan_carried(self):
        manifest = a.load(self.second / 'manifest.json')
        plan = {'primary_includes_all_failed_zeros': True, 'infrastructure_affected_question_ids': ['nextjs-12', 'takumi-02', 'takumi-05', 'takumi-07'], 'paired_exclusion_diagnostic_only': True}
        manifest['sensitivity_plan'] = plan
        self.put(self.second / 'manifest.json', manifest)
        self.launch(self.second, {'fixture_mode': True})
        self.assertEqual(chain.inventory(self.view, self.second)['operational_incident']['sensitivity_plan'], plan)

    def test_schedule_rejected(self):
        self.schedule_file(self.second, self.schedule)
        with self.assertRaises(ValueError):
            chain.inventory(self.view, self.second)

    def test_nested_chain_rejected(self):
        chain.assemble(self.view, self.second, self.dest)
        with self.assertRaises(ValueError):
            chain.inventory(self.dest, self.second)


class RealBaseTests(unittest.TestCase):
    def test_real_base_read_only(self):
        root = Path.home() / 'random/docs-check-runs/2026-11-01-first-pass-view-1'
        if not root.exists():
            self.skipTest('real base not installed')
        metadata = a.validate_view(root)
        self.assertFalse(metadata['campaign_complete'])
        from collections import Counter
        self.assertEqual(Counter(a.load(root / f"executions/{r['execution_id']}/outcome.json")['status'] for r in a.rows(root)), {'completed': 2, 'failed': 6, 'not_run': 88})
