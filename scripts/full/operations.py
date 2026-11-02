#!/usr/bin/env python3
"""Offline controller-only operational report, independent of human grading."""
import argparse
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit

from assemble import load, require, safe, sha, validate_view


def numeric(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def percentile(values, p):
    values = sorted(values)
    if not values:
        return None
    position = (len(values) - 1) * p
    lo, hi = math.floor(position), math.ceil(position)
    return values[lo] + (values[hi] - values[lo]) * (position - lo)


def distribution(values):
    values = [v for v in values if numeric(v)]
    return {'n': len(values), 'median': percentile(values, .5), 'p95': percentile(values, .95)}


def failure_class(outcome):
    if outcome.get('status') in ('completed', 'not_run'):
        return None
    if outcome.get('phase') == 'setup':
        return 'controller_setup_nonprovider'
    value = outcome.get('classification') or outcome.get('error_classification')
    return value if isinstance(value, str) else 'unknown_failure'


def event_counts(events):
    counts = Counter({k: 0 for k in ('retrieval_request_attempts', 'retrieval_retries', 'task_create_attempts', 'task_get_attempts', 'task_status_poll_attempts', 'task_result_get_attempts', 'context7_request_attempts', 'task_created_events', 'task_status_events', 'model_retries', 'model_http_response_events')})
    for event in events:
        kind = event.get('event')
        if kind == 'api_request':
            counts['retrieval_request_attempts'] += 1
            counts['retrieval_retries'] += int(numeric(event.get('attempt')) and event['attempt'] > 0)
            url = urlsplit(event.get('url', ''))
            if url.hostname == 'api.parallel.ai':
                if event.get('method') == 'POST' and url.path.rstrip('/') == '/v1/tasks/runs':
                    counts['task_create_attempts'] += 1
                if event.get('method', 'GET') == 'GET':
                    counts['task_get_attempts'] += 1
                    counts['task_result_get_attempts' if url.path.endswith('/result') else 'task_status_poll_attempts'] += 1
            elif url.hostname and 'context7' in url.hostname:
                counts['context7_request_attempts'] += 1
        elif kind == 'task_created':
            counts['task_created_events'] += 1
        elif kind == 'task_status':
            counts['task_status_events'] += 1
        elif kind == 'model_retry':
            counts['model_retries'] += 1
        elif kind == 'model_http_response':
            counts['model_http_response_events'] += 1
    return dict(counts)


def summarize(records):
    """Pure aggregation of sanitized controller observations; never score answers."""
    result = {}
    for workflow in sorted({r['workflow'] for r in records}):
        rs = [r for r in records if r['workflow'] == workflow]
        statuses = Counter(r['outcome']['status'] for r in rs)
        counters = Counter()
        for r in rs:
            counters.update(r.get('event_counts', {}))
        usage = defaultdict(list)
        unknown_usage = 0
        for r in rs:
            entries = r['outcome'].get('model_usage')
            if not isinstance(entries, list) or not entries:
                unknown_usage += 1
                continue
            for entry in entries:
                usage[entry.get('phase', 'unknown')].append(entry.get('usage') or {})
        phase_usage = {}
        for phase, entries in usage.items():
            fields = {}
            for field in ('input', 'output', 'totalTokens', 'cacheRead', 'cacheWrite'):
                vs = [u[field] for u in entries if numeric(u.get(field))]
                fields[field] = {'observed': sum(vs) if vs else None, 'known_observations': len(vs), 'unknown_observations': len(entries) - len(vs)}
            phase_usage[phase] = {'observations': len(entries), 'tokens': fields,
                                  'catalog_estimate_costs': [u['cost'] for u in entries if isinstance(u.get('cost'), dict)],
                                  'cost_note': 'Catalog estimates only, not actual bills or subscription charges.'}
        charges = defaultdict(float)
        known_charges = 0
        for r in rs:
            o = r['outcome']
            if numeric(o.get('provider_charge')) and isinstance(o.get('currency'), str) and o['currency'].strip():
                charges[o['currency']] += o['provider_charge']
                known_charges += 1
        failure_counts = Counter(filter(None, (failure_class(r['outcome']) for r in rs)))
        result[workflow] = {'scheduled': len(rs), 'local_attempts': sum(r['outcome']['status'] != 'not_run' for r in rs),
            'terminal_statuses': dict(statuses), 'failures_by_class': dict(failure_counts),
            'timeouts': sum(r['outcome'].get('classification') == 'deadline' or r['outcome'].get('status') == 'timeout' or any(t in str(r['outcome'].get('error', '')).lower() for t in ('timeout', 'deadline')) for r in rs),
            'event_counts_observed': dict(counters), 'missing_event_logs': sum(not r.get('events_available', False) for r in rs),
            'model_attempts_observed': sum(r['outcome']['model_attempts'] for r in rs if numeric(r['outcome'].get('model_attempts'))),
            'model_attempts_unknown': sum(not numeric(r['outcome'].get('model_attempts')) for r in rs),
            'latency_ms': {phase: {mode: distribution([r['outcome'].get(phase) for r in rs if r['outcome']['status'] != 'not_run' and (mode == 'all_terminal' or r['outcome']['status'] == 'completed')]) for mode in ('all_terminal', 'completed_only')} for phase in ('setup_ms', 'total_ms', 'host_wall_ms', 'retrieval_ms', 'answer_ms')},
            'model_usage_by_phase': phase_usage, 'executions_missing_usage': unknown_usage,
            'evidence_sizes': {field: distribution([r.get('evidence', {}).get(field) for r in rs]) for field in ('native_evidence_bytes', 'native_evidence_proxy_tokens', 'original_bytes', 'original_tokens', 'retained_bytes', 'retained_tokens')},
            'evidence_truncated': sum(r.get('evidence', {}).get('truncated') is True for r in rs),
            'evidence_truncation_unknown': sum(type(r.get('evidence', {}).get('truncated')) is not bool for r in rs),
            'actual_charges_observed_by_currency': dict(charges), 'actual_charges_unknown': len(rs) - known_charges,
            'actual_total_cost': dict(charges) if known_charges == len(rs) else None}
    return result


def report(view, destination):
    require(not destination.exists(), 'destination already exists')
    metadata = validate_view(view)
    schedule = [json.loads(x) for x in (view / 'schedule.jsonl').read_text().splitlines() if x.strip()]
    references, records, vm_ids = {}, [], []

    def read_record(root, relative, jsonl=False):
        path = safe(root, relative)
        if not path.exists():
            return None
        before = sha(path)
        value = [json.loads(x) for x in path.read_text().splitlines() if x.strip()] if jsonl else load(path)
        require(before == sha(path), 'operational source changed during reading')
        references[str(path.absolute())] = before
        return value

    for row in schedule:
        prefix = 'executions/' + row['execution_id'] + '/'
        source = Path(metadata['selected'][prefix + 'outcome.json']['source']).parent.parent.parent
        outcome = read_record(source, prefix + 'outcome.json')
        evidence = read_record(source, prefix + 'evidence.json') or {}
        events = read_record(source, prefix + 'events.jsonl', True)
        # Hash raw audit/worker logs, never export their payloads (may contain answers).
        for name in ('raw/outbound-audit.jsonl', 'raw/worker-stdout.jsonl', 'raw/worker-stderr.txt', 'task-created-host.json', 'task-created.json', 'vm-close-error.json'):
            path = safe(source, prefix + name)
            if path.is_file():
                references[str(path.absolute())] = sha(path)
        isolation = read_record(source, prefix + 'isolation.json')
        vm_id = isolation.get('vm_id') if isolation else None
        if vm_id:
            vm_ids.append(vm_id)
        iso_summary = {'available': isolation is not None, 'vm_id': vm_id,
                       'passed': isolation.get('exit_code') == 0 and 'FILESYSTEM_AND_EGRESS_BLOCKED' in isolation.get('stdout', '') if isolation else None,
                       'exit_code': isolation.get('exit_code') if isolation else None,
                       'vm_close_error_recorded': (source / prefix / 'vm-close-error.json').exists(),
                       'no_host_mounts': isolation['host_mounts'] == [] if isolation and isinstance(isolation.get('host_mounts'), list) else None,
                       'record_ref': str(source / prefix / 'isolation.json') if isolation else None}
        # Keep only numeric evidence metadata, not retained text or source snippets.
        evidence_summary = {k: v for k, v in evidence.items() if k in ('native_evidence_bytes', 'native_evidence_proxy_tokens', 'original_bytes', 'original_tokens', 'retained_bytes', 'retained_tokens', 'truncated')}
        public_outcome = {k: outcome[k] for k in ('status', 'phase', 'classification', 'error_classification', 'setup_ms', 'total_ms', 'host_wall_ms', 'retrieval_ms', 'answer_ms', 'model_usage', 'model_attempts', 'api_attempts', 'retries', 'provider_charge', 'currency', 'accounting_status') if k in outcome}
        # Deadline diagnostic without copying arbitrary error text into reports.
        if any(t in str(outcome.get('error', '')).lower() for t in ('timeout', 'deadline')):
            public_outcome['classification'] = public_outcome.get('classification') or 'deadline'
        records.append({**row, 'outcome': public_outcome, 'event_counts': event_counts(events or []),
                        'events_available': events is not None, 'evidence': evidence_summary, 'isolation': iso_summary,
                        'source_outcome_ref': str(source / prefix / 'outcome.json')})
    roots = [Path(root) for root in metadata.get('source_roots', [metadata[k] for k in ('original', 'continuation')])]
    audits = []
    for root in roots:
        audit = read_record(root, 'leakage-audit.json')
        terminal = read_record(root, 'campaign-terminal.json')
        manifest = read_record(root, 'manifest.json')
        runtime_mounts = manifest.get('runtime', {}).get('host_mounts')
        audits.append({'root': str(root), 'leakage_audit': {k: audit.get(k) for k in ('passed', 'files_checked', 'canary_seen', 'no_host_mounts', 'no_contestant_tools')} if audit else None,
                       'terminal': {k: terminal.get(k) for k in ('status', 'ended_at', 'planned', 'additional_attempts')} if terminal else None,
                       'runtime_no_host_mounts': runtime_mounts == [] if isinstance(runtime_mounts, list) else None})
    validate_view(view)
    for path, digest in references.items():
        require(sha(Path(path)) == digest, 'operational source changed')
    statuses = Counter(r['outcome']['status'] for r in records)
    result = {'report_type': 'operational only; no rubric grading', 'scheduled': len(records),
              'local_attempts': sum(r['outcome']['status'] != 'not_run' for r in records),
              'completed': statuses['completed'], 'terminal_statuses': dict(statuses),
              'campaign_complete': metadata['campaign_complete'], 'workflows': summarize(records),
              'quality': {'status': 'pending frozen two-independent-human-reviewer process and human adjudication',
                          'scores': None, 'confidence_intervals': None,
                          'known_primary': [{'execution_id': r['execution_id'], 'score': 0, 'reason': 'controller setup failure, not provider reliability evidence'} for r in records[:1] if r['outcome'].get('phase') == 'setup' and r['outcome']['status'] == 'failed']},
              'vm_isolation': {'recorded_vm_ids': len(vm_ids), 'unique_vm_ids': len(set(vm_ids)), 'duplicates': [v for v, n in Counter(vm_ids).items() if n > 1], 'missing_isolation_records': sum(not r['isolation']['available'] for r in records), 'missing_vm_ids': sum(not r['isolation']['vm_id'] for r in records),
                               'isolation_passed': sum(r['isolation'].get('passed') is True for r in records),
                               'isolation_failed': sum(r['isolation'].get('passed') is False for r in records),
                               'mount_checks_unknown': sum(r['isolation']['no_host_mounts'] is None for r in records),
                               'mount_checks_failed': sum(r['isolation']['no_host_mounts'] is False for r in records),
                               'vm_close_error_records': sum(r['isolation']['vm_close_error_recorded'] for r in records)}, 
              'source_terminal_audits': audits, 'records': records, 'source_record_sha256': references,
              'view_provenance': metadata,
              'limitations': ['Scheduled and local attempts are not provider executions. Setup failure is controller-only, not a provider quality or reliability observation.', 'Counts are observed events, not billed requests; absent logs and usage remain unknown. Failed attempts are included.', 'Native JSON sizes differ from header-enriched normalized sizes; tokens are tokenizer proxies.', 'Catalog usage costs are estimates, not actual bills. Null charges and subscription accounting remain unknown.', 'Timeout latency is time to terminal, not completion; no quality uncertainty estimate exists before human review.', 'No extra attempts authorized; original setup failure retained zero. Operational incident and interrupted pair/window remain disclosed in view provenance.']}
    destination.mkdir(mode=0o700)
    with (destination / 'operations.json').open('x') as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
        stream.write('\n')
    with (destination / 'report.md').open('x') as stream:
        stream.write('# Offline operational report — quality pending\n\n')
        stream.write(f"Scheduled: {len(records)}; local attempts: {result['local_attempts']}; completed: {result['completed']}. These are not counts of provider executions.\n\n")
        stream.write('The retained initial isolation setup failure is a controller incident, not provider reliability evidence, and remains primary zero. All other rubric scores and quality confidence intervals await two independent human reviewers and adjudication. No graders or APIs were invoked.\n\n')
        stream.write('```json\n' + json.dumps({k: result[k] for k in ('terminal_statuses', 'workflows', 'vm_isolation', 'source_terminal_audits', 'limitations')}, indent=2, allow_nan=False) + '\n```\n\nController-only source references/hashes and per-execution isolation records: `operations.json`. No answer text is exported.\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('view', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    report(args.view, args.out)


if __name__ == '__main__':
    main()
