# First full pass — execution complete, automated analysis available

**Subsequent review update (2026-11-02):** the approved [LLM-only judging](../scripts/full/LLM-JUDGING.md) and [continuation](../scripts/full/LLM-CONTINUATION.md) finished 252 calls, including exactly two approved initial retries and 58 adjudications, with no benchmark reruns. [Automated results](llm-quality-report.md) show no clear quality winner; an explicit post-hoc identical-duplicate exception and strict unresolved bounds are disclosed. Strict review remains incomplete for one final answer. Operational results below are unchanged; historical references to pending human review describe the original plan, not human validation of machine judgments. No further calls are scheduled.

**All 96 scheduled entries were attempted once.** The final verified view contains **90 completed answers, 6 preserved failed/zero entries and 0 unrun entries**. The corrected 88-entry continuation completed **88/88** with no new failures. No answer-quality retry, replacement execution, additional pass or automatic top-up occurred. All runners are stopped and all three launch claims remain consumed.

“Completed” means the retrieval-to-answer pipeline completed, **not** that an answer passed its rubric. Correctness, harmful claims, citation/evidence support, version handling and comparative quality statistics await the frozen two-independent-human-reviewer process. No quality winner is claimed.

## Execution and timing results

| Workflow | Scheduled/attempted | Answers completed | Failed/zero | Completed-only workflow median | Completed-only p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Parallel direct Task API | 48 | 46 | 2 | 56.3s | 78.4s |
| Context7 | 48 | 44 | 4 | 22.2s | 29.7s |
| Total | **96** | **90** | **6** | — | — |

The failures are controller/infrastructure incidents described below, **not evidence of provider answer-quality failure**. The completion rates are therefore not intrinsic provider-reliability estimates. Workflow clocks include retrieval/planning, normalization and separate common-model answering, but exclude VM preparation and guest bootstrap/host flush overhead. Median recorded VM preparation was approximately **11 seconds** per execution. Host wall clocks and phase/all-terminal distributions are separately retained. Percentiles use linear interpolation at `(n−1)p`; these are descriptive selected-set measurements, not a deployment claim.

Completed-only retrieval median/p95: Parallel **52.4s / 73.1s**; Context7 **17.1s / 21.8s**. Answering median/p95: Parallel **5.0s / 8.6s**; Context7 **4.9s / 8.1s**. Two Parallel infrastructure failures have no final monotonic duration; their missing/censored times are not replaced by zero or excluded without disclosure. All-terminal Context7 latency includes its four fast transport failures; completed-only timings above avoid mistaking those failures for useful answers. The timings alone do not establish a quality winner.

The final 88-entry launch ran from **2026-11-01T20:41:41.150Z** to **22:00:24.920Z** (approximately **78m44s**). The full controller history began at **19:24:54.409Z**, with documented interruptions and implementation corrections. This deviated from an uninterrupted short campaign window; per-execution UTC timestamps and source/version metadata are preserved.

## Usage, evidence and accounting

| Metric across this first pass | Parallel | Context7 |
| --- | ---: | ---: |
| Common/planning model requests | 46 answering | 140: 48 library planning + 48 query selection + 44 answering |
| Provider-reported common/planning model tokens | 313,682 | 206,284 |
| Retrieval API requests including polling | 515 | 138 |
| Task creations | 47 | — |
| Status polls / result fetches | 422 / 46 | — |
| Catalog model estimate, **not actual spend** | $0.383174 | $0.307260 |
| Actual total charges | **Unavailable** | **Unavailable** |

There were **186** common/planning model requests and **519,966** reported model tokens in total. No transport/model retries were observed. Parallel's internal synthesis/search calls and tokens are not exposed and are not included in model counts. The catalog estimates exclude native retrieval-provider charges and are not subscription bills. The public processor/pricing tables omit the selected `core-fast` alias; its price is not inferred from `core`. Unknown/subscription accounting is never treated as zero.

One earlier interrupted Parallel task was last observed running. Its task ID and partial logs remain preserved; a client interruption does not establish server cancellation, and a late charge remains possible. No late-result/status request or unsupported cancellation was made, and no late result replaced its official failure. Evaluation/judging costs remain separate; no paid judge calls were launched.

