#!/usr/bin/env python3
"""Summarize a completed, judged pilot from saved artifacts; makes no API calls."""
import argparse
import json
import statistics
from pathlib import Path


def load(path):
    return json.loads(path.read_text())


def summarize(run):
    schedule = [json.loads(line) for line in (run / 'schedule.jsonl').read_text().splitlines() if line]
    packets = {x['anonymous_id']: x for x in load(run / 'judging/packets.json')}
    mapping = {x['execution_id']: x for x in load(run / 'judging/blind-map.json')}
    judgments = {x['anonymous_id']: x for x in load(run / 'judging/judge-1.json')['answers']}
    records = []
    for entry in schedule:
        directory = run / 'executions' / entry['execution_id']
        outcome = load(directory / 'outcome.json')
        if outcome['status'] != 'completed':
            raise ValueError('This pilot summary requires all four terminal completions; never omit failed rows')
        evidence = load(directory / 'evidence.json')
        isolation = load(directory / 'isolation.json')
        anonymous_id = mapping[entry['execution_id']]['anonymous_id']
        reference = packets[anonymous_id]['reference']
        judgment = judgments[anonymous_id]
        scores = {x['id']: x['score'] for x in judgment['criteria']}
        maximum = sum(x['weight'] for x in reference['criteria'])
        points = sum(x['weight'] * scores[x['id']] for x in reference['criteria'])
        events = [json.loads(line) for line in (directory / 'events.jsonl').read_text().splitlines() if line]
        usages = outcome['model_usage']
        records.append({
            **entry,
            'status': outcome['status'],
            'rubric_points': points,
            'rubric_maximum': maximum,
            'rubric_score': points / maximum,
            'rubric_perfect': points == maximum,
            'workflow_seconds': outcome['total_ms'] / 1000,
            'retrieval_seconds': outcome['retrieval_ms'] / 1000,
            'answer_seconds': outcome['answer_ms'] / 1000,
            'vm_setup_seconds': isolation['setup_ms'] / 1000,
            'host_wall_seconds': outcome['host_wall_ms'] / 1000,
            'evidence_proxy_tokens': evidence['retained_tokens'],
            'evidence_bytes': evidence['retained_bytes'],
            'evidence_truncated': evidence['truncated'],
            'model_tokens': sum(x['usage']['totalTokens'] for x in usages),
            'model_input_tokens': sum(x['usage']['input'] for x in usages),
            'model_output_tokens': sum(x['usage']['output'] for x in usages),
            'catalog_model_cost_estimate_usd': sum(x['usage']['cost']['total'] for x in usages),
            'actual_workflow_charge': None,
            'retrieval_api_calls_including_polling': sum(x['event'] == 'api_request' for x in events),
            'model_calls': len(usages),
        })
    workflows = {}
    for name in ('parallel', 'context7'):
        rows = [x for x in records if x['workflow'] == name]
        workflows[name] = {
            'completed': len(rows),
            'rubric_perfect_answers': sum(x['rubric_perfect'] for x in rows),
            'median_workflow_seconds': statistics.median(x['workflow_seconds'] for x in rows),
            'model_tokens': sum(x['model_tokens'] for x in rows),
            'evidence_proxy_tokens': sum(x['evidence_proxy_tokens'] for x in rows),
            'catalog_model_cost_estimate_usd': sum(x['catalog_model_cost_estimate_usd'] for x in rows),
            'actual_charges': None,
        }
    return {
        'campaign': run.name,
        'pilot_only': True,
        'unique_questions': 2,
        'planned_executions': 4,
        'completed_executions': len(records),
        'records': records,
        'workflows': workflows,
        'leakage_audit': load(run / 'leakage-audit.json'),
        'citation_checks': load(run / 'judging/citation-checks.json'),
        'adjudications': load(run / 'judging/adjudications.json'),
        'judge_usage': load(run / 'judging/judge-metadata.json'),
        'limitations': [
            'Two questions, one attempt each: no winner, uncertainty interval, p95 inference, family macro, or run-to-run variability claim.',
            'Latency is inside a ready guest; VM setup and host wall time are recorded separately.',
            'Token packet budgets use an explicitly labeled o200k_base proxy.',
            'Actual provider/subscription charges unavailable; catalog estimates are not actual bills.',
            'Grouped citation checks are not exhaustive atomic-claim coverage/precision metrics.',
            'Next.js exact-version evidence was unavailable from Context7 and honestly disclosed.',
            'Initial host-only zstd audit failure is preserved in a separate setup campaign, not erased.',
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path)
    args = parser.parse_args()
    result = summarize(args.run)
    destination = args.run / 'results.json'
    with destination.open('x') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(destination)
    for name, row in result['workflows'].items():
        print(name, f"{row['completed']}/2 completed; {row['rubric_perfect_answers']}/2 rubric-perfect; "
                    f"median {row['median_workflow_seconds']:.1f}s; {row['model_tokens']} model tokens")


if __name__ == '__main__':
    main()
