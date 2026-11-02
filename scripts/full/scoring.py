#!/usr/bin/env python3
"""Offline provider-label-blinded human scoring. No network dependencies."""
import argparse
import hashlib
import json
import math
import os
import random
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from assemble import validate_view as validate_report_view

BOOTSTRAP_SEED = 20261101
BOOTSTRAP_SAMPLES = 10000
PILOT = {'nextjs-02', 'tanstack-06'}


def infrastructure_sensitivity(records, plan, seed=BOOTSTRAP_SEED, samples=BOOTSTRAP_SAMPLES):
    """Predeclared paired exclusion diagnostic; never alters primary records."""
    if plan is None:
        return None
    require(plan.get('primary_includes_all_failed_zeros') is True and plan.get('paired_exclusion_diagnostic_only') is True, 'invalid infrastructure sensitivity plan')
    excluded = plan['infrastructure_affected_question_ids']
    require(isinstance(excluded, list) and all(isinstance(q, str) for q in excluded) and len(set(excluded)) == len(excluded), 'invalid sensitivity question IDs')
    retained = [r for r in records if r['question_id'] not in set(excluded)]
    return {'diagnostic_only': True, 'excluded_question_ids': excluded,
            'paired_questions': len({r['question_id'] for r in retained}),
            'caveat': 'Predeclared infrastructure exclusion only; mixed implementations and interrupted windows remain confounded. Primary retains all failed zeros; no provider-quality winner inferred.',
            'analysis': analysis(retained, seed, samples)}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def load(path):
    return json.loads(Path(path).read_text())


def lines(path):
    return [json.loads(s) for s in Path(path).read_text().splitlines() if s.strip()]


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def save(path, value, private=False):
    path = Path(path)
    with path.open('x') as stream:
        if private:
            os.chmod(path, 0o600)
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write('\n')


def campaign(run, key_path, questions_path):
    if (run / 'completed-view').exists() or (run / 'view-provenance.json').exists() or (run / 'manifest.json').is_file() and load(run / 'manifest.json').get('phase') == 'full-first-pass-continuation':
        from assemble import validate_view
        validate_view(run)
    manifest = load(run / 'manifest.json')
    require(isinstance(manifest.get('config'), dict), 'manifest.config required')
    fixture = manifest['config'].get('fixture_mode') is True
    if not fixture:
        for name, path in [('evaluation/questions.jsonl', questions_path), ('evaluation/answer-key.json', key_path), ('schedule.jsonl', run / 'schedule.jsonl')]:
            require(manifest.get('hashes', {}).get(name) == hashlib.sha256(Path(path).read_bytes()).hexdigest(), 'manifest byte hash mismatch: ' + name)
    key = {r['id']: r for r in load(key_path)}
    public = {r['id']: r for r in lines(questions_path)}
    schedule = lines(run / 'schedule.jsonl')
    require(schedule, 'empty schedule')
    seen, pairs = set(), defaultdict(set)
    for r in schedule:
        eid = r['execution_id']
        require(isinstance(eid, str) and Path(eid).name == eid and eid not in {'.', '..'}, 'unsafe execution ID')
        require(eid not in seen, 'duplicate execution ID')
        seen.add(eid)
        q = r['question_id']
        require(q in key and q in public, 'unknown question')
        require(r['workflow'] in {'parallel', 'context7'} and r['repeat'] == 1, 'first pass only')
        require(r['workflow'] not in pairs[q], 'duplicate question/workflow')
        pairs[q].add(r['workflow'])
    require(all(len(v) == 2 for v in pairs.values()), 'unpaired schedule')
    if not fixture:
        require(len(schedule) == 96 and len(pairs) == 48 and set(pairs) == set(key) == set(public), 'production requires exactly 96 executions / 48 questions')
        require(sorted(Counter(key[q]['project'] for q in pairs).values()) == [12, 12, 12, 12], 'production families must be balanced')
    return manifest, key, public, schedule


