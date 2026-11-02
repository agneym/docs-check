"""Synthetic offline operational-report tests; never launch providers or judges."""
import unittest
from unittest.mock import patch

import operations as o
import test_assemble


class SummaryTests(unittest.TestCase):
    def test_percentiles(self):
        self.assertEqual(o.distribution([0, 10, None, True]), {'n': 2, 'median': 5, 'p95': 9.5})
        self.assertIsNone(o.distribution([])['median'])

    def test_failed_usage_unknown_costs_and_latency(self):
        records = [
            {'workflow': 'parallel', 'outcome': {'status': 'failed', 'phase': 'setup', 'total_ms': None, 'provider_charge': None}, 'events_available': False},
            {'workflow': 'parallel', 'outcome': {'status': 'completed', 'total_ms': 100, 'retrieval_ms': 80, 'model_attempts': 1,
             'model_usage': [{'phase': 'answer', 'usage': {'input': 10, 'output': 2, 'cost': {'total': .1}}}], 'provider_charge': None}, 'events_available': True},
            {'workflow': 'parallel', 'outcome': {'status': 'failed', 'classification': 'deadline', 'total_ms': 200,
             'model_usage': [{'phase': 'answer', 'usage': {'input': 4, 'output': 1}}]}, 'events_available': True},
            {'workflow': 'parallel', 'outcome': {'status': 'not_run'}, 'events_available': False}]
        summary = o.summarize(records)['parallel']
        self.assertEqual(summary['local_attempts'], 3)
        self.assertEqual(summary['timeouts'], 1)
        self.assertEqual(summary['failures_by_class']['controller_setup_nonprovider'], 1)
        self.assertEqual(summary['latency_ms']['total_ms']['all_terminal']['median'], 150)
        self.assertEqual(summary['latency_ms']['total_ms']['completed_only']['median'], 100)
        self.assertEqual(summary['model_usage_by_phase']['answer']['tokens']['input']['observed'], 14)
        self.assertEqual(summary['model_usage_by_phase']['answer']['tokens']['totalTokens']['unknown_observations'], 2)
        self.assertEqual(summary['actual_charges_unknown'], 4)
        self.assertIsNone(summary['actual_total_cost'])
        self.assertEqual(summary['executions_missing_usage'], 2)

    def test_request_retry_and_poll_counts(self):
        events = [{'event': 'api_request', 'method': 'POST', 'url': 'https://api.parallel.ai/v1/tasks/runs', 'attempt': 0},
                  {'event': 'api_request', 'url': 'https://api.parallel.ai/v1/tasks/runs/task', 'attempt': 1},
                  {'event': 'api_request', 'url': 'https://api.parallel.ai/v1/tasks/runs/task/result', 'attempt': 0},
                  {'event': 'model_retry', 'attempt': 0}]
        counts = o.event_counts(events)
        self.assertEqual(counts['retrieval_request_attempts'], 3)
        self.assertEqual(counts['task_create_attempts'], 1)
        self.assertEqual(counts['task_status_poll_attempts'], 1)
        self.assertEqual(counts['task_result_get_attempts'], 1)
        self.assertEqual(counts['retrieval_retries'], 1)
        self.assertEqual(counts['model_retries'], 1)


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_assemble.AssemblyTests(methodName='test_append_only')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        f = self.fixture
        # Minimal assembly schedules intentionally omit scoring-only fields.
        f.schedule = [{**r, 'workflow': 'parallel'} for r in f.schedule]
        f.schedule_file(f.old, f.schedule)
        f.schedule_file(f.new, f.schedule[1:])
        f.put(f.new / 'executions/pending/events.jsonl', {'event': 'task_created'})
        f.put(f.new / 'executions/pending/isolation.json', {'vm_id': 'vm-1', 'exit_code': 0, 'stdout': 'FILESYSTEM_AND_EGRESS_BLOCKED', 'host_mounts': []})
        f.put(f.old / 'executions/failed/isolation.json', {'vm_id': 'vm-1', 'exit_code': 43, 'stdout': '', 'host_mounts': []})
        # Preserve an explicit setup classification in origin-bound bytes.
        outcome = o.load(f.old / 'executions/failed/outcome.json')
        outcome['phase'] = 'setup'
        f.put(f.old / 'executions/failed/outcome.json', outcome)
        manifest = o.load(f.new / 'manifest.json')
        manifest['origin']['outcomes']['failed'] = o.sha(f.old / 'executions/failed/outcome.json')
        f.put(f.new / 'manifest.json', manifest)
        f.launch(f.new, {'fixture_mode': True})
        for root in (f.old, f.new):
            f.put(root / 'leakage-audit.json', {'passed': True, 'canary_seen': False, 'no_host_mounts': True, 'no_contestant_tools': True})
        f.put(f.new / 'executions/pending/evidence.json', {'text': 'SECRET ANSWER', 'native_evidence_bytes': 123, 'original_bytes': 150, 'retained_bytes': 100, 'truncated': True})
        f.put(f.new / 'executions/pending/answer.json', {'text': 'SECRET ANSWER'})
        import assemble
        assemble.assemble(f.old, f.new, f.view)

    def test_new_report_is_private_and_no_quality_claim(self):
        f = self.fixture
        destination = f.base / 'operations'
        result = o.report(f.view, destination)
        self.assertEqual(result['scheduled'], 2)
        self.assertEqual(result['local_attempts'], 2)
        self.assertEqual(result['completed'], 1)
        self.assertEqual(result['vm_isolation']['duplicates'], ['vm-1'])
        self.assertIsNone(result['quality']['scores'])
        self.assertIsNone(result['quality']['confidence_intervals'])
        self.assertEqual(result['quality']['known_primary'][0]['score'], 0)
        self.assertEqual(result['workflows']['parallel']['evidence_truncated'], 1)
        self.assertNotIn('SECRET ANSWER', (destination / 'operations.json').read_text())
        self.assertNotIn('SECRET ANSWER', (destination / 'report.md').read_text())
        self.assertEqual(destination.stat().st_mode & 0o777, 0o700)
        self.assertTrue(result['source_record_sha256'])
        with self.assertRaises(ValueError):
            o.report(f.view, destination)

    def test_validation_required(self):
        with patch.object(o, 'validate_view', side_effect=ValueError('tamper')):
            with self.assertRaises(ValueError):
                o.report(self.fixture.view, self.fixture.base / 'invalid')
        self.assertFalse((self.fixture.base / 'invalid').exists())

    def test_missing_audit_is_unknown(self):
        f = self.fixture
        (f.new / 'leakage-audit.json').unlink()
        result = o.report(f.view, f.base / 'missing-audit')
        self.assertIsNone(result['source_terminal_audits'][1]['leakage_audit'])
