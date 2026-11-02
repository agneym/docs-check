#!/usr/bin/env python3
"""Read-only, no-network snapshot of the one approved 2-completed/6-failed base."""
import argparse
import json
from pathlib import Path
from assemble import load, require, rows, safe, sha, validate_view


def snapshot(base):
    base = base.resolve()
    meta = validate_view(base)
    require('kind' not in meta, 'only the first partial view can precede this continuation')
    manifest, launch = load(base / 'manifest.json'), load(base / 'launch.json')
    outcomes, log_hashes = {}, {}
    schedule = rows(base)
    for row in schedule:
        eid = row['execution_id']
        relative = f'executions/{eid}/outcome.json'
        path = safe(base, relative)
        outcome = load(path)
        outcomes[eid] = {'sha256': sha(path), 'outcome': outcome}
        source = Path(meta['selected'][relative]['source']).parent
        if outcome['status'] == 'not_run':
            require({p.name for p in source.iterdir()} == {'outcome.json'}, 'unrun entry has attempt artifacts')
        else:
            for p in sorted(source.rglob('*')):
                require(not p.is_symlink(), 'symlink in old execution')
                if p.is_file():
                    log_hashes[str(p.absolute())] = sha(p)
    validate_view(base)
    for path, digest in log_hashes.items():
        require(sha(Path(path)) == digest, 'old execution changed during snapshot')
    return {'view_kind': 'first-continuation-view', 'manifest': manifest, 'launch': launch,
            'first_continuation_manifest': load(Path(meta['continuation']) / 'manifest.json'),
            'original_root': meta['original'], 'first_continuation_root': meta['continuation'],
            'schedule': schedule, 'outcomes': outcomes,
            'base_view': {'run': str(base), 'provenance_sha256': sha(base / 'view-provenance.json'),
                          'manifest_sha256': sha(base / 'manifest.json'), 'launch_sha256': sha(base / 'launch.json'),
                          'outcomes': {eid: record['sha256'] for eid, record in outcomes.items()},
                          'source_log_hashes': log_hashes}}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('view', type=Path)
    print(json.dumps(snapshot(p.parse_args().view), ensure_ascii=False))