def prepare(run, key_path, questions_path, destination):
    manifest, key, public, schedule = campaign(run, key_path, questions_path)
    settings = manifest['config']['judging']
    seeds = tuple(int.from_bytes(hashlib.sha256(f"{settings['seed']}:{judge}".encode()).digest()[:8], 'big') for judge in ('judge-1', 'judge-2'))
    require(settings['bootstrap_samples'] == 10000, 'protocol requires 10000 bootstrap samples')
    destination.mkdir(mode=0o700)  # exclusive: never merge with existing judging
    packets, mapping = [], []
    ids = list(range(len(schedule)))
    random.Random(BOOTSTRAP_SEED).shuffle(ids)
    for r, number in zip(schedule, ids):
        directory = run / 'executions' / r['execution_id']
        outcome = load(directory / 'outcome.json')
        answer = load(directory / 'answer.json') if (directory / 'answer.json').exists() else {}
        evidence = load(directory / 'evidence.json') if (directory / 'evidence.json').exists() else {}
        aid = f'A{number + 1:04d}'
        # Only text is exported, not provider/model wrappers or operational metadata.
        text = answer.get('text', '')
        require(isinstance(text, str), 'answer.text must be string')
        packet = {'anonymous_id': aid, 'request': {k: public[r['question_id']][k] for k in ('product', 'version_context', 'question')},
                  'answer': text, 'reference': key[r['question_id']],
                  'retained_evidence': evidence.get('packet', evidence.get('text', ''))}
        packets.append(packet)
        mapping.append({**r, 'anonymous_id': aid, 'status': outcome['status'],
                        'artifact_hash': digest([outcome, answer, evidence])})
    save(destination / 'blind-map.json', {'manifest_hash': digest(manifest), 'schedule_hash': digest(schedule),
         'view_hash': digest(load(run / 'view-provenance.json')) if (run / 'view-provenance.json').exists() else None,
         'key_hash': digest(key), 'public_hash': digest(public), 'packet_hash': digest(sorted(packets, key=lambda p: p['anonymous_id'])), 'rows': mapping}, private=True)
    for judge, seed in zip(('judge-1', 'judge-2'), seeds):
        order = list(packets)
        random.Random(seed).shuffle(order)
        save(destination / f'{judge}-packets.json', order)
    save(destination / 'preparation.json', {'seeds': seeds, 'bootstrap_seed': settings['bootstrap_seed'],
         'blinding': 'Provider-label blinding only; wording and URLs may reveal provenance.'})


def nonempty(x):
    return isinstance(x, str) and bool(x.strip())


def validate(j, packet, judge):
    require(j.get('judge_id') == judge and j.get('judge_type') == 'human', 'independent human judge identity required')
    require(nonempty(j.get('reviewer')), 'named reviewer required')
    criteria = packet['reference']['criteria']
    rows = j.get('criteria', [])
    require(len(rows) == len(criteria) and {x['id'] for x in rows} == {x['id'] for x in criteria}, 'criterion set mismatch')
    refs = {e['id'] for e in packet['reference']['evidence']}
    for c in rows:
        require(type(c.get('score')) in (int, float) and c['score'] in (0, .5, 1), 'invalid score')
        quote, omission = c.get('quote'), c.get('omission')
        require(bool(nonempty(quote)) != bool(nonempty(omission)), 'quote XOR omission required')
        require(not quote or quote in packet['answer'], 'quotation not in answer')
        require(isinstance(c.get('evidence_refs'), list) and c['evidence_refs'] and set(c['evidence_refs']) <= refs, 'invalid reference evidence IDs')
        require(c.get('returned_support') in ('verified', 'absent', 'unknown'), 'returned support required')
    require(j.get('version', {}).get('status') in ('exact', 'unsupported', 'missing', 'silent_substitution', 'drift', 'disputed'), 'version status required')
    require(nonempty(j['version'].get('rationale')), 'version rationale required')
    require(type(j['version'].get('compliant')) is bool, 'version compliance required')
    require(isinstance(j.get('extra_claims'), list), 'extra claims required')
    for c in j['extra_claims']:
        require(nonempty(c.get('quote')) and c['quote'] in packet['answer'], 'extra claim quote required')
        require(c.get('verdict') in ('correct', 'incorrect', 'unverifiable') and c.get('severity') in ('minor', 'major', 'critical'), 'extra claim classification required')
        require(nonempty(c.get('rationale')) and bool(c.get('evidence_refs')), 'extra claim verification required')
    citations = j.get('citations', {})
    require(type(citations.get('material_claims')) is int and citations['material_claims'] >= 0, 'material claim count required')
    require(type(citations.get('cited_claims')) is int and 0 <= citations['cited_claims'] <= citations['material_claims'], 'cited count invalid')
    require(isinstance(citations.get('links'), list), 'citation links required')
    for c in citations['links']:
        require(c.get('status') in ('supported', 'wrong', 'broken', 'inaccessible', 'version_mismatch', 'unknown'), 'citation status invalid')
        require(all(nonempty(c.get(k)) for k in ('claim', 'url', 'rationale', 'cache_ref')), 'citation cache verification required')
    return j


