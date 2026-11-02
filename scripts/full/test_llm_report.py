"""Offline tests for the additive LLM analysis; no credentials or network."""
import copy
import json
import unittest
import test_scoring as fixtures
import scoring as s
import llm_report as llm


class LLMReportTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ScoringTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.f = self.fixture

    def snapshot(self):
        return llm.verify_source(self.f.run, self.f.key, self.f.public)

    def test_snapshot_is_read_only_and_binds_all_artifacts(self):
        before = {str(p): p.read_bytes() for p in self.f.run.rglob('*') if p.is_file()}
        snap = self.snapshot()
        self.assertEqual(snap['executions'], 2)
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.f.run.rglob('*') if p.is_file()})
        p = self.f.run / 'executions/parallel/answer.json'
        p.write_text('{"text":"tampered"}')
        with self.assertRaisesRegex(ValueError, 'artifact changed'):
            self.snapshot()

    def test_packet_tamper_and_duplicate_block(self):
        path = self.f.judging / 'judge-2-packets.json'
        packets = s.load(path)
        packets[0]['answer'] = 'changed'
        path.write_text(json.dumps(packets))
        with self.assertRaisesRegex(ValueError, 'packet changed'):
            self.snapshot()
        path.write_text(json.dumps([packets[0], packets[0]]))
        with self.assertRaisesRegex(ValueError, 'duplicate/missing'):
            self.snapshot()

    def test_labels_failure_zeros_unknown_verification_and_bootstrap(self):
        snap = self.snapshot()
        sealed = s.load(self.f.judging / 'blind-map.json')
        packets = {p['anonymous_id']: p for p in self.f.packets}
        chosen = {}
        for aid in packets:
            chosen[aid] = {'anonymous_id': aid, 'criteria': [{'id': 'c1', 'score': 1, 'retained_support': 'consistent_with_reference'}, {'id': 'c2', 'score': 0, 'retained_support': 'unknown'}],
                           'extra_claims': [], 'version': {'status': 'unsupported', 'compliant': True}, 'reference_concerns': []}
        audit = {'chosen': chosen, 'initial': {aid: [j, copy.deepcopy(j)] for aid, j in chosen.items()}, 'adjudicated_ids': [], 'metadata': {'judge_type': 'llm', 'actual_charges': None}}
        result = llm.make_results(snap, sealed, packets, audit)
        self.assertEqual(result['primary']['scores'], {'parallel': .75, 'context7': 0})
        self.assertEqual(result['primary']['ci95'], [.75, .75])
        self.assertEqual(result['bootstrap']['bootstrap_seed'], 9102026)
        self.assertEqual(result['agreement']['exact'], 1)
        self.assertEqual(result['workflows']['context7']['failed_zeros'], 1)
        self.assertFalse(next(r for r in result['records'] if not r['completed'])['rubric_perfect'])
        self.assertFalse(result['human_validated'])
        self.assertEqual(result['review_type'], 'llm-only')
        self.assertIsNone(result['workflows']['parallel']['citation_support_precision'])
        self.assertIsNone(result['workflows']['parallel']['independently_verified_evidence_coverage'])
        self.assertIsNone(result['judging']['actual_charges'])
        self.assertIsNone(result['infrastructure_excluded_sensitivity'])

    def test_missing_initial_not_imputed_zero_or_agreement(self):
        snap = self.snapshot()
        sealed = s.load(self.f.judging / 'blind-map.json')
        packets = {p['anonymous_id']: p for p in self.f.packets}
        chosen = {aid: {'anonymous_id': aid, 'criteria': [{'id': 'c1', 'score': 1, 'retained_support': 'unknown'}, {'id': 'c2', 'score': 1, 'retained_support': 'unknown'}],
                       'extra_claims': [], 'version': {'status': 'exact', 'compliant': True}, 'reference_concerns': []} for aid in packets}
        aids = list(packets)
        audit = {'chosen': chosen, 'initial': {aids[0]: [None, chosen[aids[0]]], aids[1]: [chosen[aids[1]], chosen[aids[1]]]}, 'adjudicated_ids': [aids[0]], 'metadata': {}}
        r = llm.make_results(snap, sealed, packets, audit)
        self.assertEqual(r['agreement']['valid_initial_pairs'], 1)
        self.assertEqual(r['agreement']['missing_initial_pairs'], 1)
        self.assertEqual(r['agreement']['criteria'], 2)
        self.assertEqual(r['agreement']['exact'], 1)
        self.assertEqual(r['primary']['scores'], {'parallel': 1, 'context7': 0})
        audit['initial'] = {aid: [None, None] for aid in packets}
        r = llm.make_results(snap, sealed, packets, audit)
        self.assertIsNone(r['agreement']['exact'])
        self.assertIsNone(r['agreement']['mean_absolute_difference'])
        self.assertEqual(r['primary']['scores'], {'parallel': 1, 'context7': 0})

    def test_original_human_scorer_still_rejects_llm_identity(self):
        p = self.f.packets[0]
        j = self.f.judgment(p, 'judge-1')
        j['judge_type'] = 'llm'
        with self.assertRaisesRegex(ValueError, 'human judge identity'):
            s.validate(j, p, 'judge-1')
