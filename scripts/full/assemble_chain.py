#!/usr/bin/env python3
"""Offline, append-only second continuation view (not a generic rerun merger)."""
import argparse
import hashlib
import json
from pathlib import Path

from assemble import FILES, load, require, rows, safe, sha


def inventory(base, continuation):
    from assemble import validate_view
    base, continuation = base.resolve(), continuation.resolve()
    prior = load(base / 'view-provenance.json')
    require('kind' not in prior, 'base must be the first continuation view')
    prior = validate_view(base)
    m, c = load(base / 'manifest.json'), load(continuation / 'manifest.json')
    fixture = m.get('config', {}).get('fixture_mode') is True
    require(c['phase'] == 'full-first-pass-continuation-2', 'wrong second continuation phase')
    link = c['base_view']
    require(Path(link['run']).resolve() == base, 'wrong base view')
    tracked = dict(prior['source_hashes'])

    def track(root, name, expected=None):
        p = safe(root, name)
        h = sha(p)
        require(expected is None or expected == h, 'hash mismatch: ' + name)
        tracked[str(p.absolute())] = h
        return h

    allowed_source_roots = [Path(prior[k]).resolve() for k in ('original', 'continuation')]
    for name, expected in link.get('source_log_hashes', {}).items():
        p = Path(name)
        require(p.is_absolute() and any(p.resolve().is_relative_to(root) for root in allowed_source_roots), 'source log outside base roots')
        track(p.parent, p.name, expected)
    for root in allowed_source_roots + [continuation]:
        for name in ('campaign-terminal.json', 'leakage-audit.json'):
            if (root / name).exists():
                track(root, name)
    for name, field in [('view-provenance.json', 'provenance_sha256'), ('manifest.json', 'manifest_sha256'), ('launch.json', 'launch_sha256')]:
        track(base, name, link[field])
    schedule = rows(base)
    require(set(link['outcomes']) == {r['execution_id'] for r in schedule}, 'base outcome set mismatch')
    pending, selected, amendments = [], {}, []
    launch = load(base / 'launch.json')
    for row in schedule:
        eid = row['execution_id']
        name = f'executions/{eid}/outcome.json'
        oldhash = track(base, name, link['outcomes'][eid])
        old = load(base / name)
        source = Path(prior['selected'][name]['source']).parents[2]
        if old['status'] == 'not_run':
            pending.append(row)
            source = continuation
            amendments.append({'execution_id': eid, 'base_outcome_sha256': oldhash,
                               'replacement': str(source / name), 'replacement_sha256': sha(safe(source, name))})
        outcome = load(safe(source, name))
        require(all(outcome.get(k) == row[k] for k in ('execution_id', 'question_id', 'workflow', 'repeat')), 'outcome identity mismatch')
        require(outcome.get('config_hash') == launch['execution_config_hash'], 'outcome config mismatch')
        require(outcome.get('status') in ('completed', 'failed', 'timeout', 'not_run'), 'invalid outcome status')
        for file in FILES:
            rel = f'executions/{eid}/{file}'
            if safe(source, rel).exists():
                selected[rel] = {'source': str(source / rel), 'sha256': track(source, rel)}
    require(rows(continuation) == pending, 'second continuation must contain exactly base not_run rows in order')
    require(all(r['repeat'] == 1 for r in pending), 'repeat must be one')
    require({p.name for p in (continuation / 'executions').iterdir()} == {r['execution_id'] for r in pending}, 'extra continuation executions')
    if not fixture:
        from collections import Counter
        require(len(schedule) == 96 and len(pending) == 88 and pending == schedule[8:], 'wrong production schedule')
        require(c.get('executions') == 88 and c.get('repeat') == 1, 'wrong manifest execution scope')
        require(Counter(load(base / f"executions/{r['execution_id']}/outcome.json")['status'] for r in schedule) == {'completed': 2, 'failed': 6, 'not_run': 88}, 'wrong base statuses')
        require(c['config'] == m['config'] and c['runtime'] == m['runtime'] and c['dependencies'] == m['dependencies'], 'contestant settings changed')
        require(c['model_sha256'] == m['model_sha256'], 'model changed')
        require(c['worker_bundle_sha256'] != load(Path(prior['continuation']) / 'manifest.json')['worker_bundle_sha256'], 'parser correction bundle must be newly frozen')
        require((continuation / 'freeze.sha256').read_text().strip() == sha(continuation / 'manifest.json'), 'freeze mismatch')
        track(continuation, 'freeze.sha256')
        for name, h in c['hashes'].items():
            track(continuation, name if name == 'schedule.jsonl' else 'frozen/' + name, h)
        for name, field in [('model.json', 'model_sha256'), ('worker.bundle.mjs', 'worker_bundle_sha256'), ('offline-checks.json', 'offline_checks_sha256'), ('isolation-preflight.json', 'isolation_preflight_sha256'), ('isolation-preflight-audit.jsonl', 'isolation_preflight_audit_sha256'), ('incident-report.md', 'incident_report_sha256')]:
            track(continuation, name, c[field])
    for name in ('manifest.json', 'schedule.jsonl', 'launch.json', 'campaign-terminal.json'):
        track(continuation, name)
    require(load(continuation / 'campaign-terminal.json')['status'] in ('pass-ended', 'paused'), 'continuation not terminal')
    l = load(continuation / 'launch.json')
    require(l['manifest_sha256'] == sha(continuation / 'manifest.json'), 'launch manifest mismatch')
    encoded = json.dumps(l['resolved_config'], ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
    require(hashlib.sha256(encoded).hexdigest() == l['execution_config_hash'] == launch['execution_config_hash'], 'execution settings changed')
    if not fixture:
        require(c['execution_config_hash'] == l['execution_config_hash'], 'manifest settings changed')
        approval = l['approval']
        require(l.get('base_provenance_sha256') == link['provenance_sha256'], 'launch base provenance mismatch')
        expected = {'phase': c['phase'], 'base_provenance_sha256': link['provenance_sha256'], 'manifest_sha256': sha(continuation / 'manifest.json'), 'executions': 88, 'attempts': 1, 'approved': True, 'preserve_previous_entries': True, 'extra_executions_approved': False, 'automatic_topups': False}
        require(all(type(approval.get(k)) is type(v) and approval[k] == v for k, v in expected.items()), 'invalid second continuation approval')
        require(all(isinstance(approval.get(k), str) and approval[k].strip() for k in ('approved_by', 'user_authorization')), 'approval identity required')
        spending = approval['spending']
        require(spending['policy'] == 'uncapped-explicitly-approved' and spending['cap'] is None and spending['automatic_topups'] is False, 'spending changed')
        claim = Path(l['claim_path'])
        require(claim.resolve() == Path(prior['original']).resolve() / 'continuation-2-consumed.json', 'wrong second continuation claim path')
        track(claim.parent, claim.name)
    for name in ('manifest.json', 'schedule.jsonl', 'launch.json'):
        selected[name] = {'source': str(base / name), 'sha256': track(base, name)}
    return {'schema_version': 1, 'kind': 'second-continuation-view', 'base_view': str(base), 'original': prior['original'], 'continuation': str(continuation), 'source_roots': [prior['original'], prior['continuation'], str(continuation)], 'base_provenance_sha256': sha(base / 'view-provenance.json'), 'operational_incident': {'prior': prior['operational_incident'], 'stage': 'second-continuation', 'classification': 'Controller parser rejection of native documentation plaintext and interrupted execution window; not provider quality evidence', 'implementation_change': 'New frozen worker corrects exact documentation-endpoint plaintext parsing; graceful pause drains the current execution under unchanged deadlines without replacement.', 'preserved_entries': 'Two completed and six failed entries retained unchanged; only 88 previously not_run entries selected.', 'sensitivity_plan': c.get('sensitivity_plan'), 'approved_changes': c.get('approved_changes', []), 'pause_policy': c.get('pause_policy'), 'incident_report': str(continuation / 'incident-report.md')}, 'source_hashes': tracked, 'selected': selected, 'amendments': amendments, 'campaign_complete': all(load(Path(v['source']))['status'] != 'not_run' for k, v in selected.items() if k.endswith('/outcome.json'))}


def validate_view(view):
    metadata = load(view / 'view-provenance.json')
    require(metadata == inventory(Path(metadata['base_view']), Path(metadata['continuation'])), 'chain provenance/source changed')
    actual = {str(p.relative_to(view)) for p in (view / 'executions').rglob('*') if p.is_file()}
    require(actual == {n for n in metadata['selected'] if n.startswith('executions/')}, 'view execution file set changed')
    for name, record in metadata['selected'].items():
        require(sha(safe(view, name)) == record['sha256'], 'view copied bytes changed: ' + name)
    return metadata


def assemble(base, continuation, destination):
    require(not destination.exists(), 'view destination already exists')
    metadata = inventory(base, continuation)
    destination.mkdir(mode=0o700)
    for name, record in metadata['selected'].items():
        p = destination / name
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open('xb') as stream:
            stream.write(Path(record['source']).read_bytes())
    (destination / 'completed-view').touch(exist_ok=False)
    with (destination / 'view-provenance.json').open('x') as stream:
        json.dump(metadata, stream, indent=2)
    validate_view(destination)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('base', 'continuation', 'destination'):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    assemble(args.base, args.continuation, args.destination)
