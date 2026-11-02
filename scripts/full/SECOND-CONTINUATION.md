# Approved second incident continuation — 88 untouched entries only

**Execution finished: 88/88 completed; claim consumed. Do not invoke this runner again.** The final verified view has 90 completed answers, 6 preserved failed/zero entries and 0 unrun entries across the full 96-entry pass. Operational reporting and both independent 96-answer judge packet sets are ready; human quality grading is pending. See the [final report](../../evaluation/full-run-report.md). The commands and base-state descriptions below document the pre-run implementation, not permission for another launch.

The user answered **“yes, approved”** to correcting the parser/pause controls and continuing **only the remaining 88**, uncapped, retaining all six failures. This does not authorize another pass, repeating any of the eight prior attempts, replacing failed answers, changing references, or topping up accounts.

Base: `~/random/docs-check-runs/2026-11-01-first-pass-view-1/`, a validated append-only view of the original launch and first continuation. It has **2 completed, 6 failed/zero and 88 unrun** entries. Both original consumed claims, all old logs/outcomes and the interrupted Task's potential late charge remain preserved. The 88 entries are the exact original schedule tail, 44 per workflow, keeping 22 first slots each. Initial workflow configuration/model/budgets and public prompts remain unchanged.

## Approved corrections

- Only the exact HTTPS Context7 documentation GET endpoint may preserve native plaintext as `unparsed_text`, matching the pilot's existing behavior. Task and library-resolution JSON stay strict. Malformed declared JSON and HTML error/login pages are not passed off as documentation. Complete raw response text and content type are logged.
- The empty native-text wrapper now receives the same explicit empty-evidence marker as other empty documentation results; no other normalization/ranking/budget change.
- Offline replays use the three preserved pilot plaintext responses and all four failed continuation responses, without rerunning providers or copying raw runs into Git. Fully bundled, fake-network Context7 and Parallel pipelines test separate tool-less answer calls. The new bundle is rebuilt and frozen because its transport changed.
- A host-only `pause-request.json` requests a graceful stop: the active execution finishes or reaches its **original** deadline, its VM closes, then remaining rows become `not_run` before another VM starts. Invalid/unreadable/symlink/special-file pause paths fail closed. Request/ack events are append-only. No pause changes a completed result, grants another attempt, or extends deadlines.

**Use the pause file, never `hc interrupt`/terminal Ctrl-C for a paid campaign.** Direct SIGINT/SIGTERM delivered only to the Node controller PID are handled as pause requests; terminal/process-group signals can also kill QEMU and are not equivalent. No future-output-marker wait is used to decide when to interrupt. Example, if an incident requires a pause:

```sh
# Create only a new host-side file in the ACTIVE continuation directory.
# Do not put secrets in this file. Do not delete it to replay a consumed run.
python3 - <<'PY'
import os, json
path = '/private/active-continuation/pause-request.json'
with os.fdopen(os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), 'w') as f:
    json.dump({'reason': 'operator-requested incident pause'}, f)
PY
```

Wait for normal `PAUSE_ACKNOWLEDGED`/campaign termination; inspect terminal records, not an assumed output ordering. An unexpected audit/leakage/auth/quota/sustained failure still blocks/pauses independently. No further continuation is preauthorized if this pass pauses again.

## Freeze and launch

```sh
# Offline only: verify all old sources and run tests/replays/production-hook preflight.
node scripts/full/remainder.mjs --prepare /private/first-partial-view /private/new-continuation-2
node scripts/full/remainder.mjs --verify /private/new-continuation-2
```

The preparer validates old source/copy/provenance hashes and raw execution logs; checks exactly two completions/six failures and 88 untouched rows; verifies original settings/model/dependencies/image/QEMU; and records precisely amended infrastructure files. Source hashes must remain unchanged through testing/build/preflight before freezing. Every new source/input, rebuilt bundle, incident report, check output, real VM preflight and schedule is archived/hash-bound before launch.

A separate private approval file binds the user's actual confirmation to the new manifest digest and base provenance digest:

```text
phase: "full-first-pass-continuation-2"
manifest_sha256: exact new freeze.sha256
base_provenance_sha256: SHA-256 of base view-provenance.json
executions: 88
attempts: 1
approved: true
approved_by: current user
user_authorization: "yes, approved", with the exact preceding question recorded
preserve_previous_entries: true
extra_executions_approved: false
automatic_topups: false
spending: {policy: "uncapped-explicitly-approved", cap: null, automatic_topups: false}
```

```sh
# PAID — only after that incident authorization is recorded.
node scripts/full/remainder.mjs --run /private/frozen-continuation-2 \
  --approval /private/continuation-2-approval.json
```

Launch revalidates everything and rejects any existing pause path before credential resolution/claim consumption. The exclusive `continuation-2-consumed.json` is appended under the original campaign, requiring both prior claims through the validated base. All outcomes go into the new root, never over the old eight attempts or old placeholders. Effective execution configuration hashes remain unchanged; the separately recorded implementation/bundle hashes disclose the correction. No rerun, fallback, schema repair or automatic resume is enabled.

## Verified report chain and review

```sh
python3 scripts/full/assemble_chain.py /private/first-partial-view /private/continuation-2 /private/new-view-2
python3 scripts/full/operations.py /private/new-view-2 --out /private/new-operations-2
python3 scripts/full/scoring.py prepare /private/new-view-2 --out /private/new-view-2/judging
```

The new view validates the entire prior chain, both old claims, all old bytes, the new freeze/claim/approval, and the exact 88-row subset. It copies prior eight outcomes unchanged, selects new outcomes only for previously unrun rows, and records amendment hashes. Operational reports retain audits from all three source roots. Source paths, implementation metadata, timings and costs remain controller-only, not judge packets.

Two independent human reviews, independent citation caches and human adjudications are still required before correctness/claim/evidence/version statistics and paired bootstrap can be reported. The frozen primary includes all failed zeros; infrastructure incidents, interrupted window, changed implementation and any missingness remain explicit. Before the 88 entries run, an additional diagnostic is predeclared: exclude the **paired questions** `nextjs-12`, `takumi-02`, `takumi-05`, `takumi-07` because their old outcomes contain the six diagnosed controller failures, leaving 44 pairs. This set is selected from failure provenance, not answer scores. After human review, its family-stratified paired bootstrap uses the same frozen seed; it never replaces the full 48-question primary or the nonpilot 46-question sensitivity. No intrinsic tool-quality winner follows from controller bugs, and no honest disclosure of unpinned/canary provenance is itself an incorrect claim. Pilot artifacts and dataset/reference answers stay unchanged.