def verify_caches(judgment, packet, judging):
    def verify_ref(ref, expected_url=None):
        require(nonempty(ref), 'cache reference required')
        index = load(judging / 'citation-cache.json')
        require(ref in index, 'missing citation cache record')
        cache = index[ref]
        require(nonempty(cache.get('url')) and nonempty(cache.get('verified_at')), 'cache URL/timestamp missing')
        try:
            timestamp = datetime.fromisoformat(cache['verified_at'].replace('Z', '+00:00'))
            require(timestamp.tzinfo is not None, 'cache timestamp must include timezone')
        except (TypeError, ValueError) as exc:
            raise ValueError('invalid cache verification timestamp') from exc
        require(expected_url is None or cache['url'] == expected_url, 'cache URL mismatch')
        body = (judging / cache['path']).resolve()
        require(body.is_relative_to(judging.resolve()), 'cache path escapes judging directory')
        require(body.is_file() and hashlib.sha256(body.read_bytes()).hexdigest() == cache.get('sha256'), 'citation cache hash mismatch')
    for criterion in judgment['criteria']:
        if criterion['returned_support'] == 'verified':
            require(nonempty(criterion.get('verification_notes')), 'returned support verification notes required')
            quote = criterion.get('retained_quote')
            retained = packet['retained_evidence']
            retained = retained if isinstance(retained, str) else json.dumps(retained, ensure_ascii=False)
            require(nonempty(quote) and quote in retained, 'verified support must quote retained packet')
            require(isinstance(criterion.get('cache_refs'), list) and criterion['cache_refs'], 'returned support cache refs required')
            for ref in criterion['cache_refs']:
                verify_ref(ref)
    for claim in judgment['extra_claims']:
        require(isinstance(claim.get('cache_refs'), list) and claim['cache_refs'], 'extra claim independent cache refs required')
        for ref in claim['cache_refs']:
            verify_ref(ref)
    links = judgment['citations']['links']
    urls = {u.rstrip('.,;:') for u in re.findall(r'https?://[^\s<>\)\]\"\x27]+', packet['answer'])}
    require(urls <= {c['url'] for c in links}, 'omitted distinct answer citation URL')
    for link in links:
        require(nonempty(link.get('quote')) and link['quote'] in packet['answer'], 'citation answer quotation required')
        verify_ref(link['cache_ref'], link['url'])


def index_judgments(path, packets, judge):
    rows = lines(path)
    require(len(rows) == len(packets), 'missing/duplicate judgments')
    result = {}
    for j in rows:
        aid = j['anonymous_id']
        require(aid in packets and aid not in result, 'unknown/duplicate answer')
        result[aid] = validate(j, packets[aid], judge)
    return result


def percentile(values, p):
    if not values:
        return None
    values = sorted(values)
    position = (len(values) - 1) * p
    lo = math.floor(position)
    return values[lo] + (values[math.ceil(position)] - values[lo]) * (position - lo)


