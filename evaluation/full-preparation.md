# First-pass preparation — pre-authorization record

Historical state at the offline freeze. Subsequently the user approved uncapped first-pass spending and the controller paused on its first setup check; current status is in [`full-run-report.md`](full-run-report.md). The original version of this preparation record remains in the immutable frozen copies.

Prepared on 2026-11-01 UTC. **Full-run spending remains unauthorized. The first full pass has not started.** The pilot authorization is still consumed; its files and both retained campaigns are unchanged. Dataset prompts/references are unchanged.

## Implementation

- Dedicated `scripts/full/` controller/worker and `evaluation/full-config.json`: 48 × 2 × 1, exactly 96 planned entries, balanced paired order, one VM and independent model context per execution.
- Direct Parallel Task API, `core-fast`, unchanged explicit findings schema; Context7 library resolution followed by documentation queries. Same `openai-codex/gpt-6.1-terra`, medium reasoning; no contestant tools, session context, mounts or alternate APIs.
- Host credential injection/auditing, zstd audit support, immediate host/worker Task-ID persistence, append-only raw logs, deadlines, bounded transient retries, no Task resubmission, block-aware proxy-token evidence normalization.
- Failures remain official, zero-scored; no answer-quality retry/replacement. Systemic incidents/leakage pause before another invocation. Late results/charges are diagnostics, never replacement successes.
- Offline scoring exports independently ordered provider-label-blinded packets, checks two distinct human reviewers and cached source verification, requires human adjudications, preserves extra-claim/version uncertainty, and reports weighted family macros, paired differences/bootstrap, nonpilot sensitivity and missing costs. Honest canary/unpinned provenance disclosure is not itself a false claim.
- Freeze copies code/inputs/prompts and archives exact hashes, Git revision plus uncommitted file hashes, schedule, model, dependencies, actual image assets and QEMU runtime tree. Launch additionally freezes the separately authorized spending policy and effective configuration hash before paid calls.

## Offline validation

The final preparer reruns and archives all checks: 39 full-run Node fixture tests, 14 scoring tests, 8 unchanged pilot tests, and 11 dataset tests (**72 total**), plus dataset validation and a fresh provider-denied Gondolin preflight. These fixture calls use fake/local transports, never benchmark providers. Controller API-documentation HTTP downloads were free direct requests, not contestant retrieval or model calls.

Prepared corrected freeze target: `~/random/docs-check-runs/2026-11-01-first-pass-freeze-v2/`. The external `manifest.json`/`freeze.sha256` are authoritative for exact hashes and check output; no manifest digest is embedded here to avoid self-referential input hashes. No `launch.json`, paid execution artifacts or consumed full-pass claim should exist until separate approval. See [`../scripts/full/README.md`](../scripts/full/README.md) for verification/launch gates, [`../scripts/full/API-CONTRACT.md`](../scripts/full/API-CONTRACT.md) for archived API findings, and [`../scripts/full/JUDGING.md`](../scripts/full/JUDGING.md) for reviewer contracts.

### Preserved offline preparation failure

The initial preparation at `~/random/docs-check-runs/2026-11-01-first-pass-freeze/` passed its test checks, then stopped while hashing an extracted Debian documentation symlink whose target is absent. No VM/contestant execution, credentials, or provider calls were involved. The partial directory and `preparation-error.json` remain intact. Tree hashing now records dangling symlink target text/state (and still hashes actual runtime files); a new regression test covers link/file drift and private-permission checks. The corrected preparation is separate, not an overwrite or execution retry.

## Remaining gates and limits

1. Obtain a currency cap or explicit uncapped approval for this single full pass. **Capped launch is currently blocked** because actual charge accounting and conservative outstanding-exposure bounds are unavailable; a cap requires implementing/testing those controls first. No top-ups or extra attempts.
2. Review/accept the frozen settings and limitations; bind any uncapped approval to the manifest digest. Public docs omit `core-fast` from current processor/pricing tables despite its pilot success; do not silently substitute `core` or infer its price.
3. Execute at most the scheduled pass, then stop. Two human judges and cached citation verification are still required before a scored report can be produced; the software cannot replace their substantive review.
4. No automated resume/late reconciliation is implemented. If a systemic incident pauses execution, retain all records and obtain incident approval for a tested append-only continuation; never rerun the campaign, erase its claim or replace failures. A process crash may require terminal-record reconciliation before scoring. Interim reports explicitly distinguish scheduled rows from executed starts and include `not_run` rows as zero without claiming completion.

**There are no full-run findings, scores, charges, or winner claims to report.** This document records preparation, not execution results or spending permission.
