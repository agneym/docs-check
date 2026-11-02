#!/usr/bin/env python3
"""Offline post-hoc duplicate-normalized report, alongside strict unresolved bounds."""
import argparse
import copy
import json
import os
import subprocess
from pathlib import Path
import llm_report as llm
import scoring as s

ROOT = Path(__file__).resolve().parents[2]


def report(work, destination):
    manifest = s.load(work / 'manifest.json')
    snapshot = llm.verify_source(Path(manifest['source_run']))
    s.require(snapshot == s.load(work / 'source-snapshot.json'), 'source snapshot changed')
    p = subprocess.run(['node', str(ROOT / 'scripts/full/llm-offline-finalize.mjs'), str(work)], capture_output=True, text=True, check=True)
    audit = json.loads(p.stdout)
    packets = {p['anonymous_id']: p for p in s.load(work / 'judge-1-packets.json')}
    sealed = s.load(work / 'controller/blind-map.json')
    result = llm.make_results(snapshot, sealed, packets, audit)
    result['review_type'] = 'llm-only; explicit post-hoc exact-duplicate normalization'
    result['strict_review_complete'] = False
    result['duplicate_normalized_review_complete'] = True
    result['source_fingerprint'] = snapshot['fingerprint']
    result['judge_manifest_sha256'] = llm.sha(work / 'manifest.json')
    unresolved = set(audit['strict_unresolved_anonymous_ids'])
    seed, samples = snapshot['judging']['bootstrap_seed'], snapshot['judging']['bootstrap_samples']
    extremes = {}
    for value in (0, 1):
        rows = copy.deepcopy(result['records'])
        for row in rows:
            if row['anonymous_id'] in unresolved:
                row['score'] = value if row['completed'] else 0
        extremes[str(value)] = s.analysis(rows, seed, samples)
    result['strict_unresolved_score_extremes'] = {'anonymous_ids': sorted(unresolved), 'meaning': 'Strict review remains unresolved. Set each unresolved final answer score to 0 or 1, retaining every other selected score and original failed zero. These are endpoint bounds, not imputed judgments.', 'endpoints': extremes}
    result['normalizations'] = audit['normalizations']
    result['limitations'] += [
        'The strict continuation remains paused: the last adjudicator returned a deeply identical duplicate criterion object. The frozen strict schema rejected it. No extra model call or retry was made.',
        'This report is a separately labeled, post-hoc offline validation exception, not completion of the strict frozen protocol. The only normalization removes deeply identical repeated criterion objects; no score, quote, evidence reference, rationale, version or extra claim is changed. The rule is applied symmetrically to all final adjudications. Conflicting duplicates, unknown criteria and other defects remain invalid. Original failed records and raw outputs remain byte-identical.',
        'Two specifically approved initial retries were performed. Five other initial opinions remain invalid; initial agreement uses only 91 available valid pairs. Their answers were independently adjudicated, not assigned contestant zeros. All eight failed judging call records remain in accounting, including the one accepted only under exact-duplicate normalization.',
        'The post-hoc normalization exception was made by the controller after observing a structural validation failure, not represented as a predeclared or explicitly user-approved grading rule. Strict unresolved-score bounds are reported alongside the normalized analysis so the exception cannot hide uncertainty.',
        'Continuation prompt guidance favored short literal quotes; the substantive rubric, model, scope and benchmark outcomes were unchanged. All original and continuation calls are counted; no unapproved paid call was made.'
    ]
    # Keep original frozen configuration distinct from the actual automated judge identity.
    result['frozen_original_judging_config'] = result.pop('bootstrap')
    result['bootstrap'] = {'seed': seed, 'samples': samples, 'unit': 'paired question, stratified by family', 'percentile': 'linear interpolation (n-1)p'}
    result['unresolved_pair_exclusion_diagnostic'] = s.analysis([r for r in result['records'] if r['question_id'] not in {r['question_id'] for r in result['records'] if r['anonymous_id'] in unresolved}], seed, samples)
    destination.mkdir(mode=0o700)
    s.save(destination / 'results.json', result, private=True)
    s.save(destination / 'validation-audit.json', audit, private=True)
    files = ['scripts/full/llm-offline-finalize.mjs', 'scripts/full/llm-finalize-report.py', 'scripts/full/llm-offline-finalize.test.mjs', 'scripts/full/LLM-OFFLINE-NORMALIZATION.md']
    s.save(destination / 'offline-amendment.json', {'phase': 'posthoc-exact-duplicate-validation-only', 'explicit_user_approval_of_normalization': False, 'no_provider_calls': True, 'source_judge_manifest_sha256': llm.sha(work / 'manifest.json'), 'implementation': {name: llm.sha(ROOT / name) for name in files}, 'results_sha256': llm.sha(destination / 'results.json'), 'audit_sha256': llm.sha(destination / 'validation-audit.json')}, private=True)
    primary = result['primary']
    lines = ['# LLM-judged results — post-hoc exact-duplicate normalization', '',
             '**Not human-validated. Strict frozen review remains incomplete for one answer.** This separate offline report removes one deeply identical duplicate criterion object from the final adjudicator output. No score, quote or other content changed; no extra paid call occurred. All failed records remain preserved.', '',
             '| Workflow | Family-macro correctness | Rubric-perfect | Completed benchmark answers |', '|---|---:|---:|---:|']
    for w, m in result['workflows'].items():
        lines.append(f"| {w} | {primary['scores'][w]:.2%} | {m['rubric_perfect_rate']:.2%} | {m['completed']}/{m['n']} |")
    lines += ['', f"Normalized paired Parallel − Context7: **{primary['difference_parallel_minus_context7']:+.2%}**; 95% question-bootstrap interval **[{primary['ci95'][0]:+.2%}, {primary['ci95'][1]:+.2%}]**.", '',
              '## Strict unresolved-score endpoints', '', 'These do not treat the invalid judgment as correct or as a contestant failure:']
    for v, a in extremes.items():
        lines.append(f"- Unresolved answer score {v}: Parallel {a['scores']['parallel']:.2%}, Context7 {a['scores']['context7']:.2%}; difference {a['difference_parallel_minus_context7']:+.2%}; 95% interval [{a['ci95'][0]:+.2%}, {a['ci95'][1]:+.2%}].")
    lines += ['', '## Sensitivities']
    for title, a in [('Nonpilot, 46 pairs', result['nonpilot_sensitivity']), ('Predeclared infrastructure-excluded diagnostic, 44 pairs', (result['infrastructure_excluded_sensitivity'] or {}).get('analysis')), ('Post-hoc unresolved-question-pair exclusion, 47 pairs', result['unresolved_pair_exclusion_diagnostic'])]:
        if a:
            lines.append(f"- {title}: Parallel {a['scores']['parallel']:.2%}, Context7 {a['scores']['context7']:.2%}; difference {a['difference_parallel_minus_context7']:+.2%}; 95% interval [{a['ci95'][0]:+.2%}, {a['ci95'][1]:+.2%}].")
    lines += ['', '## Review coverage and accounting',
              f"- 192 initial slots / 194 initial call attempts (exactly two approved retries), {len(audit['adjudicated_ids'])} adjudications; {audit['metadata']['calls']} total calls, no other retries or benchmark reruns.",
              f"- {result['agreement']['valid_initial_pairs']} valid initial pairs; {result['agreement']['missing_initial_pairs']} missing valid pairs. Available-pair criterion agreement {result['agreement']['exact']:.2%}; mean absolute difference {result['agreement']['mean_absolute_difference']:.4f}.",
              f"- {audit['metadata']['failed_calls_preserved']} preserved failed call records, including one accepted only by the explicit duplicate-normalization exception.",
              f"- Observed model tokens: {audit['metadata']['usage']['totalTokens']:,}; catalog estimate ${audit['metadata']['usage']['catalog_estimate_usd']:.6f}, **not actual spend**. Actual charges unavailable; usage unavailable for {audit['metadata']['usage']['provider_usage_unavailable_calls']} interrupted call.",
              '- Citation support precision and independently verified evidence coverage remain unavailable, not zero/perfect.', '', '## Limitations', *['- '+x for x in result['limitations']], '',
              'Full judgments, unchanged raw/normalized criterion objects, family breakdowns, score endpoints, hashes and provenance: `results.json`, `validation-audit.json`, `offline-amendment.json`.', '']
    with (destination / 'report.md').open('x') as f:
        os.chmod(destination / 'report.md', 0o600)
        f.write('\n'.join(lines))
    return result


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('work', type=Path)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    r = report(args.work, args.out)
    print(json.dumps({'primary': r['primary'], 'strict_score_endpoints': r['strict_unresolved_score_extremes'], 'agreement': r['agreement'], 'adjudications': r['adjudications'], 'judging': r['judging']}))
