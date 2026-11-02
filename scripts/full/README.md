# First full-pass runner (96 scheduled executions, one attempt)

**Judging update (2026-11-02):** the approved [LLM-only amendment](LLM-JUDGING.md) and [append-only continuation](LLM-CONTINUATION.md) made 252 calls, including exactly two approved initial retries and 58 adjudications. [Automated results](../../evaluation/llm-quality-report.md) show no clear quality winner and explicitly disclose a [post-hoc identical-duplicate exception](LLM-OFFLINE-NORMALIZATION.md), strict score bounds and unverified citations. Strict review remains incomplete for one final answer. The human-only scorer and benchmark outcomes remain intact; no more calls are scheduled.

**Current status: execution finished.** All 96 scheduled entries were attempted once: **90 completed, 6 preserved failed/zero, 0 unrun**. The final [88-entry continuation](SECOND-CONTINUATION.md) completed 88/88. All three claims are consumed and all runners stopped; the commands below are implementation documentation, not authorization to replay any campaign. See the [final operational report](../../evaluation/full-run-report.md). Both independently ordered 96-answer judge packet sets were prepared and the approved automated judging has completed. Strict review remains incomplete for one answer; independent human validation and live-citation verification have not occurred. No extra attempts, replacements or further benchmark calls are scheduled.

**Initial-launch history:** separate uncapped first-pass spending was approved, but the initial controller launch paused during its first isolation setup check, before any contestant/provider call. One setup failure and 95 unrun entries remain preserved; see [`../../evaluation/full-run-report.md`](../../evaluation/full-run-report.md). The full-pass claim is consumed: do not replay this runner. The user has now explicitly approved the separately frozen [append-only continuation of the 95 unrun entries](CONTINUATION.md), keeping the first failure and original records unchanged. This is a separate controller/worker, not an override of the consumed pilot guard. Pilot code/config/artifacts remain intact. Settings: `evaluation/full-config.json`; API review: [API-CONTRACT.md](API-CONTRACT.md); two-human judging: [JUDGING.md](JUDGING.md).

## Offline preparation

Reuse the pinned dependencies installed under `scripts/pilot/node_modules` (`npm ci --ignore-scripts` in that directory if absent); do not upgrade during a campaign. Requires the pilot's pinned Gondolin image/QEMU runtime. Never run `npm run pilot`.

```sh
node --test scripts/pilot/core.test.mjs scripts/full/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/full -v
python3 scripts/compile_dataset.py --validate-only
PYTHONDONTWRITEBYTECODE=1 python3 scripts/test_compile_dataset.py -v

# New private directory outside repository; parent must be 0700.
node scripts/full/host.mjs --prepare /private/new-first-pass-freeze
node scripts/full/host.mjs --verify /private/new-first-pass-freeze
```

`--prepare` checks the dataset/tests, builds the bundle **outside the repository**, resolves safe local model metadata without credential refresh, boots a fresh **provider-denied** preflight VM, hashes actual image assets/QEMU tree/dependencies, generates the complete paired schedule and freezes byte-for-byte code/input copies, prompts, model, runtime, references and hashes. It performs no model/retrieval calls and reads no provider credentials. A failed preparation stays preserved; do not erase/reuse it.

The controller API-reference archive is required under `~/random/docs-check-preflight/api-references-20261101/` (`DOCS_CHECK_API_REFERENCES` may select another copy with `archive-index.json`). It contains seven direct official Parallel documentation bodies, the documentation index, and pinned Context7 package/API source. These controller-only files are copied/hash-checked in the private freeze, never exported to contestants. See API review for the public `core-fast` pricing omission and cancellation/idempotency limits.

Seeded schedule: shuffle all 48 question IDs, keep each workflow pair adjacent, independently shuffle exactly 24 Parallel-first and 24 Context7-first slots, repeat=1 throughout. Frozen seeds control independent judge presentation and the 10,000 paired family-stratified bootstrap draws. No second pass is scheduled.

## Paid launch: explicit separate authorization required

Preparation is **not** spending permission. Ask the user for a currency cap or explicit uncapped approval for this pass, including planning/answer calls and retries/late charges. The pilot waiver cannot be reused. Because actual charges/exposure bounds are unavailable, **capped launch currently fails closed**; implement validated accounting/reservations before using a cap. Do not infer pricing for `core-fast` from `core`, and never top up automatically.