No successful retained evidence packet hit the common 12,000-proxy-token cap. Median retained packet sizes: Parallel **6,165.5 proxy tokens** and Context7 **2,780.5**; p95 **10,163** and **4,682** respectively. Counts use pinned `js-tiktoken@1.0.21/o200k_base`, not a verified exact GPT-6.1 tokenizer. Native-output bytes/tokens are separately distinguished from header-enriched normalized packet sizes. Failed paths lacking a normalized packet remain explicit missingness. Parallel findings/basis are upstream synthesis, not measured access to all underlying documents.

## Preserved failures — no replacements

All six failures retain primary correctness zero under the frozen rule:

1. `takumi-05-parallel-1`: initial isolation setup failure, before any contestant/provider call.
2. `takumi-05-context7-1`, `takumi-02-context7-1`, `nextjs-12-context7-1`, `takumi-07-context7-1`: full-run transport rejected native plaintext documentation responses as invalid JSON. Planning/resolution and raw documentation responses remain preserved; no fallback answer was generated.
3. `takumi-07-parallel-1`: controller interruption during retrieval, with an outstanding Task ID and no final answer. A clearly labeled controller terminal record was appended after interruption.

The two answers completed before the final continuation (`takumi-02-parallel-1`, `nextjs-12-parallel-1`) remain byte-identical. Every original outcome and unrun placeholder remains intact in its source campaign. New outcomes were written only for entries that were previously unrun, with explicit amendment/hash links in new reporting views. The final view has exactly one selected terminal outcome for each question/workflow/repeat, not a silent overwrite or selection of best attempts.

## Corrections and protocol deviations

### Isolation-hook integration

The original controller failed initial setup at **19:25:03.949Z** because its audit callback threw on the two deliberately forbidden isolation probes, yielding HTTP 502 instead of the required 403. The earlier provider-denied preparatory VM had not exercised the same callback. The user approved an append-only 95-entry continuation, retaining that failure.

Production and offline preflight now share the hook builder. Only the exact preflight probes receive a local, non-forwarding 403; unexpected/worker-stage requests still latch an audit failure and block subsequent requests. Real Gondolin tests cover both workflows, cross-VM markers, existing host-only canaries, stage transitions and failure diagnostics. No isolation requirement was waived, no mount added and no pilot guard bypassed.

### Native Context7 parser regression and imperfect pause

Context7's documentation endpoint already returned plaintext in the pilot. The stricter full-run transport incorrectly required JSON for every success response. This was a runner regression, **not inferred API drift or provider answer-quality failure**. The first continuation accumulated four such failures.

An output wait subscribed after a particular Parallel finish marker had already appeared. It waited for future output until timeout while additional entries ran; SIGINT then interrupted `takumi-07-parallel-1` at **19:55:35.947Z**. The pause was **not immediate and not cleanly between executions**. This controller/operator limitation is disclosed rather than hidden as provider unreliability.

The user then approved correcting the parser/pause controls and continuing **only the remaining 88**, uncapped, preserving all eight prior attempts. The corrected transport accepts native plaintext only on the Context7 documentation route, retaining raw text/content type; Task/library-resolution JSON remain strict. Empty native responses receive an explicit empty-evidence marker. Malformed declared JSON/HTML on that route fails and pauses rather than silently continuing through many entries. Seven archived real plaintext responses and complete fake-network bundled pipelines were replayed offline; no pilot/provider smoke test was rerun.

A host-only pause file now drains the active execution under its original deadline, closes its VM, then marks the remainder unrun before starting another VM. Invalid/symlink/special pause paths fail closed. Direct-controller-PID signals are covered by local-worker real-VM tests; terminal Ctrl-C/`hc interrupt` must not be used because they can also signal QEMU. None of these corrections changed the selected answering model, reasoning, retrieval/answer deadlines, evidence/output budgets, processor, Task schema, public questions, reference answers, query planning prompts or no-tools/no-history boundary.

The final freeze passed **99 Node tests, 40 Python scoring/reporting tests and 11 dataset tests (150 total)**, plus the shared-production-hook preflights. Earlier passing fixture suites missed the actual response-format regression; the report does not claim those tests proved semantic answer correctness.

## Isolation and outbound audit observations

