# Incident-approved append-only LLM judging continuation

**Execution update:** all 157 new initial calls and all 58 planned adjudications were attempted. Both specifically approved retries succeeded. The strict continuation stopped on an exactly identical duplicate criterion in the last adjudication; no other retry occurred. [Automated results](../../evaluation/llm-quality-report.md) use a separately labeled [post-hoc offline duplicate-only exception](LLM-OFFLINE-NORMALIZATION.md), preserve the strict incomplete status and show unresolved-score bounds. No more calls are scheduled. The methodology below is the unchanged paid continuation freeze; its saved copy predates this status update.

The user answered **“yes, go ahead”** to the explicit scope: 155 unattempted initial judgments, one retry for each of `judge-1-A0028` and `judge-1-A0063`, and up to 96 adjudications, preserving every original attempt. Earlier explicit uncapped judging authorization still applies to this bounded continuation. No benchmark reruns, arbitrary additional retries, paid smoke calls, model fallback, or recursive adjudication are authorized.

## Preservation and scope

- Keep the original paused judging directory, its consumed claim, all 37 calls (35 valid and two failed), all raw output, manifests, approvals and logs byte-identical. Verify their complete recursive file-hash map before preparation, launch and reporting. Verify original frozen code against its own saved copies, not against later working-tree additions.
- Create a separate private sibling continuation, new freeze/claim/approval, source/packet copies, implementation archive and per-call records. Bind the original manifest hash and full original artifact hashes. Never write into the original directory or delete claims.
- Schedule exactly **157 new initial calls**: the two specifically approved retry attempts, then 155 previously unattempted slots in their original per-judge order. Never replace a valid original judgment. The combined initial history has 194 calls for 192 initial slots, with exactly two attempt-2 calls. Retried calls are new assessments, not selected best answers; original failures remain in accounting and provenance.
- Same approved model/reasoning, criterion schema, frozen reference, question/answer/evidence bytes, deadlines, output cap, no-tools/no-history boundary, `store: false`, no cache affinity and zero SDK retries. Reduce concurrency from four to **two** to limit in-flight exposure. Append short-literal-quotation guidance to the original prompts; do not alter grading semantics or repair any returned quote/score. The continuation freeze archives the effective prompts and discloses this operational amendment.

## Ordinary missing judgments and adjudication

An ordinary content/schema or isolated transport failure is preserved, not silently repaired, retried or scored as a contestant zero. Continue the other separately authorized initial slots. Before their execution, predeclare that an unavailable valid initial assessment is unresolved review and triggers the **single already-authorized adjudication** for that answer, in addition to the original disagreement/high-severity/version/reference-concern triggers. There are never more than 96 adjudications.

The adjudicator receives only the original blind packet and anonymously ordered prior valid assessments; an unavailable assessment is explicit `null`, with no workflow, operational failure reason or timing. It produces a complete new assessment, not a fabricated initial judgment. A valid adjudication resolves the final score even when one initial assessment is missing; disclose that initial double-review coverage is incomplete. Initial agreement uses only available valid pairs, with both the criterion denominator and missing-pair count reported. Never impute zero, agreement, a human review, or a second model opinion. Preserve every prior assessment, including failed raw outputs. A failed adjudication blocks a complete report and is not retried.

Authentication/quota, outbound audit anomalies, three consecutive failures, or a requested stop halt new dispatch and drain active calls. Pause on any adjudication failure. No automatic resume. This handling avoids repeatedly pausing on an isolated invalid quotation without buying an unapproved repair call; it does not hide missing review or change contestant scores.

## Reporting

The original human-only scorer stays unchanged. The additive LLM reporter accepts an explicit continuation manifest, recursively verifies the original and continuation, validates every selected judgment against raw output/payload and quote/schema checks, confirms exactly 157 new initial calls and the predeclared adjudication set, and counts **all** original and continuation calls/usage. Interrupted SDK zero defaults are marked unknown provider consumption. Actual charges remain unknown, never zero or catalog estimates masquerading as bills.

The primary keeps all six original **benchmark** failed zeros. Judge failures add no contestant zeros or exclusions. Required nonpilot and predeclared infrastructure-excluded diagnostics, question-paired family bootstrap and independent citation/human-review limitations are unchanged. Final results remain **LLM-only, not human-validated**. Preserve pending or disputed reference concerns; no reference edits or asymmetric rescoring.

```sh
# Offline; output new, private and outside Git.
node --test scripts/full/llm-judge.test.mjs scripts/full/llm-continuation.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/full -v
node scripts/full/llm-continuation.mjs --prepare /private/original-paused-judging --out /private/NEW-continuation
node scripts/full/llm-continuation.mjs --verify /private/NEW-continuation

# PAID: new freeze-bound incident approval required; not an authorization example.
node scripts/full/llm-continuation.mjs --run /private/NEW-continuation --approval /private/incident-approval.json

# Offline; original and continuation both retained and verified.
PYTHONDONTWRITEBYTECODE=1 python3 scripts/full/llm_report.py report /private/NEW-continuation --out /private/NEW-quality-report
```

The approval binds `phase: full-first-pass-llm-judging-continuation-v1`, the new and original manifest SHA-256, named user, verbatim approval, 157 new initial calls / 155 unattempted calls, the exact two retry IDs, 96 maximum adjudications, zero other retries, no benchmark reruns/top-ups, and the explicitly uncapped policy. All claims remain exclusive and consumed after launch, even on failure. No later continuation is preauthorized.
