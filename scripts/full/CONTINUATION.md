# Approved incident continuation: 95 unrun entries only

**Historical first-continuation record.** The later, separately approved 88-entry continuation has now completed 88/88. The final pass is 90 completed answers, 6 preserved failed/zero and 0 unrun, with human grading pending. All claims remain consumed; nothing below authorizes another launch. See the [final report](../../evaluation/full-run-report.md).

**This continuation has been launched once and paused; its claim is consumed. Do not replay it.** It produced two completed answers, four Context7 transport failures and one interrupted Parallel failure; 88 entries remained unstarted. Combined with the original setup failure, the current view has 2 completed, 6 failed/zero and 88 unrun entries. See the [current partial report](../../evaluation/full-run-report.md). The preparation/launch commands below are historical implementation documentation, not authorization for another invocation.

The user answered **yes** to: “Approve a fixed, append-only continuation of the remaining 95, under the same uncapped terms, leaving the failed entry untouched?” This is authorization for that remainder of the same first pass, not a new 96-entry pass or a retry of `takumi-05-parallel-1`.

Original campaign: `~/random/docs-check-runs/2026-11-01-first-pass-freeze-v2/`. Its consumed first-pass claim, initial launch, frozen sources and all outcomes remain unchanged. The first setup failure stays failed/zero. See [`../../evaluation/full-run-report.md`](../../evaluation/full-run-report.md) for the incident and offline reproduction.

## Corrective implementation

`buildProductionHooks` is shared by actual executions and offline preflight. During preflight only, the two exact forbidden GET probes receive a local HTTP 403 denial, never forwarding. Unexpected requests, forbidden requests after entering the worker stage, model/schema/context anomalies and canary leakage latch an audit failure that blocks subsequent requests and pauses execution. A failed isolation check now preserves stdout/stderr/checked paths. Real Gondolin integration tests exercise both workflows with **fake credentials and no contestant worker/provider requests**, including fresh filesystems, cross-VM markers and stage transitions. No contestant prompt, model, evidence normalization, transport, budget or Task schema changed.

## Offline freeze and one-shot launch

```sh
# Offline: tests, actual-production-hook preflight, freeze new implementation.
node scripts/full/continuation.mjs --prepare \
  /private/original-campaign /private/new-continuation-directory
node scripts/full/continuation.mjs --verify /private/new-continuation-directory
```

The preparer verifies the original consumed claim/approval, all original frozen bytes, model/bundle, references, schedule and outcome identities. Exactly 95 rows must be genuinely `not_run`, with no attempt artifacts. The initial failed/setup row is not selectable. Current contestant code, dataset/reference, Task spec, planner/answering prompts, common model/settings, dependencies, actual VM assets and QEMU runtime must match the original freeze. Only the explicitly recorded host integration, tests, append-only continuation/reporting and status documentation are amended. The existing worker bundle is copied **byte-for-byte**, not rebuilt. The continuation manifest records original outcome hashes and implementation amendments, and freezes its own source copies, checks, corrected preflight and schedule. Original row order is retained; no extra attempts are scheduled.

Record the user's incident approval outside the repository, bound to the continuation `freeze.sha256`, with:

```text
phase: "full-first-pass-continuation"
manifest_sha256: exact continuation manifest digest
original_manifest_sha256: exact original manifest digest
executions: 95
attempts: 1
approved: true
approved_by: current user
user_authorization: verbatim "yes", with the exact confirmation question recorded
preserve_failed_entries: true
extra_executions_approved: false
automatic_topups: false
spending: {policy: "uncapped-explicitly-approved", cap: null, automatic_topups: false}
```

```sh
# PAID: only the approved remainder, once; never replay the original runner.
node scripts/full/continuation.mjs --run /private/frozen-continuation \
  --approval /private/continuation-approval.json
```

Launch verifies the new freeze and unchanged originals again, resolves credentials only after approval, and exclusively creates `continuation-1-consumed.json` under the original campaign before any workflow. The original global claim is required and never removed. Its 95 outcomes/logs go in the continuation directory; original `not_run` placeholders are preserved. Effective execution configuration hashes remain identical because answering/retrieval settings and uncapped policy did not change. A terminal link is appended under the original root. A further systemic incident pauses; this mechanism does not authorize another continuation or repeat.

## Append-only report view

After the continuation reaches `campaign-terminal.json`:

```sh
python3 scripts/full/assemble.py /private/original /private/continuation /private/new-report-view
python3 scripts/full/scoring.py prepare /private/new-report-view --out /private/new-report-view/judging
# Two independent human reviews, independent source caches, and adjudications.
python3 scripts/full/scoring.py report /private/new-report-view \
  --judging /private/new-report-view/judging --out /private/new-scored-report
```

Assembly verifies both archives/claims/launches, the exact ordered unrun subset, selected outcome identities and file hashes. It writes a new view, never modifying either source. The original failure is copied unchanged; continued rows have explicit amendment links to original unrun-record hashes. Raw logs remain in their controller-only source campaigns; provenance tracks their roots and the independently frozen implementation. Scoring checks provenance/source/copied bytes at preparation and reporting, keeps it outside judge packets, and discloses the setup incident and interrupted pair/window. Any remaining `not_run` row makes the view explicitly incomplete. No scores are invented in the absence of the frozen two-human judging process.

Operational interpretation: the initial setup failure is a runner failure, **not provider reliability evidence**. The frozen primary includes its zero; no workflow-favoring reference edits, silent replacements or selective dropping. The campaign no longer fits an uninterrupted short window; report that deviation and implementation change. No claim of 96 completed provider calls, actual-cost availability or within-question variability is justified by these artifacts.