- Fresh pinned Gondolin 0.14.0 VMs, no repository/home/results mounts, synthetic DNS, blocked metadata/external probes, no WebSockets and no inherited agent session/tools.
- Real credentials stayed on the host and entered only approved request headers. Neither credential stores nor judge/controller material were exported. The answering API used a fresh single-user context, selected `gpt-6.1-terra`, medium reasoning, no tools/history/previous response and `store: false` for every observed model request.
- **95 recorded VM IDs were all distinct**, with successful isolation checks and no host mounts. The original initial setup failure has no saved VM ID/isolation record; it made no contestant call. It is not silently counted as a passed check.
- All **47** direct Task creations used `core-fast`, the unchanged explicit JSON findings schema and distinct random memory scopes; no previous interaction or duplicate creation was observed. No Parallel research CLI/skill, Search API or Parallel Responses API was substituted.
- All three source artifact leakage audits passed. The final policy audit verified all 186 model requests, all Task configurations/scopes and unchanged prior outcomes. An offline consistency audit also checked all 90 final answers against returned model-result text and verified each normalized answering context contains exactly the generic instruction plus that execution's own public request/evidence; it found no mismatches or Unicode replacement characters. This was structural checking, not rubric grading. These are observations of the configured boundary, not proof against every hypervisor flaw or a malicious controller.

## Blinded review and predeclared analyses

Two independently ordered **96-answer judge packet sets** and the controller-only sealed map have been prepared from the final verified view. No workflow labels, execution order, timings, costs or task IDs are in the packets; URLs/wording can still reveal provenance, so this is provider-label blinding rather than perfect anonymity. No judge results, citation-cache checks or adjudications have been fabricated.

The frozen primary remains the 48-question family-macro rubric score **including all six failed zeros**. The nonpilot 46-question sensitivity remains required. Before the 88 entries ran, a further diagnostic was predeclared to exclude the **paired questions** `nextjs-12`, `takumi-02`, `takumi-05`, `takumi-07` because their old outcomes contain the six diagnosed controller failures, leaving 44 pairs. This is a provenance-selected diagnostic, not answer-score-based dropping, and never replaces the primary. After human review, paired family-stratified 10,000-draw bootstrap analyses use the frozen seed **9102026**. Single attempts do not measure within-question run-to-run variability.

Judges must distinguish the private reference's requested version scope from retrieved-source provenance: an honest canary/unpinned disclosure is **not itself an incorrect claim**. Unknown/inaccessible support remains separate from factual falsehood. Correctness, extra claims, returned evidence, final citations and version handling remain separate rather than an arbitrary composite score.

## Artifact locations and freeze digests

All locations below are under `~/random/docs-check-runs/` and remain outside contestants and Git:

| Artifact | Directory |
| --- | --- |
| Original campaign | `2026-11-01-first-pass-freeze-v2/` |
| Approved 95-entry continuation (partial) | `2026-11-01-first-pass-continuation-1/` |
| Approved 88-entry continuation (88/88 completed) | `2026-11-01-first-pass-continuation-2/` |
| Earlier partial view / operational report | `2026-11-01-first-pass-view-1/`, `2026-11-01-first-pass-operations-1/` |
| **Final verified view** | `2026-11-01-first-pass-view-2/` |
| **Final operational JSON/report** | `2026-11-01-first-pass-operations-2/` |
| **Independent judge packets / sealed map** | `2026-11-01-first-pass-view-2/judging/` |

Manifest SHA-256 values:

- Original: `c24f52c3d341ee699e63501f7099d1cfb8fabc6377426d47de24c57d76ee72c3`.
- First continuation: `028a06b9d7cdb018696014056f764811cfbcc749e875dbc00f9e23f884807c96`.
- Final continuation: `56aea606de4c38ef191864113c3e2850853204550d930d07f3cab4bf806445b7`.

Manifests retain UTC times, Git revision plus uncommitted code/input hashes, immutable source/input copies, prompts, schedules, approvals, actual image/QEMU/dependency hashes and implementation amendments. Incident reproductions, reconciliation records and immediate host/worker Task IDs remain in the original/first-continuation incident directories. Final `post-run-policy-audit.json`, `answer-artifact-consistency-audit.json` and `continuation-2-terminal-link.json` link verified completion without modifying earlier records. The separate initial offline preparation failure and both pilot campaigns also remain intact.

**Execution is finished. No further benchmark calls, continuations, attempts, top-ups or replacement answers are scheduled.** Remaining work is independent human judging, cached citation verification, adjudication and the resulting offline quality report. The dataset/reference answers and all pilot artifacts remain unchanged.
