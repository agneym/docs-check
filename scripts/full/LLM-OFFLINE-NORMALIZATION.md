# Post-hoc offline validation exception — exact duplicate criterion objects

**This is a controller-authored post-hoc exception, not a predeclared or explicitly user-approved grading rule.** It makes no paid calls, changes no criterion scores or quotations, and does not claim completion of the strict frozen judging protocol. The strict campaign remains paused/incomplete. A separately labeled normalized analysis and strict unresolved-score endpoints are provided instead of fabricating a valid strict judgment or concealing the incident.

## Observed stop

The approved continuation attempted all 157 scheduled initial calls and all 58 planned adjudications. Exactly two initial retries were made as approved. Five new invalid initial opinions were preserved and routed to the single allowed adjudication per answer. The last adjudication (`A0065`) returned three criterion objects for a two-criterion rubric: `c1`, `c2`, and a second **deeply identical** `c1`. The strict validator correctly rejected the list. All other final adjudications validated. No further call or retry was made.

## Mechanical exception

For every final adjudicator output, symmetrically and without regard to provider or score:

1. Group criterion objects by ID, preserving their first occurrence and original order.
2. Remove a later occurrence **only if its entire JSON object is deeply identical** to the first (key order is immaterial). Scores, quotations, rationale, references and all other fields must agree exactly.
3. Conflicting duplicates, unknown criteria, missing criteria, nonliteral quotations, invalid scores and all other defects remain invalid under the unchanged validator. Do not remove an unknown criterion or choose between different opinions.
4. Validate the resulting complete judgment with the original strict schema/quote validator. Preserve the original raw result, failed outcome and entire paid-run directory byte-for-byte. Write the normalization record and normalized view only into a new offline report directory, with raw-result and implementation hashes.

This rule removes one redundant object from one final judgment. It does not turn a contradictory or missing assessment into a valid score, modify extra claims/version assessment, normalize quotation text, use model memory, or repair the originally failed initial `A0065` output (which contained an extra nonidentical `c3` and remains invalid).

## Required disclosure and sensitivity

- Report **strict review incomplete** and **post-hoc duplicate-normalized analysis** separately. Do not label this a successful strict run, human review, or previously authorized exception.
- Show strict primary score endpoints with the unresolved final answer set to 0 and 1, preserving all other selected scores and the six original benchmark failed zeros. These are bounds, not invented judgments. Also show a separately labeled post-hoc diagnostic excluding the affected question pair from both workflows.
- Preserve the original all-48-question normalized analysis, required 46-question nonpilot sensitivity and predeclared 44-pair infrastructure diagnostic. Never silently replace the primary with a favorable subset or amend the reference key.
- Include all 252 actual judge calls (194 initial attempts, including exactly two approved retries, plus 58 adjudications) and all eight preserved failed call records. One failed adjudication is accepted only by this disclosed structural exception. Usage/accounting includes failures; interrupted-call consumption remains unknown. No extra paid calls are authorized or made.
- Report available initial-pair agreement only: 91 valid pairs, five missing valid pairs; do not fabricate missing initial judgments or add contestant zeros. All 96 final answer scores are available only in the explicitly normalized view; 95 strictly validated final judgments remain available under the original schema.

`llm-offline-finalize.mjs` verifies the frozen original/continuation, complete preserved original hashes, every paid-run implementation's original hash, input packets, source chain, exact schedules, requests/payloads, raw outputs, call identities/counts and all selected assessments. Additional offline files do not masquerade as the code used during paid execution. `llm-finalize-report.py` emits the separate analysis, strict bounds, validation records and implementation hashes. Original `scoring.py` and the strict judging/reporting implementations remain unchanged by this exception.
