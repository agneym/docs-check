#!/usr/bin/env python3
"""Separate automated-review report; never bypasses the original human scorer."""
import argparse
import hashlib
import json
import subprocess
import statistics
from collections import Counter
from pathlib import Path
import scoring as s

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verify_source(run, key_path=None, questions_path=None):
    key_path = key_path or ROOT / 'evaluation/answer-key.json'
    questions_path = questions_path or ROOT / 'evaluation/questions.jsonl'
    manifest, key, public, schedule = s.campaign(run, key_path, questions_path)
    judging = run / 'judging'
    sealed = s.load(judging / 'blind-map.json')
    s.require(sealed['manifest_hash'] == s.digest(manifest) and sealed['schedule_hash'] == s.digest(schedule)
              and sealed['key_hash'] == s.digest(key) and sealed['public_hash'] == s.digest(public), 'frozen input changed')
    view = s.load(run / 'view-provenance.json') if (run / 'view-provenance.json').exists() else None
    s.require(sealed.get('view_hash') == (s.digest(view) if view else None), 'view provenance changed')
    files = {str(p.resolve()): sha(p) for p in (run / 'manifest.json', run / 'schedule.jsonl', key_path, questions_path,
             judging / 'blind-map.json', judging / 'judge-1-packets.json', judging / 'judge-2-packets.json')}
    if view:
        files[str((run / 'view-provenance.json').resolve())] = sha(run / 'view-provenance.json')
    launch = s.load(run / 'launch.json') if (run / 'launch.json').exists() else None
    s.require(manifest['config'].get('fixture_mode') is True or launch is not None, 'production launch missing')
    if launch:
        files[str((run / 'launch.json').resolve())] = sha(run / 'launch.json')
        s.require(launch['manifest_sha256'] == sha(run / 'manifest.json'), 'launch manifest changed')
        encoded = json.dumps(launch['resolved_config'], ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
        s.require(hashlib.sha256(encoded).hexdigest() == launch['execution_config_hash'], 'launch config changed')
    packets = {}
    for judge in ('judge-1', 'judge-2'):
        ps = s.load(judging / f'{judge}-packets.json')
        s.require(len(ps) == len(schedule) and len({p['anonymous_id'] for p in ps}) == len(ps), 'duplicate/missing packet')
        s.require(sealed['packet_hash'] == s.digest(sorted(ps, key=lambda p: p['anonymous_id'])), 'judge packet changed')
        packets.update({p['anonymous_id']: p for p in ps})
    s.require(len(sealed['rows']) == len(schedule) and len({r['anonymous_id'] for r in sealed['rows']}) == len(schedule), 'sealed map mismatch')
    scheduled = {r['execution_id']: r for r in schedule}
    s.require({r['execution_id'] for r in sealed['rows']} == set(scheduled), 'sealed execution set mismatch')
    for row in sealed['rows']:
        s.require(all(row[k] == v for k, v in scheduled[row['execution_id']].items()), 'sealed mapping changed')
        directory = run / 'executions' / row['execution_id']
        artifacts = []
        for name in ('outcome.json', 'answer.json', 'evidence.json'):
            path = directory / name
            if path.exists():
                files[str(path.resolve())] = sha(path)
                artifacts.append(s.load(path))
            else:
                artifacts.append({})
        outcome, answer, evidence = artifacts
        s.require(outcome.get('status') == row['status'] and s.digest(artifacts) == row['artifact_hash'], 'execution artifact changed')
        if launch:
            s.require(outcome.get('config_hash') == launch['execution_config_hash'], 'outcome config changed')
        packet = packets[row['anonymous_id']]
        q = key[row['question_id']]
        s.require(packet['reference'] == q and packet['answer'] == answer.get('text', '')
                  and packet['retained_evidence'] == evidence.get('packet', evidence.get('text', ''))
                  and packet['request'] == {k: public[row['question_id']][k] for k in ('product', 'version_context', 'question')}, 'packet/source mismatch')
        for e in q['evidence']:
            if 'path' not in e:
                continue
            path = ROOT / e['path']
            s.require(path.resolve().is_relative_to((ROOT / 'sources').resolve()), 'unsafe evidence source')
            file_hash = sha(path)
            s.require(file_hash == e['file_sha256'], 'reference source changed')
            source_lines = path.read_text().splitlines(keepends=True)
            s.require(1 <= e['start_line'] <= e['end_line'] <= len(source_lines), 'invalid reference range')
            excerpt = ''.join(source_lines[e['start_line'] - 1:e['end_line']])
            s.require(e['quote'] and e['quote'] in excerpt, 'reference excerpt changed')
            files[str(path.resolve())] = file_hash
    controller = s.validate_report_view(run) if view else None
    return {'hashes': files, 'fingerprint': s.digest(files), 'executions': len(schedule),
            'judging': manifest['config']['judging'], 'pilot_question_ids': manifest['config'].get('pilot_question_ids', sorted(s.PILOT)),
            'sensitivity_plan': controller.get('operational_incident', {}).get('sensitivity_plan') if controller else None}


def make_results(snapshot, sealed, packets, audit):
    records, differences, missing_pairs = [], [], []
    for row in sealed['rows']:
        aid = row['anonymous_id']
        q, j = packets[aid]['reference'], audit['chosen'][aid]
        scores = {c['id']: c['score'] for c in j['criteria']}
        completed = row['status'] == 'completed'
        score = sum(c['weight'] * scores[c['id']] for c in q['criteria']) / sum(c['weight'] for c in q['criteria']) if completed else 0
        a, b = audit['initial'][aid]
        if a is not None and b is not None:
            ca, cb = ({c['id']: c['score'] for c in x['criteria']} for x in (a, b))
            differences.extend(abs(ca[c] - cb[c]) for c in ca)
        else:
            missing_pairs.append(aid)
        perfect = completed and all(v == 1 for v in scores.values())
        records.append({**row, 'family': q['project'], 'difficulty': q['difficulty'], 'category': q['category'],
                        'multi_source': len({e.get('path') for e in q['evidence']}) > 1,
                        'false_premise': q['category'] == 'false-premise', 'completed': completed, 'score': score,
                        'rubric_perfect': perfect, 'fully_correct_llm_estimate': perfect and j['version']['compliant'] and not any(c['verdict'] == 'incorrect' for c in j['extra_claims']),
                        'adjudicated': aid in audit['adjudicated_ids'], 'judgment': j})
    settings = snapshot['judging']
    analyze = lambda rs: s.analysis(rs, settings['bootstrap_seed'], settings['bootstrap_samples'])
    workflows = {}
    for w in ('parallel', 'context7'):
        rows = [r for r in records if r['workflow'] == w]
        successful = [r for r in rows if r['completed']]
        workflows[w] = {'n': len(rows), 'completed': len(successful), 'failed_zeros': sum(not r['completed'] for r in rows),
                        'completed_only_score': statistics.mean(r['score'] for r in successful) if successful else None,
                        'rubric_perfect_rate': sum(r['rubric_perfect'] for r in rows) / len(rows),
                        'fully_correct_llm_estimate_rate': sum(r['fully_correct_llm_estimate'] for r in rows) / len(rows),
                        'extra_claims': dict(Counter(c['verdict'] for r in rows for c in r['judgment']['extra_claims'])),
                        'major_critical_llm_flagged_answers': sum(any(c['severity'] in ('major', 'critical') for c in r['judgment']['extra_claims']) for r in rows),
                        'versions': dict(Counter(r['judgment']['version']['status'] for r in rows)),
                        'retained_support_llm_consistency_only': dict(Counter(c['retained_support'] for r in rows for c in r['judgment']['criteria'])),
                        'citation_support_precision': None, 'independently_verified_evidence_coverage': None}
    limits = ['Automated LLM judging and LLM adjudication; no independent human validation. This is an amended analysis, not completion of the frozen human-review protocol.',
              'Both passes and adjudicator use the same model family as the answerer. Separate tool-free contexts do not provide independent model errors; shared and self-preference biases remain.',
              'Reference excerpts only, not runtime tests or independently fetched live citations. Retained support measures model-assessed consistency, not verified retrieval quality. Citation precision and verified support remain unavailable.',
              'Extra-claim verdicts are limited to supplied reference evidence; unverifiable is not incorrect. Fully-correct rates are LLM estimates, not an exhaustive factual audit.',
              'Blinding hides provider labels and operations, but URLs/wording can reveal provenance.',
              'Six controller/infrastructure failures remain primary zeros, not provider-quality failures. The predeclared paired exclusion is diagnostic only.',
              'Bootstrap measures selected-question uncertainty, not judge-model uncertainty, repeated-run variation or universal coding performance.',
              'Judging charges are unavailable, not zero; model catalog cost estimates are not actual spend. Judging usage is separate from benchmark workflow usage.',
              'Frozen key and original outcomes are unchanged. Reference concerns are disclosed, not silently repaired.']
    return {'review_type': 'llm-only', 'human_validated': False,
            'campaign_complete': all(r['status'] != 'not_run' for r in records),
            'primary': analyze(records), 'nonpilot_sensitivity': analyze([r for r in records if r['question_id'] not in snapshot['pilot_question_ids']]),
            'infrastructure_excluded_sensitivity': s.infrastructure_sensitivity(records, snapshot['sensitivity_plan'], settings['bootstrap_seed'], settings['bootstrap_samples']),
            'workflows': workflows, 'agreement': {'criteria': len(differences), 'exact': sum(d == 0 for d in differences) / len(differences) if differences else None, 'mean_absolute_difference': statistics.mean(differences) if differences else None,
                'valid_initial_pairs': len(records) - len(missing_pairs), 'missing_initial_pairs': len(missing_pairs), 'missing_anonymous_ids': missing_pairs,
                'denominator': 'Available valid initial judgment pairs only; failed/missing judgments are not invented or scored as zero.'},
            'paired_question_differences': {q: next(r['score'] for r in records if r['question_id'] == q and r['workflow'] == 'parallel') - next(r['score'] for r in records if r['question_id'] == q and r['workflow'] == 'context7') for q in sorted({r['question_id'] for r in records})},
            'breakdowns': {field: {str(value): analyze([r for r in records if r[field] == value]) for value in sorted({r[field] for r in records})} for field in ('family', 'difficulty', 'category', 'multi_source', 'false_premise')},
            'judging': audit['metadata'], 'adjudications': len(audit['adjudicated_ids']), 'bootstrap': settings,
            'reference_concerns': [{'anonymous_id': aid, 'concerns': j['reference_concerns']} for aid, j in audit['chosen'].items() if j['reference_concerns']],
            'records': records, 'limitations': limits}


def report(work, destination):
    manifest = s.load(work / 'manifest.json')
    snapshot = verify_source(Path(manifest['source_run']))
    s.require(snapshot == s.load(work / 'source-snapshot.json'), 'frozen source snapshot changed')
    audit_script = 'llm-continuation.mjs' if manifest['phase'] == 'full-first-pass-llm-judging-continuation-v1' else 'llm-judge.mjs'
    audit_proc = subprocess.run(['node', str(ROOT / 'scripts/full' / audit_script), '--audit', str(work)], check=True, capture_output=True, text=True)
    audit = json.loads(audit_proc.stdout)
    sealed = s.load(work / 'controller/blind-map.json')
    packets = {p['anonymous_id']: p for p in s.load(work / 'judge-1-packets.json')}
    result = make_results(snapshot, sealed, packets, audit)
    result['source_fingerprint'] = snapshot['fingerprint']
    result['judge_manifest_sha256'] = sha(work / 'manifest.json')
    if audit_script == 'llm-continuation.mjs':
        result['limitations'].append('Incident-approved append-only continuation preserves 37 original attempts, retries only the two originally failed initial calls once, and adds only previously unattempted slots. New invalid initial judgments route to the one authorized adjudication; initial agreement excludes missing valid pairs. Short-literal-quote guidance was appended without changing the reference, rubric or model. All failed judging attempts and their usage remain disclosed, never added as contestant correctness zeros.')
    destination.mkdir(mode=0o700)
    s.save(destination / 'results.json', result, private=True)
    primary = result['primary']
    agreement = result['agreement']
    agreement_text = f"{agreement['exact']:.2%}" if agreement['exact'] is not None else 'unavailable'
    difference_text = f"{agreement['mean_absolute_difference']:.4f}" if agreement['mean_absolute_difference'] is not None else 'unavailable'
    lines = ['# LLM-judged evaluation — not human-validated', '',
             'Protocol amendment: two blinded LLM passes and LLM adjudication replace the planned human reviews for this automated analysis only. Original artifacts remain intact.', '',
             '| Workflow | Family-macro correctness | Rubric-perfect | Completed |', '|---|---:|---:|---:|']
    for w, m in result['workflows'].items():
        lines.append(f"| {w} | {primary['scores'][w]:.2%} | {m['rubric_perfect_rate']:.2%} | {m['completed']}/{m['n']} |")
    lines += ['', f"Paired Parallel − Context7: **{primary['difference_parallel_minus_context7']:+.2%}**; 95% question-bootstrap interval **[{primary['ci95'][0]:+.2%}, {primary['ci95'][1]:+.2%}]**.",
              f"Initial criterion agreement: {agreement_text}; mean absolute difference {difference_text}. LLM-adjudicated answers: {result['adjudications']}.",
              f"Valid initial pairs: {result['agreement']['valid_initial_pairs']}; missing/invalid initial pairs: {result['agreement']['missing_initial_pairs']} (excluded from agreement, never treated as contestant zeros).", '',
              'Citation support and independently verified evidence coverage remain **unavailable**, not zero/perfect. See the unchanged operational report for workflow timing, incidents and accounting.', '',
              '## Sensitivities']
    for title, analysis in [('Nonpilot (46 paired questions)', result['nonpilot_sensitivity']), ('Infrastructure-excluded diagnostic (44 paired questions)', (result['infrastructure_excluded_sensitivity'] or {}).get('analysis'))]:
        if analysis:
            lines.append(f"- {title}: Parallel {analysis['scores']['parallel']:.2%}; Context7 {analysis['scores']['context7']:.2%}; difference {analysis['difference_parallel_minus_context7']:+.2%}; 95% interval [{analysis['ci95'][0]:+.2%}, {analysis['ci95'][1]:+.2%}].")
    lines += ['', '## Limitations', *['- ' + x for x in result['limitations']], '', 'Full per-answer judgments, family/difficulty/category breakdowns, reference concerns, usage and accounting: `results.json`. No composite winner score.', '']
    (destination / 'report.md').write_text('\n'.join(lines))
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=('verify-source', 'report'))
    p.add_argument('path', type=Path)
    p.add_argument('--out', type=Path)
    args = p.parse_args()
    if args.command == 'verify-source':
        print(json.dumps(verify_source(args.path)))
    else:
        s.require(args.out is not None, '--out required')
        result = report(args.path, args.out)
        print(json.dumps({'primary': result['primary'], 'adjudications': result['adjudications']}))


if __name__ == '__main__':
    main()
