# Approved amendment: automated LLM judging

**Execution update:** the user subsequently approved the [incident continuation](LLM-CONTINUATION.md). All 252 bounded judging calls are finished. [Automated results](../../evaluation/llm-quality-report.md) are available with a separately disclosed [post-hoc exact-duplicate exception](LLM-OFFLINE-NORMALIZATION.md) and strict unresolved bounds. The strict review remains incomplete for one final answer; no human/citation audit or further paid call is claimed. The no-retry scope below describes the original judging freeze, not the two separately approved retry attempts.

The user selected LLM judging after benchmark execution and before quality grading, approving `gpt-6.1-terra` / medium reasoning, 192 initial judgments and up to 96 LLM adjudications, no retries or benchmark reruns. After clarification, the user explicitly approved **no spending cap**. This authorization is for judging only, not new contestant retrieval/answer attempts, replacement answers, top-ups or open-ended judging.

This is an **amended, LLM-only analysis**, not completion of the frozen two-human-reviewer protocol in [JUDGING.md](JUDGING.md). Neither machine outputs nor the controller are labeled human reviewers. Original manifests/configuration, reference key, failed zeros, human packets and sealed map remain intact. A new private sibling directory holds the judging freeze, separate authorization/claim, calls and report. Record the amendment before any judgment. Preserve incomplete/failed judging campaigns; no automatic resume, retry, repair, fallback, extra pass or choosing the best judgment.

## Frozen methodology

- Two separately ordered blinded passes, one fresh tool-free API context per answer per pass, using the already prepared 96-entry packet files byte-for-byte. Neither pass receives the other's output, the map, workflow labels, execution order, status, timings, charges or controller metadata. Empty/failed answers are included; the controller later preserves their zero primary score regardless of judgments.
- Both passes and the adjudicator use the approved **same** `gpt-6.1-terra` model family as the answerer, with medium reasoning. These are independent contexts, **not independent model families or independent error distributions**. Report correlated errors and potential self-preference bias. The registry entry is frozen; immutable provider weights/snapshot are not independently established.
- Scores remain 0/0.5/1, criterion-weighted, question-normalized, family-macro averaged. Exact answer quotations or omissions and reference evidence IDs are mandatory. Contradictions negate criteria; accept equivalent implementations. Honest unpinned/canary disclosures are not substantive errors by themselves. Do not edit the key after judging.
- Retained support is labeled `consistent_with_reference`, `absent` or `unknown`. Consistency is an LLM assessment against the supplied frozen official excerpts, **not independently verified live retrieval quality**. Consistency requires an exact retained quote.
- Extra-claim correct/incorrect verdicts require quoted support/contradiction from the supplied reference evidence. Otherwise mark unverifiable, not incorrect. Do not treat absence from the key as falsehood. No runtime execution is claimed.
- Citation page authenticity, availability and live claim support are **not independently verified** by this tool-free pass. Citation precision and independently verified support remain unavailable, not zero/perfect. The original full citation/human audit remains outstanding; reports must say so. Frozen reference source hashes and excerpts are checked offline before launch/reporting.
- Predeclared LLM adjudication: any difference in criterion scores or retained-support categories, version status/compliance, or material extra-claim quote/verdict/severity; also any major/critical flag, drift/version dispute or reference concern. Rationale-only differences do not trigger adjudication. One complete fresh LLM judgment replaces neither original: it becomes the selected assessment, with both originals preserved. Prior assessments are anonymously ordered deterministically; no other candidate is shown. There are at most 96 adjudications, with no recursive loop or human validation claim.
- Four concurrent calls maximum; 180-second request deadline; no SDK/transport retries; SSE only, no tools/history/cache affinity, `store: false`; 10,000 output proxy-token cap using pinned `js-tiktoken@1.0.21/o200k_base`. Failure pauses new dispatch, drains in-flight calls, preserves all artifacts and blocks a complete report. Signals similarly drain; do not kill unrelated terminals.
- Report primary all-48-pair scores including six infrastructure failed zeros, required nonpilot 46-pair sensitivity, predeclared paired infrastructure exclusion diagnostic (44 pairs), family/difficulty/category breakdowns and question differences. Use frozen family-stratified 10,000-draw question bootstrap seed 9102026. This interval does not measure judge-model uncertainty or within-question run-to-run variability. No composite winner.
- Log all requests, actual payloads, raw results, validated judgments, identity/type, timing, token usage, status and preserved errors privately. Secrets remain on host and are scrubbed from artifacts; model payloads have no filesystem/tools. Usage catalog estimates are not actual bills. Judging costs/usage stay separate from workflow costs/usage; unknown charges are not zero.

## Tools

The original `scoring.py` human-only validation/reporting remains unchanged. This additive path consists of `llm-judge-core.mjs`, `llm-judge.mjs` and `llm_report.py`. Preparation and reporting validate the original source chain, sealed packet hashes, every selected outcome/answer/evidence, source scope and reference excerpts. New freeze hashes code, model, packet files, prompts, source fingerprints and pinned dependencies. An exclusive claim outside the repository prevents replay. Existing output paths are never overwritten.

```sh
# Offline; all destinations new and outside the repository, with private parent.
node --test scripts/full/llm-judge.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/full -v
node scripts/full/llm-judge.mjs --prepare /private/final-view --out /private/new-llm-judging
node scripts/full/llm-judge.mjs --verify /private/new-llm-judging

# PAID: exact freeze-bound approval required, never reuse benchmark approvals.
node scripts/full/llm-judge.mjs --run /private/new-llm-judging --approval /private/judging-approval.json

# Offline after all judgments/adjudications complete; a new report destination.
PYTHONDONTWRITEBYTECODE=1 python3 scripts/full/llm_report.py report /private/new-llm-judging --out /private/new-quality-report
```

Approval JSON binds `phase: full-first-pass-llm-judging-v1`, exact `manifest_sha256`, `approved: true`, `approved_by: user`, verbatim `user_authorization`, `initial_calls: 192`, `max_adjudications: 96`, `retries: 0`, `benchmark_reruns: false`, `automatic_topups: false`, and `spending: {policy: uncapped-explicitly-approved, cap: null}`. This document is not by itself spending authorization. The recorded user approval is retained privately and bound after preparation.
