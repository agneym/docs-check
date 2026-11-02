# Four-execution pilot report

**Completed on 2026-11-01 UTC.** Two questions, two workflows, one attempt each in the corrected campaign. **4/4 completed.** The 48-question first pass has **not** been run; no additional attempts are scheduled.

## Results

Both workflows met every frozen rubric criterion on both pilot questions. These are documentation-grounded judgments, not runtime tests of the example application code.

| Question | Workflow | Rubric points | Retrieval/planning | Answering | Workflow total |
|---|---|---:|---:|---:|---:|
| `nextjs-02` — cookies | Parallel Task API | 2/2 | 57.0s | 6.3s | **63.2s** |
| `nextjs-02` — cookies | Context7 | 2/2 | 16.1s | 5.0s | **21.1s** |
| `tanstack-06` — Router–Query integration | Parallel Task API | 5/5 | 53.1s | 8.2s | **61.3s** |
| `tanstack-06` — Router–Query integration | Context7 | 5/5 | 19.2s | 6.9s | **26.1s** |

Workflow clocks run inside the ready guest and include planning, resolution, API submission/polling, evidence normalization, and answer generation. VM setup/preflight/transfer added **10.4–11.2s per execution**, recorded separately. Host wall time is also retained. With only two observations per workflow, no p95, confidence interval, family macro, winner, or run-to-run variability claim is warranted.

### Quality and version findings

- A fresh, provider-label-blinded `gpt-6.1-terra`/medium judge scored the four answers in randomized order, receiving the private rubric only after all contestant outputs were saved. It received no workflow names, timing, costs, or task IDs. URLs can still reveal provenance.
- **All 10 distinct final-answer citation URLs were independently retrieved successfully.** Grouped claim checks supported the cited assertions. Cached bodies, hashes, timestamps, judgments, and adjudications are preserved. This is not an exhaustive atomic-claim precision/coverage metric.
- Context7 returned Next.js **canary** documentation rather than a verified `16.4.3` version-specific index. Its answer correctly disclosed that limitation while giving the rubric-correct behavior. Parallel cited the current Next.js website, which identified **Latest v16.4.3** when independently fetched. Live pages are not immutable release snapshots.
- The initial judge incorrectly treated Context7's honest provenance caveat as a contradiction of the private key's version scope. Controller adjudication rejected that false positive **before opening the blind map**. Two other judge flags marked facts unverifiable; independent citation checks supported both. No criterion scores or reference answers were changed.
- No material incorrect or still-unverifiable extra final-answer claims were identified in this pilot review. Native retrieval findings were preserved, but were not exhaustively fact-checked as standalone answers.

## Isolation: implemented and checked

- Gondolin **0.14.0**, QEMU **8.2.2**, pinned Alpine image build `f59d9a69-1f62-57e0-a392-6800d3dd021d`.
- **Fresh VM per workflow execution; no host directory mounts.** No repository, answer key, source corpus, home directory, credential store, prior session, or other workflow's results were available to contestants.
- Exported inputs contained only the verbatim public product/version/question, generic Task spec, safe model metadata, and the trusted executable bundle.
- Model calls used **`gpt-6.1-terra`, medium reasoning**, fresh API contexts, **no tools**, one user message, no previous response, and no coding-agent session/resource discovery.
- Hostname/path/method restrictions allowed only that workflow's provider and the model endpoint. Synthetic DNS; no SSH, mapped TCP, ingress, or WebSockets. Probes to an unapproved host and a metadata-service address were blocked.
- Real credentials remained on the host and were substituted into approved request headers. Private-file paths and previous-VM marker checks passed. The host-only canary was absent from outbound payloads and contestant artifacts.
- Parallel used direct `POST /v1/tasks/runs`, explicit **`core-fast`**, the JSON findings spec, and a fresh random memory scope per execution. The research CLI/skill was **not** invoked.

These checks demonstrate the configured boundary and observed absence of leakage; they are not a proof against hypervisor flaws, a malicious trusted controller, or every possible side channel.

## Usage and accounting

| Metric, summed across two questions | Parallel | Context7 |
|---|---:|---:|
| Common/planning model calls | 2 | 6 (four planning, two answering) |
| Model input + output tokens, provider-reported | 19,890 | 9,931 |
| Retained evidence proxy tokens | 18,419 | 5,444 |
| Retrieval API calls, including polling | 23 | 6 |
| Catalog estimate for workflow model usage only | $0.024234 | $0.014875 |
| Actual total charges | **Unavailable** | **Unavailable** |

The judge was one additional model call: **9,029 tokens**, catalog estimate **$0.013813**, actual charge unavailable. Catalog estimates are **not subscription bills**, exclude native retrieval-provider charges, and must not be described as actual spend. Parallel's internal research-model calls/tokens are not exposed and are not included in the model counts above. No automatic top-ups occurred.

No evidence packet hit the 12,000-token cap. Counts use pinned `js-tiktoken@1.0.21/o200k_base` as a **proxy**, not a verified exact GPT-6.1 tokenizer. The Codex client has no native output-token cap; the runner's local cap cannot guarantee a client abort stops provider charging.

## Preserved setup failure

An earlier local campaign stopped on its first planning call: the Codex client sends **zstd-compressed** SSE request bodies, while the original host audit hook assumed plain JSON. The hook rejected the body before forwarding to the model; no retrieval-provider request or model response was produced. The remaining three entries were recorded as `not_run`.

The failure was preserved, reproduced with a synthetic fixture, and fixed by decoding zstd before validation. A separate corrected campaign then completed the four intended provider workflows. There were therefore **five local workflow starts across setup and the corrected pilot**, not an erased/overwritten first failure. No answer-quality-based retries or duplicate Parallel tasks were made. This setup incident is separate from provider reliability in the corrected campaign.

## Artifacts and reproducibility

- **Corrected campaign:** `~/random/docs-check-runs/2026-11-01T18-18-38-840Z-9cb372/`
- **Earlier setup failure:** `~/random/docs-check-runs/2026-11-01T18-15-51-731Z-7a89b3/`
- Corrected campaign contains `manifest.json`, `schedule.jsonl`, `model.json`, per-execution inputs/audits/raw outputs/evidence/answers/timing/usage, `leakage-audit.json`, blinded judge packets/map/results, independent citation caches, adjudications, and `results.json`.
- Frozen source/input copies were archived after verifying their hashes still matched the pre-run manifest. The manifest records image metadata, QEMU binary hash, prompts, model metadata, input/code hashes, and the explicit pilot limitations.
- Runner/setup documentation: [`../scripts/pilot/README.md`](../scripts/pilot/README.md). Eight local runner tests and eleven dataset compiler tests pass.

## Before the first full pass

The basic plumbing and isolation worked after the transport fix. Carry forward the explicit distinction between **reference version scope** and **retrieved-evidence provenance** so an honest index-version disclosure is not falsely graded as an incorrect claim. Complete full-run fault-fixture coverage, scoring/reporting automation, and configuration freeze; obtain separate full-run spending authorization. If approved later, that pass is **48 × 2 × 1 = 96 executions**, not a commitment to further attempts.
