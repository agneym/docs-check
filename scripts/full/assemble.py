#!/usr/bin/env python3
"""Offline append-only first-pass report view. Never launches executions."""
import argparse
import hashlib
import json
from pathlib import Path

FILES = ('outcome.json', 'answer.json', 'evidence.json', 'public-request.json', 'isolation.json')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def load(p):
    return json.loads(p.read_bytes())


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def safe(root, name):
    p = root / name
    require(p.resolve().is_relative_to(root.resolve()), 'path escapes root')
    require(not p.is_symlink(), 'symlink input')
    return p


def rows(root):
    result = [json.loads(x) for x in (root / 'schedule.jsonl').read_text().splitlines() if x.strip()]
    ids = [r['execution_id'] for r in result]
    require(len(ids) == len(set(ids)), 'duplicate execution ID')
    require(all(isinstance(i, str) and Path(i).name == i and i not in ('.', '..') for i in ids), 'unsafe execution ID')
    return result


def inventory(original, continuation):
    m, c = load(original / 'manifest.json'), load(continuation / 'manifest.json')
    fixture = m.get('config', {}).get('fixture_mode') is True
    origin = c['origin']
    require(c['phase'] == 'full-first-pass-continuation', 'wrong continuation phase')
    require(Path(origin['run']).resolve() == original.resolve(), 'wrong origin run')
    for name, field in [('manifest.json', 'manifest_sha256'), ('launch.json', 'launch_sha256')]:
        require(sha(original / name) == origin[field], 'original hash mismatch: ' + name)
    tracked = {}
    if 'terminal_sha256' in origin:
        require(sha(original / 'campaign-terminal.json') == origin['terminal_sha256'], 'original terminal hash mismatch')
    if 'schedule_sha256' in origin:
        require(sha(original / 'schedule.jsonl') == origin['schedule_sha256'], 'original schedule hash mismatch')
    if 'claim_sha256' in origin:
        claim = Path(origin['claim_path'])
        require(sha(claim) == origin['claim_sha256'], 'original claim hash mismatch')
        tracked[str(claim.absolute())] = origin['claim_sha256']
    def track(root, name, expected=None):
        p = safe(root, name)
        h = sha(p)
        require(expected is None or h == expected, 'frozen hash mismatch: ' + name)
        tracked[str(p.absolute())] = h
    for root in (original, continuation):
        for name in ('manifest.json', 'schedule.jsonl', 'launch.json', 'campaign-terminal.json'):
            track(root, name)
    terminal = load(continuation / 'campaign-terminal.json')
    require(terminal.get('status') in ('pass-ended', 'paused'), 'continuation not campaign-terminal')
    if not fixture:
        track(original, 'freeze.sha256')
        require((original / 'freeze.sha256').read_text().strip() == sha(original / 'manifest.json'), 'freeze mismatch')
        for name, h in m['hashes'].items():
            track(original, name if name == 'schedule.jsonl' else 'frozen/' + name, h)
        for name, field in [('model.json', 'model_sha256'), ('worker.bundle.mjs', 'worker_bundle_sha256'), ('offline-checks.json', 'offline_checks_sha256'), ('isolation-preflight.json', 'isolation_preflight_sha256')]:
            track(original, name, m[field])
        refs = m['api_references']
        track(original, 'references/archive-index.json', refs['archive_index_sha256'])
        for r in refs['records']:
            track(original, 'references/' + r['path'], r['sha256'])
    if not fixture:
        track(continuation, 'freeze.sha256')
        require((continuation / 'freeze.sha256').read_text().strip() == sha(continuation / 'manifest.json'), 'continuation freeze mismatch')
        require(c.get('config') == m['config'], 'continuation config changed')
        for name, h in c['hashes'].items():
            track(continuation, name if name == 'schedule.jsonl' else 'frozen/' + name, h)
        for name, field in [('model.json', 'model_sha256'), ('worker.bundle.mjs', 'worker_bundle_sha256')]:
            require(c[field] == m[field], 'continuation contestant artifact changed')
            track(continuation, name, m[field])
        for name, field in [('offline-checks.json', 'offline_checks_sha256'), ('isolation-preflight.json', 'isolation_preflight_sha256'), ('incident-report.md', 'incident_report_sha256')]:
            track(continuation, name, c[field])
        if 'isolation_preflight_audit_sha256' in c:
            track(continuation, 'isolation-preflight-audit.jsonl', c['isolation_preflight_audit_sha256'])
        require(c['runtime'] == m['runtime'] and c['dependencies'] == m['dependencies'], 'continuation runtime changed')
    schedule = rows(original)
    require(set(origin['outcomes']) == {r['execution_id'] for r in schedule}, 'origin outcome set mismatch')
    launch = load(original / 'launch.json')
    for root in (original, continuation):
        l = load(root / 'launch.json')
        require(l['manifest_sha256'] == sha(root / 'manifest.json'), 'launch manifest mismatch')
        encoded = json.dumps(l['resolved_config'], ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
        require(hashlib.sha256(encoded).hexdigest() == l['execution_config_hash'] == launch['execution_config_hash'], 'execution settings mismatch')
    if not fixture:
        l = load(continuation / 'launch.json')
        require(c['execution_config_hash'] == launch['execution_config_hash'], 'continuation manifest execution hash mismatch')
        require(l['original_manifest_sha256'] == origin['manifest_sha256'], 'launch original manifest mismatch')
        approval = l['approval']
        expected = {'phase': 'full-first-pass-continuation', 'manifest_sha256': sha(continuation / 'manifest.json'), 'original_manifest_sha256': origin['manifest_sha256'], 'executions': 95, 'attempts': 1, 'approved': True, 'preserve_failed_entries': True, 'extra_executions_approved': False, 'automatic_topups': False}
        require(all(type(approval.get(k)) is type(v) and approval[k] == v for k, v in expected.items()), 'invalid continuation approval')
        require(all(isinstance(approval.get(k), str) and approval[k].strip() for k in ('approved_by', 'user_authorization')), 'approval identity required')
        spending = approval['spending']
        require(spending['policy'] == 'uncapped-explicitly-approved' and spending['cap'] is None and spending['automatic_topups'] is False, 'continuation spending changed')
        claim = Path(l['claim_path'])
        tracked[str(claim.absolute())] = sha(claim)
    pending, selected, amendments = [], {}, []
    for r in schedule:
        eid = r['execution_id']
        name = f'executions/{eid}/outcome.json'
        track(original, name, origin['outcomes'][eid])
        old = load(original / name)
        require(old.get('config_hash') == launch['execution_config_hash'], 'original outcome config mismatch')
        if old['status'] == 'not_run':
            pending.append(r)
            source = continuation
            amendments.append({'execution_id': eid, 'original_outcome_sha256': origin['outcomes'][eid], 'replacement': str(continuation / name)})
        else:
            source = original
        outcome = load(source / name)
        if not fixture:
            for record in (old, outcome):
                require(all(record.get(k) == r[k] for k in ('execution_id', 'question_id', 'workflow', 'repeat')), 'outcome identity mismatch')
                require(record.get('status') in ('completed', 'failed', 'timeout', 'not_run'), 'invalid outcome status')
        require(outcome.get('config_hash') == launch['execution_config_hash'], 'outcome config mismatch')
        for file in FILES:
            rel = f'executions/{eid}/{file}'
            if (source / rel).exists():
                track(source, rel)
                selected[rel] = str((source / rel).absolute())
    require(rows(continuation) == pending, 'continuation must contain exactly original not_run rows in order')
    require({p.name for p in (continuation / 'executions').iterdir()} == {r['execution_id'] for r in pending}, 'extra continuation executions')
    if not fixture:
        require(len(schedule) == 96 and len(pending) == 95 and schedule[0]['execution_id'] == 'takumi-05-parallel-1', 'wrong production first pass')
        first = load(original / 'executions/takumi-05-parallel-1/outcome.json')
        require(first['status'] == 'failed' and first.get('phase') == 'setup' and 'run_id' in first and first['run_id'] is None, 'original setup failure required')
    for name in ('manifest.json', 'schedule.jsonl', 'launch.json'):
        selected[name] = str((original / name).absolute())
    return {'schema_version': 1, 'operational_incident': {'classification': 'controller isolation setup failure; not provider reliability evidence', 'implementation_change': 'Continuation uses a separately frozen implementation; see continuation manifest and launch.', 'interrupted_pair_window': 'Original first entry failed before continuation; disclose interruption in report.'}, 'original': str(original.resolve()), 'continuation': str(continuation.resolve()), 'source_hashes': tracked, 'selected': {k: {'source': v, 'sha256': sha(Path(v))} for k, v in selected.items()}, 'amendments': amendments, 'campaign_complete': all(load(Path(v))['status'] != 'not_run' for k, v in selected.items() if k.endswith('/outcome.json'))}


def assemble(original, continuation, destination):
    require(not destination.exists(), 'view destination already exists')
    metadata = inventory(original.resolve(), continuation.resolve())
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


def validate_view(view):
    metadata = load(view / 'view-provenance.json')
    if metadata.get('kind') == 'second-continuation-view':
        from assemble_chain import validate_view as validate_chain
        return validate_chain(view)
    require(metadata == inventory(Path(metadata['original']), Path(metadata['continuation'])), 'view provenance/source changed')
    expected = set(metadata['selected'])
    actual = {str(p.relative_to(view)) for p in (view / 'executions').rglob('*') if p.is_file()}
    require(actual == {n for n in expected if n.startswith('executions/')}, 'view execution file set changed')
    for name, record in metadata['selected'].items():
        require(sha(safe(view, name)) == record['sha256'], 'view copied bytes changed: ' + name)
    return metadata


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('original', 'continuation', 'destination'):
        p.add_argument(name, type=Path)
    a = p.parse_args()
    assemble(a.original, a.continuation, a.destination)


if __name__ == '__main__':
    main()