Only after explicit uncapped full-pass approval, create a private approval JSON outside the repository, bound to the exact `freeze.sha256`, with this contract (not an approval by itself):

```text
phase: "full-first-pass"
manifest_sha256: exact frozen manifest SHA-256
executions: 96
attempts: 1
extra_executions_approved: false
automatic_topups: false
approved: true
approved_by: named authorizer
user_authorization: verbatim full-pass spending approval, not the pilot waiver
spending: {policy: "uncapped-explicitly-approved", cap: null}
```

```sh
# PAID: do not invoke without the above user approval.
node scripts/full/host.mjs --run /private/frozen-campaign --approval /private/full-approval.json
```

Launch rejects altered code/config/inputs/schedule/bundle/model/references/image assets/dependencies/runtime, absent approval, existing executions, and an already-consumed global first-pass claim. It creates `~/random/docs-check-runs/docs-check-full-first-pass-consumed.json` exclusively before the first contestant call. Never delete that claim or choose another campaign/root to replay a crash. Real credentials are resolved on the host only after the spending gate, substituted into approved outbound headers, never mounted/exported/logged. No inherited agent-session context or model tools. Every row gets a fresh Gondolin VM, no repository/home/results mounts, and a fresh API context/memory scope. Concurrency=1.

## Failures and stop behavior

Raw sanitized events/audits stream append-only to private artifacts; host Task IDs persist before worker delivery. Transient safe GET/model operations may retry once within original deadlines. Task POST never retries. No schema repair, quality retry, API/model fallback, smoke test, or replacement execution. Empty successful evidence still reaches a separate model call with an explicit empty marker. Failed retrieval/answering gets zero primary score even if partial evidence/text survives.

Ordinary terminal failures remain official and scheduling continues. Authentication/exhausted quota/sustained service error, leakage/audit anomaly, setup/host failure or VM-close failure pauses before any next invocation; remaining rows get `not_run` records. Canary checks run on outbound bodies and incoming worker stdout/stderr before the next execution, plus a final artifact scan. A timeout does not establish provider cancellation. Outstanding/ambiguous tasks and potential charges remain recorded; late reconciliation is a separate append-only diagnostic, never a replacement success.

**No automatic resume is implemented.** The specifically approved initial-incident remainder has a manual, one-shot continuation CLI documented in [CONTINUATION.md](CONTINUATION.md), with an independent freeze, exact unrun-only schedule, claim and append-only report view. This does not authorize any subsequent continuation or repeated attempt. A systemic incident requires review and renewed approval for continuation, with a separately tested append-only continuation mechanism; do not rerun this CLI or delete outcomes/claim. The default implementation is deliberately fail-closed. Interrupted campaigns with missing terminal records require host reconciliation before scoring; do not fabricate completed executions. `not_run` rows remain visibly unexecuted, not 96 claimed starts. This is a remaining operational limitation, not authority for extra attempts.

The pass stops after its schedule. Scoring is offline, requires two independent human reviewers for every answer plus human adjudications/cache verification, and never sends results into contestants. `scoring.py` refuses missing judgments, disputes, altered artifacts and citation-cache gaps; results/report destinations are new, never overwritten. Report single-attempt uncertainty, nonpilot sensitivity, failures, unavailable costs and provenance drift separately. Do not change references according to workflow performance.

## Artifact layout

Private campaign: `manifest.json`, `freeze.sha256`, `schedule.jsonl`, `frozen/`, `references/`, `offline-checks.json`, `isolation-preflight.json`, `model.json`, generated `worker.bundle.mjs`; after approved launch, `launch.json`, `executions/<id>/{public-request,isolation,evidence,answer,outcome}.json`, append-only `events.jsonl` and `raw/` audits/worker output, immediate Task records, `leakage-audit.json`, `campaign-terminal.json`. Judging/reporting adds its sealed map, independent packets/judgments, cache index/bodies, adjudications, results and report. Missing answer/evidence on failed paths is explicit through outcomes, not fabricated empty success. All raw runs, bundles, dependencies, approval files and credentials stay out of Git.
