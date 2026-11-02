"""Synthetic offline fixtures only; run: python3 -m unittest discover -s scripts/full -v."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
import scoring as s


class ScoringTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.run = self.root / 'run'
        self.run.mkdir()
        self.key = self.root / 'key.json'
        self.public = self.root / 'questions.jsonl'
        q = {'id': 'synthetic-01', 'project': 'synthetic', 'product': 'Test', 'question': 'Why?', 'version_context': 'v1', 'difficulty': 'easy', 'category': 'api', 'criteria': [{'id': 'c1', 'weight': 3}, {'id': 'c2', 'weight': 1}], 'evidence': [{'id': 'e1'}]}
        s.save(self.key, [q])
        self.public.write_text(json.dumps(q) + '\n')
        s.save(self.run / 'manifest.json', {'config': {'fixture_mode': True, 'judging': {'seed': 612024, 'bootstrap_seed': 9102026, 'bootstrap_samples': 10000}}})
        self.schedule = [{'execution_id': w, 'question_id': q['id'], 'workflow': w, 'repeat': 1} for w in ('parallel', 'context7')]
        (self.run / 'schedule.jsonl').write_text(''.join(json.dumps(r) + '\n' for r in self.schedule))
        for r in self.schedule:
            d = self.run / 'executions' / r['execution_id']
            d.mkdir(parents=True)
            s.save(d / 'outcome.json', {'status': 'completed' if r['workflow'] == 'parallel' else 'timeout', 'total_ms': 100})
            s.save(d / 'answer.json', {'text': 'Correct answer', 'provider': 'SECRET'})
            s.save(d / 'evidence.json', {'packet': 'Official support'})
        self.judging = self.run / 'judging'
        s.prepare(self.run, self.key, self.public, self.judging)
        self.packets = s.load(self.judging / 'judge-1-packets.json')
        self.add_support_cache(self.judging)

    def add_support_cache(self, directory):
        (directory / 'support.txt').write_text('Official support')
        s.save(directory / 'citation-cache.json', {'support': {'url': 'https://example.org/support', 'path': 'support.txt', 'verified_at': '2026-11-01T00:00:00Z', 'sha256': s.hashlib.sha256(b'Official support').hexdigest()}})

    def judgment(self, packet, judge):
        return {'anonymous_id': packet['anonymous_id'], 'judge_id': judge, 'judge_type': 'human', 'reviewer': judge,
                'criteria': [{'id': cid, 'score': score, 'quote': 'Correct', 'evidence_refs': ['e1'], 'returned_support': 'verified', 'retained_quote': 'Official support', 'verification_notes': 'Independently compared retained wording to archived official documentation.', 'cache_refs': ['support']} for cid, score in [('c1', 1), ('c2', 0)]],
                'version': {'status': 'unsupported', 'compliant': True, 'rationale': 'Honest canary disclosure, no false assertion.'}, 'extra_claims': [],
                'citations': {'material_claims': 1, 'cited_claims': 0, 'links': []}}

    def write_judges(self, disagree=False):
        for judge in ('judge-1', 'judge-2'):
            rows = [self.judgment(p, judge) for p in self.packets]
            if disagree and judge == 'judge-2':
                rows[0]['criteria'][0]['score'] = .5
            (self.judging / f'{judge}.jsonl').write_text(''.join(json.dumps(r) + '\n' for r in rows))

    def test_packets_sealed_and_no_overwrite(self):
        self.assertNotIn('SECRET', json.dumps(self.packets))
        self.assertEqual((self.judging / 'blind-map.json').stat().st_mode & 0o777, 0o600)
        a = {p['anonymous_id'] for p in self.packets}
        self.assertEqual(a, {p['anonymous_id'] for p in s.load(self.judging / 'judge-2-packets.json')})
        with self.assertRaises(FileExistsError):
            s.prepare(self.run, self.key, self.public, self.judging)

    def test_assembled_failure_zero(self):
        import assemble
        original = self.run
        manifest = s.load(original / 'manifest.json')
        config = manifest['config']
        config_hash = s.hashlib.sha256(json.dumps(config, separators=(',', ':')).encode()).hexdigest()
        launch = {'resolved_config': config, 'execution_config_hash': config_hash,
                  'manifest_sha256': assemble.sha(original / 'manifest.json')}
        s.save(original / 'launch.json', launch)
        s.save(original / 'campaign-terminal.json', {'status': 'paused'})
        for eid, status in [('parallel', 'failed'), ('context7', 'not_run')]:
            (original / f'executions/{eid}/outcome.json').write_text(json.dumps({'status': status, 'config_hash': config_hash}))
        continuation = self.root / 'continuation'
        continuation.mkdir()
        origin = {'run': str(original), 'manifest_sha256': assemble.sha(original / 'manifest.json'),
                  'launch_sha256': assemble.sha(original / 'launch.json'),
                  'outcomes': {r['execution_id']: assemble.sha(original / 'executions' / r['execution_id'] / 'outcome.json') for r in self.schedule}}
        s.save(continuation / 'manifest.json', {'phase': 'full-first-pass-continuation', 'origin': origin})
        s.save(continuation / 'launch.json', {**launch, 'manifest_sha256': assemble.sha(continuation / 'manifest.json')})
        s.save(continuation / 'campaign-terminal.json', {'status': 'pass-ended'})
        (continuation / 'schedule.jsonl').write_text(json.dumps(self.schedule[1]) + '\n')
        d = continuation / 'executions/context7'
        d.mkdir(parents=True)
        s.save(d / 'outcome.json', {'status': 'completed', 'config_hash': config_hash})
        for name in ('answer.json', 'evidence.json'):
            (d / name).write_bytes((original / 'executions/context7' / name).read_bytes())
        view = self.root / 'view'
        assemble.assemble(original, continuation, view)
        self.judging = view / 'judging'
        s.prepare(view, self.key, self.public, self.judging)
        self.packets = s.load(self.judging / 'judge-1-packets.json')
        self.assertNotIn('view_provenance', json.dumps(self.packets))
        self.add_support_cache(self.judging)
        self.write_judges()
        result = s.report(view, self.key, self.public, self.judging, self.root / 'merged-report')
        self.assertEqual(result['primary']['scores']['parallel'], 0)
        self.assertTrue(result['campaign_complete'])
        self.assertIsNotNone(result['view_provenance'])
        (view / 'executions/context7/answer.json').write_text('{}')
        with self.assertRaises(ValueError):
            s.prepare(view, self.key, self.public, self.root / 'bad-judging')

    def test_validation(self):
        p = self.packets[0]
        original = self.judgment(p, 'judge-1')
        for field, value in [('score', True), ('score', .2), ('quote', 'invented'), ('evidence_refs', ['bad'])]:
            j = copy.deepcopy(original)
            j['criteria'][0][field] = value
            with self.assertRaises(ValueError):
                s.validate(j, p, 'judge-1')
        j = copy.deepcopy(original)
        j['criteria'][0].pop('quote')
        j['criteria'][0]['omission'] = 'Missing required qualification'
        s.validate(j, p, 'judge-1')

    def test_report_weight_failure_cost_and_bootstrap(self):
        self.write_judges()
        out = self.root / 'report'
        r = s.report(self.run, self.key, self.public, self.judging, out)
        self.assertEqual(r['primary']['scores'], {'parallel': .75, 'context7': 0})
        self.assertEqual(r['primary']['ci95'], [.75, .75])
        failed = next(x for x in r['records'] if not x['completed'])
        self.assertEqual(failed['score'], 0)
        self.assertTrue(failed['partial_answer_diagnostic_only'])
        self.assertFalse(failed['rubric_perfect'])
        self.assertFalse(failed['fully_correct'])
        self.assertIn(False, r['breakdowns']['multi_source'])
        self.assertIn(False, r['breakdowns']['false_premise'])
        self.assertIsNone(r['workflows']['parallel']['total_actual_cost'])
        self.assertIsNone(r['workflows']['parallel']['citation_support_precision'])
        self.assertEqual(r['workflows']['parallel']['citation_coverage'], 0)
        with self.assertRaises(FileExistsError):
            s.report(self.run, self.key, self.public, self.judging, out)

    def test_disagreement_blocks(self):
        self.write_judges(disagree=True)
        with self.assertRaisesRegex(ValueError, 'adjudication required'):
            s.report(self.run, self.key, self.public, self.judging, self.root / 'out')

    def test_tamper_blocks(self):
        self.write_judges()
        (self.run / 'executions/parallel/answer.json').write_text('{"text":"changed"}')
        with self.assertRaisesRegex(ValueError, 'artifact changed'):
            s.report(self.run, self.key, self.public, self.judging, self.root / 'out')

    def test_manifest_seed_and_packet_tamper(self):
        self.write_judges()
        r = s.report(self.run, self.key, self.public, self.judging, self.root / 'seed-report')
        self.assertEqual(r['bootstrap']['seed'], 9102026)
        packets = s.load(self.judging / 'judge-1-packets.json')
        packets[0]['answer'] = 'edited'
        (self.judging / 'judge-1-packets.json').write_text(json.dumps(packets))
        with self.assertRaisesRegex(ValueError, 'packet changed'):
            s.report(self.run, self.key, self.public, self.judging, self.root / 'bad')

    def test_cache_and_missing_url(self):
        p = copy.deepcopy(self.packets[0])
        p['answer'] = 'Correct https://example.org/page'
        j = self.judgment(p, 'judge-1')
        with self.assertRaisesRegex(ValueError, 'omitted distinct'):
            s.verify_caches(j, p, self.judging)
        for c in j['criteria']:
            c['returned_support'] = 'unknown'
        j['citations']['links'] = [{'url': 'https://example.org/page', 'quote': 'Correct', 'cache_ref': 'page'}]
        body = self.judging / 'page.txt'
        body.write_text('Official page')
        (self.judging / 'citation-cache.json').unlink()
        s.save(self.judging / 'citation-cache.json', {'page': {'url': 'https://example.org/page', 'path': 'page.txt', 'verified_at': '2026-11-01T00:00:00Z', 'sha256': s.hashlib.sha256(body.read_bytes()).hexdigest()}})
        s.verify_caches(j, p, self.judging)
        body.write_text('tampered')
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            s.verify_caches(j, p, self.judging)

    def test_manifest_byte_hash(self):
        m = s.load(self.run / 'manifest.json')
        m['config']['fixture_mode'] = False
        m['hashes'] = {}
        (self.run / 'manifest.json').write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError, 'manifest byte hash'):
            s.campaign(self.run, self.key, self.public)

    def test_pairing(self):
        (self.run / 'schedule.jsonl').write_text(json.dumps(self.schedule[0]) + '\n')
        with self.assertRaisesRegex(ValueError, 'unpaired'):
            s.campaign(self.run, self.key, self.public)

    def test_reference_multi_source_breakdown(self):
        key = s.load(self.key)
        key[0]['evidence'] = [{'id': 'e1', 'path': 'one.md'}, {'id': 'e2', 'path': 'two.md'}]
        self.key.write_text(json.dumps(key))
        other = self.run / 'judging-multi'
        s.prepare(self.run, self.key, self.public, other)
        self.judging = other
        self.add_support_cache(other)
        self.packets = s.load(other / 'judge-1-packets.json')
        self.write_judges()
        r = s.report(self.run, self.key, self.public, other, self.root / 'multi-report')
        self.assertTrue(all(x['multi_source'] for x in r['records']))
        self.assertIn(True, r['breakdowns']['multi_source'])

    def test_independent_support_verification_required(self):
        p = self.packets[0]
        for field in ('verification_notes', 'retained_quote', 'cache_refs'):
            j = self.judgment(p, 'judge-1')
            del j['criteria'][0][field]
            with self.assertRaises(ValueError):
                s.verify_caches(j, p, self.judging)
        j = self.judgment(p, 'judge-1')
        j['extra_claims'] = [{'quote': 'Correct', 'verdict': 'correct', 'severity': 'minor', 'rationale': 'Checked', 'evidence_refs': ['e1']}]
        with self.assertRaisesRegex(ValueError, 'extra claim independent'):
            s.verify_caches(j, p, self.judging)
        j['extra_claims'][0]['cache_refs'] = ['support']
        s.verify_caches(j, p, self.judging)

    def test_incomplete_campaign_counts(self):
        path = self.run / 'executions/context7/outcome.json'
        path.write_text(json.dumps({'status': 'not_run'}))
        other = self.run / 'interim-judging'
        s.prepare(self.run, self.key, self.public, other)
        self.judging = other
        self.add_support_cache(other)
        self.packets = s.load(other / 'judge-1-packets.json')
        self.write_judges()
        r = s.report(self.run, self.key, self.public, other, self.root / 'interim')
        self.assertFalse(r['campaign_complete'])
        self.assertEqual(r['executions_started'], 1)
        self.assertEqual(r['scheduled_executions'], 2)

    def test_launch_config_and_outcome_hashes(self):
        manifest_path = self.run / 'manifest.json'
        resolved = s.load(manifest_path)['config']
        resolved['spending'] = {'policy': 'uncapped-explicitly-approved', 'cap': None}
        h = s.hashlib.sha256(json.dumps(resolved, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        launch = {'resolved_config': resolved, 'execution_config_hash': h, 'manifest_sha256': s.hashlib.sha256(manifest_path.read_bytes()).hexdigest()}
        s.save(self.run / 'launch.json', launch)
        for row in self.schedule:
            path = self.run / 'executions' / row['execution_id'] / 'outcome.json'
            outcome = s.load(path)
            outcome['config_hash'] = h
            path.write_text(json.dumps(outcome))
        other = self.run / 'launch-judging'
        s.prepare(self.run, self.key, self.public, other)
        self.judging = other
        self.add_support_cache(other)
        self.packets = s.load(other / 'judge-1-packets.json')
        self.write_judges()
        r = s.report(self.run, self.key, self.public, other, self.root / 'launch-report')
        self.assertEqual(r['resolved_config']['spending']['policy'], 'uncapped-explicitly-approved')
        self.assertNotIn('resolved_config', self.packets[0])
        path = self.run / 'executions/parallel/outcome.json'
        outcome = s.load(path)
        outcome['config_hash'] = 'wrong'
        path.write_text(json.dumps(outcome))
        with self.assertRaisesRegex(ValueError, 'outcome execution config hash'):
            s.report(self.run, self.key, self.public, other, self.root / 'bad-launch')

    def test_infrastructure_sensitivity_preserves_primary(self):
        rows = [{'family': 'f', 'question_id': str(i), 'workflow': w, 'score': 0 if i < 4 else 1} for i in range(48) for w in ('parallel', 'context7')]
        before = copy.deepcopy(rows)
        primary = s.analysis(rows)
        plan = {'primary_includes_all_failed_zeros': True, 'infrastructure_affected_question_ids': ['0', '1', '2', '3'], 'paired_exclusion_diagnostic_only': True}
        diagnostic = s.infrastructure_sensitivity(rows, plan)
        self.assertEqual(diagnostic['paired_questions'], 44)
        self.assertEqual(diagnostic['analysis'], s.analysis(rows[8:]))
        self.assertTrue(diagnostic['diagnostic_only'])
        self.assertEqual(rows, before)
        self.assertEqual(primary, s.analysis(rows))
        self.assertEqual(len(rows), 96)
        self.assertIsNone(s.infrastructure_sensitivity(rows, None))

    def test_family_macro_and_frozen_bootstrap(self):
        rows = [{'family': f, 'question_id': f + str(i), 'workflow': w, 'score': value if w == 'parallel' else 0} for f, count, value in [('large', 3, 1), ('small', 1, 0)] for i in range(count) for w in ('parallel', 'context7')]
        a = s.analysis(rows)
        self.assertEqual(a['scores']['parallel'], .5)
        self.assertEqual(a, s.analysis(rows))


if __name__ == '__main__':
    unittest.main()