def analysis(records, seed=BOOTSTRAP_SEED, samples=BOOTSTRAP_SAMPLES):
    families = defaultdict(dict)
    for r in records:
        families[r['family']].setdefault(r['question_id'], {})[r['workflow']] = r['score']
    if not families:
        return None
    def macro(sample, workflow):
        return statistics.mean(statistics.mean(q[workflow] for q in qs) for qs in sample)
    sample = [list(qs.values()) for qs in families.values()]
    means = {w: macro(sample, w) for w in ('parallel', 'context7')}
    rng, boot = random.Random(seed), []
    for _ in range(samples):
        draw = [rng.choices(qs, k=len(qs)) for qs in sample]
        boot.append(macro(draw, 'parallel') - macro(draw, 'context7'))
    return {'scores': means, 'difference_parallel_minus_context7': means['parallel'] - means['context7'],
            'ci95': [percentile(boot, .025), percentile(boot, .975)],
            'families': {f: {w: statistics.mean(q[w] for q in qs.values()) for w in means} for f, qs in families.items()},
            'questions': sum(len(q) for q in families.values())}


def report(run, key_path, questions_path, judging, destination):
    manifest, key, public, schedule = campaign(run, key_path, questions_path)
    launch_path = run / 'launch.json'
    fixture = manifest['config'].get('fixture_mode') is True
    require(fixture or launch_path.is_file(), 'production report requires launch.json')
    launch = load(launch_path) if launch_path.is_file() else None
    if launch is not None:
        resolved = launch.get('resolved_config')
        require(isinstance(resolved, dict), 'launch resolved_config required')
        # Configuration uses JSON primitives and integer settings; preserve JS insertion order.
        encoded = json.dumps(resolved, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
        require(hashlib.sha256(encoded).hexdigest() == launch.get('execution_config_hash'), 'launch execution config hash mismatch')
        require(launch.get('manifest_sha256') == hashlib.sha256((run / 'manifest.json').read_bytes()).hexdigest(), 'launch manifest hash mismatch')
    sealed = load(judging / 'blind-map.json')
    require(sealed['manifest_hash'] == digest(manifest) and sealed['schedule_hash'] == digest(schedule)
            and sealed['key_hash'] == digest(key) and sealed['public_hash'] == digest(public), 'frozen input changed')
    require(sealed.get('view_hash') == (digest(load(run / 'view-provenance.json')) if (run / 'view-provenance.json').exists() else None), 'view provenance changed')
    packets = {p['anonymous_id']: p for p in load(judging / 'judge-1-packets.json')}
    require(sealed['packet_hash'] == digest(sorted(packets.values(), key=lambda p: p['anonymous_id'])), 'judge packet changed')
    second_packets = load(judging / 'judge-2-packets.json')
    require(sealed['packet_hash'] == digest(sorted(second_packets, key=lambda p: p['anonymous_id'])), 'judge-2 packet changed')
    settings = manifest['config']['judging']
    analyze = lambda rows: analysis(rows, settings['bootstrap_seed'], settings['bootstrap_samples'])
    j1 = index_judgments(judging / 'judge-1.jsonl', packets, 'judge-1')
    j2 = index_judgments(judging / 'judge-2.jsonl', packets, 'judge-2')
    require({j['reviewer'] for j in j1.values()}.isdisjoint({j['reviewer'] for j in j2.values()}), 'judges must be independent people')
    adjudications = lines(judging / 'adjudications.jsonl') if (judging / 'adjudications.jsonl').exists() else []
    adj = {}
    for a in adjudications:
        require(a['anonymous_id'] not in adj and a['anonymous_id'] in packets, 'duplicate/unknown adjudication')
        require(a.get('human') is True and nonempty(a.get('rationale')), 'human adjudication rationale required')
        adj[a['anonymous_id']] = a
    records, disagreements = [], []
    pending = []
    for m in sealed['rows']:
        aid = m['anonymous_id']
        a, b = j1[aid], j2[aid]
        verify_caches(a, packets[aid], judging)
        verify_caches(b, packets[aid], judging)
        sa, sb = [{c['id']: c['score'] for c in j['criteria']} for j in (a, b)]
        disagreements.extend(abs(sa[c] - sb[c]) for c in sa)
        # Ignore identity only; all diagnostic disputes also require human resolution.
        comparable = lambda j: {k: v for k, v in j.items() if k not in ('judge_id', 'reviewer', 'judge_type')}
        needs = comparable(a) != comparable(b) or any(c['severity'] in ('major', 'critical') for j in (a, b) for c in j['extra_claims']) or any(j['version']['status'] in ('disputed', 'drift') for j in (a, b))
        if needs and aid not in adj:
            pending.append(aid)
            continue
        chosen = validate(adj[aid]['judgment'], packets[aid], 'adjudicator') if aid in adj else a
        verify_caches(chosen, packets[aid], judging)
        directory = run / 'executions' / m['execution_id']
        outcome = load(directory / 'outcome.json')
        if not fixture or launch is not None:
            require(outcome.get('config_hash') == launch['execution_config_hash'], 'outcome execution config hash mismatch')
        answer = load(directory / 'answer.json') if (directory / 'answer.json').exists() else {}
        evidence = load(directory / 'evidence.json') if (directory / 'evidence.json').exists() else {}
        require(m['artifact_hash'] == digest([outcome, answer, evidence]), 'execution artifact changed')
        q = key[m['question_id']]
        scores = {c['id']: c['score'] for c in chosen['criteria']}
        weight = sum(c['weight'] for c in q['criteria'])
        completed = outcome['status'] == 'completed'
        score = sum(c['weight'] * scores[c['id']] for c in q['criteria']) / weight if completed else 0
        perfect = completed and all(v == 1 for v in scores.values())
        fully = perfect and chosen['version']['compliant'] and not any(c['verdict'] == 'incorrect' for c in chosen['extra_claims'])
        records.append({**m, 'family': q['project'], 'difficulty': q['difficulty'], 'category': q['category'],
                        'multi_source': len({e['path'] for e in q['evidence'] if 'path' in e}) > 1,
                        'false_premise': q['category'] == 'false-premise', 'score': score,
                        'completed': completed, 'partial_answer_diagnostic_only': not completed, 'rubric_perfect': perfect, 'fully_correct': fully,
                        'judgment': chosen, 'outcome': outcome, 'evidence_metrics': {k: evidence.get(k) for k in ('retained_tokens', 'retained_bytes', 'truncated')},
                        'returned_evidence_coverage': sum(c['weight'] for c in q['criteria'] if next(x for x in chosen['criteria'] if x['id'] == c['id'])['returned_support'] == 'verified') / weight})
    require(not pending, 'human adjudication required: ' + ', '.join(pending))
    summaries = {}
    for workflow in ('parallel', 'context7'):
        rs = [r for r in records if r['workflow'] == workflow]
        fully = sum(r['fully_correct'] for r in rs)
        metrics = {}
        for phase in ('total_ms', 'retrieval_ms', 'answer_ms'):
            for mode in ('all_terminal', 'successful'):
                vs = [r['outcome'][phase] for r in rs if isinstance(r['outcome'].get(phase), (int, float)) and (mode == 'all_terminal' or r['completed'])]
                metrics[f'{phase}_{mode}'] = {'n': len(vs), 'median': percentile(vs, .5), 'p95': percentile(vs, .95)}
        charges = [{'amount': r['outcome'].get('provider_charge'), 'currency': r['outcome'].get('currency')} for r in rs]
        known = [c for c in charges if isinstance(c, dict) and isinstance(c.get('amount'), (int, float)) and nonempty(c.get('currency'))]
        totals = defaultdict(float)
        for c in known:
            totals[c['currency']] += c['amount']
        token_values = [r['outcome'].get('model_usage') for r in rs]
        token_total = 0
        tokens_known = True
        for usage in token_values:
            if not isinstance(usage, list) or not usage:
                tokens_known = False
                continue
            for phase_usage in usage:
                u = phase_usage.get('usage', {})
                value = u.get('totalTokens')
                if value is None and all(isinstance(u.get(k), (int, float)) for k in ('input', 'output')):
                    value = u['input'] + u['output']
                if isinstance(value, (int, float)):
                    token_total += value
                else:
                    tokens_known = False
        claims = [c for r in rs for c in r['judgment']['extra_claims']]
        harmful = [r for r in rs if any(c['verdict'] == 'incorrect' and c['severity'] in ('major', 'critical') for c in r['judgment']['extra_claims'])]
        citation_rows = [r['judgment']['citations'] for r in rs]
        material = sum(c['material_claims'] for c in citation_rows)
        links = [link for c in citation_rows for link in c['links']]
        phases = defaultdict(list)
        for r in rs:
            for usage in r['outcome'].get('model_usage', []):
                phases[usage.get('phase', 'unknown')].append(usage.get('usage', {}))
        summaries[workflow] = {'n': len(rs),
            'usage_by_phase': {phase: {'observations': len(usages), 'input_observed': sum(u['input'] for u in usages if isinstance(u.get('input'), (int, float))), 'output_observed': sum(u['output'] for u in usages if isinstance(u.get('output'), (int, float))), 'missing_input': sum(not isinstance(u.get('input'), (int, float)) for u in usages), 'missing_output': sum(not isinstance(u.get('output'), (int, float)) for u in usages)} for phase, usages in phases.items()},
            'retries_observed': sum(r['outcome'].get('retries') or 0 for r in rs),
            'retries_unknown': sum(r['outcome'].get('retries') is None for r in rs),
            'api_attempts_observed': sum(r['outcome'].get('api_attempts') or 0 for r in rs),
            'api_attempts_unknown': sum(r['outcome'].get('api_attempts') is None for r in rs),
            'errors': dict(Counter(str(r['outcome'].get('error')) for r in rs if r['outcome'].get('error'))),
            'timeouts': sum('timeout' in str(r['outcome'].get('status', '')).lower() or 'timeout' in str(r['outcome'].get('error', '')).lower() for r in rs),
            'returned_support_statuses': dict(Counter(c['returned_support'] for r in rs for c in r['judgment']['criteria'])),
            'model_tokens_observed': token_total if any(isinstance(u, list) and u for u in token_values) else None, 'model_tokens_total': token_total if tokens_known else None,
            'tokens_per_fully_correct': token_total / fully if fully and tokens_known else None,
            'extra_claim_verdicts': dict(Counter(c['verdict'] for c in claims)),
            'major_critical_affected_rate_all': len(harmful) / len(rs),
            'major_critical_affected_rate_completed': sum(r['completed'] for r in harmful) / sum(r['completed'] for r in rs) if any(r['completed'] for r in rs) else None,
            'returned_evidence_coverage': statistics.mean(r['returned_evidence_coverage'] for r in rs),
            'citation_coverage': sum(c['cited_claims'] for c in citation_rows) / material if material else None,
            'citation_support_precision': sum(c['status'] == 'supported' for c in links) / len(links) if links else None,
            'citation_statuses': dict(Counter(c['status'] for c in links)),
            'versions': dict(Counter(r['judgment']['version']['status'] for r in rs)), 'completion_rate': sum(r['completed'] for r in rs) / len(rs),
            'rubric_perfect_rate': sum(r['rubric_perfect'] for r in rs) / len(rs), 'fully_correct_rate': fully / len(rs),
            'completed_only_score': statistics.mean([r['score'] for r in rs if r['completed']]) if any(r['completed'] for r in rs) else None,
            'terminal_statuses': dict(Counter(r['status'] for r in rs)), 'latency': metrics,
            'observed_charges_by_currency': dict(totals), 'unknown_charge_executions': len(rs) - len(known),
            'total_actual_cost': dict(totals) if len(known) == len(rs) else None,
            'cost_per_fully_correct': {c: v / fully for c, v in totals.items()} if fully and len(known) == len(rs) else None}
    campaign_complete = all(r['status'] != 'not_run' for r in records)
    controller_metadata = validate_report_view(run) if (run / 'view-provenance.json').exists() else None
    sensitivity_plan = controller_metadata.get('operational_incident', {}).get('sensitivity_plan') if controller_metadata else None
    result = {'campaign_complete': campaign_complete, 'report_status': 'complete' if campaign_complete else 'incomplete interim: not_run rows are scheduled zeros, not executions',
        'scheduled_executions': len(records), 'executions_started': sum(r['status'] != 'not_run' for r in records),
        'infrastructure_excluded_sensitivity': infrastructure_sensitivity(records, sensitivity_plan, settings['bootstrap_seed'], settings['bootstrap_samples']),
        'primary': analyze(records), 'nonpilot_sensitivity': analyze([r for r in records if r['question_id'] not in set(manifest['config'].get('pilot_question_ids', PILOT))]),
        'paired_question_differences': {q: next(r['score'] for r in records if r['question_id'] == q and r['workflow'] == 'parallel') - next(r['score'] for r in records if r['question_id'] == q and r['workflow'] == 'context7') for q in sorted({r['question_id'] for r in records})},
        'unavailable_breakdown_metadata': ['code', 'version'],
        'breakdown_definitions': {'multi_source': 'More than one distinct frozen reference evidence file path; not provider-returned source count.', 'false_premise': 'Frozen key category equals false-premise.'},
        'workflows': summaries, 'agreement': {'criteria': len(disagreements), 'exact': sum(d == 0 for d in disagreements) / len(disagreements), 'mean_absolute_difference': statistics.mean(disagreements)},
        'bootstrap': {'seed': settings['bootstrap_seed'], 'samples': settings['bootstrap_samples'], 'unit': 'paired question, stratified by family', 'percentile': 'linear interpolation (n-1)*p'},
        'breakdowns': {field: {value: {'n': sum(r[field] == value for r in records), 'tiny_subgroup': sum(r[field] == value for r in records) < 10,
            'analysis': analyze([r for r in records if r[field] == value])} for value in sorted({r[field] for r in records})} for field in ('difficulty', 'category', 'multi_source', 'false_premise')}, 
        'records': records, 'adjudications': adjudications, 'config': manifest['config'],
        # Controller-only report metadata; never included in blinded packets.
        'view_provenance': controller_metadata,
        'launch_metadata': launch, 'resolved_config': launch['resolved_config'] if launch else None,
        'limitations': ['Provider-label blinding only; URLs and wording can reveal provenance.', 'Selected-item variability only; single attempt does not measure run-to-run variation.', 'Native synthesis versus snippets is asymmetric; unobserved internal retrieval is not measured.', 'Unknown/subscription costs are not zero. Raw phase usage remains in records; estimates are not bills.', 'Timeout latency is time-to-terminal, not true completion time. Tiny subgroups and p95 are descriptive.', 'Honest canary/index provenance disclosure is not itself an incorrect claim; requested-scope correctness is separate.', 'Reference amendments must be symmetric and separately documented; frozen primary is never silently replaced.']}
    destination.mkdir(mode=0o700)
    save(destination / 'results.json', result)
    with (destination / 'report.md').open('x') as stream:
        stream.write(f"# Offline blinded evaluation\n\nStatus: **{result['report_status']}**. Scheduled: {len(records)}; started: {result['executions_started']}.\n\n")
        stream.write('| Workflow | Family macro | Completion | Fully correct | Actual total cost |\n|---|---:|---:|---:|---|\n')
        for w, summary in summaries.items():
            stream.write(f"| {w} | {result['primary']['scores'][w]:.3f} | {summary['completion_rate']:.1%} | {summary['fully_correct_rate']:.1%} | {summary['total_actual_cost'] if summary['total_actual_cost'] is not None else 'Unknown'} |\n")
        stream.write(f"\nPaired Parallel − Context7: {result['primary']['difference_parallel_minus_context7']:.3f}; 95% interval {result['primary']['ci95']}.\n\n")
        stream.write('## Detailed summaries\n\n```json\n' + json.dumps({k: v for k, v in result.items() if k not in ('records', 'config', 'adjudications')}, indent=2) + '\n```\n\nFull diagnostics, usage, evidence sizes, and adjudications: `results.json`. No composite winner score.\n')
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=('prepare', 'report'))
    p.add_argument('run', type=Path)
    p.add_argument('--key', type=Path, default=Path('evaluation/answer-key.json'))
    p.add_argument('--questions', type=Path, default=Path('evaluation/questions.jsonl'))
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--judging', type=Path)
    args = p.parse_args()
    if args.command == 'prepare':
        prepare(args.run, args.key, args.questions, args.out)
    else:
        report(args.run, args.key, args.questions, args.judging or args.run / 'judging', args.out)


if __name__ == '__main__':
    main()
