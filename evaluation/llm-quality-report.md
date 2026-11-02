# LLM-judged comparison — no clear quality winner

**Automated, not human-validated. This is an explicitly post-hoc exact-duplicate-normalized analysis; the strict frozen review remains incomplete for one answer.** The user-approved judging calls are finished. No further calls or benchmark reruns are scheduled.

## Results

| Metric | Parallel direct Task API | Context7 |
|---|---:|---:|
| Family-macro rubric correctness, all 48 questions | **93.02%** | **88.63%** |
| Rubric-perfect answers | 39/48 (81.25%) | 39/48 (81.25%) |
| Benchmark answers completed | 46/48 | 44/48 |
| Preserved benchmark failed zeros | 2 | 4 |
| Completed-only question-mean correctness (diagnostic) | 97.07% | 96.69% |
| Completed-only workflow median / p95 | 56.3s / 78.4s | 22.2s / 29.7s |

The normalized paired Parallel − Context7 correctness difference is **+4.39 percentage points**, with a family-stratified question-bootstrap **95% interval of −1.49 to +11.65 points**. This includes zero: **no clear quality winner on this selected set**. It does not establish equivalence.

The primary keeps all six original controller/infrastructure failures as zeros, as frozen. They are **not intrinsic provider-quality or reliability failures**. In the predeclared diagnostic excluding both workflows for the four infrastructure-affected questions, correctness is **97.02% vs 96.73%** (44 pairs), difference **+0.29 points**, 95% interval **−3.21 to +4.37**. The large primary gap is not evidence of a comparably large provider-quality advantage.

Context7's observed completed-only workflow median was approximately **2.54× faster** in this campaign. Timing, interrupted windows, setup overhead, upstream-synthesis asymmetry and unavailable actual charges remain qualified in [the operational report](full-run-report.md). Do not combine timing and correctness into an arbitrary winner score.

## Family breakdown (includes benchmark failed zeros)

| Family | Parallel | Context7 |
|---|---:|---:|
| React | 92.22% | 92.01% |
| Next.js | 97.92% | 91.67% |
| TanStack | 100.00% | 98.61% |
| Takumi | 81.94% | 72.22% |

Families contain 12 selected questions each, not representative random samples of all coding tasks. Much of the Next.js/Takumi deficit includes the diagnosed benchmark controller failures.

## Sensitivities

- **Nonpilot, 46 pairs:** Parallel 93.54%, Context7 88.41%; difference **+5.13 points**, 95% interval **−0.71 to +12.39**.
- **Predeclared infrastructure-excluded diagnostic, 44 pairs:** Parallel 97.02%, Context7 96.73%; difference **+0.29 points**, interval **−3.21 to +4.37**. Diagnostic only; never replaces the primary.
- **Post-hoc exclusion of the structurally unresolved question pair, 47 pairs:** Parallel 92.84%, Context7 88.45%; difference **+4.40 points**, interval **−1.58 to +11.57**. This is a separately labeled validation sensitivity, not a new primary.

Bootstrap: 10,000 paired-question draws stratified by family, frozen seed **9102026**, linear-interpolated percentiles. These intervals describe selected-question variation, **not judge-model uncertainty or within-question run-to-run variation**.

## Exact-duplicate exception and strict unresolved bounds

The final adjudicator for anonymous answer `A0065` (`react-01`, Context7) emitted `c1`, `c2`, and a second **deeply identical** `c1` object. The strict validator correctly rejected it. The paid continuation remains recorded as **paused**, with 95 strictly validated final answer judgments and this one unresolved under the original schema.

A separate [post-hoc offline validation exception](../scripts/full/LLM-OFFLINE-NORMALIZATION.md) removed only that redundant object. No score, quote, reference, rationale, version or extra claim changed. No additional model call occurred. The rule checks every final adjudication symmetrically; conflicting duplicates, missing/unknown criteria and all other defects remain invalid. The original raw output and failed outcome remain byte-identical. This was a disclosed controller-authored exception, **not a predeclared or explicitly user-approved grading rule**.

Without accepting that exception, the unresolved Context7 answer's score is bounded from 0 to 1, rather than fabricated:

| Strict unresolved answer score | Parallel macro | Context7 macro | Paired difference | 95% interval |
|---|---:|---:|---:|---:|
| 0 (lower endpoint, not an assigned judgment) | 93.02% | 86.55% | +6.48 points | −0.47 to +14.81 |
| 1 (upper endpoint; equals normalized result) | 93.02% | 88.63% | +4.39 points | −1.49 to +11.65 |

Both endpoint intervals include zero. The strict review is **still incomplete**, but the no-clear-winner interpretation does not depend on accepting the duplicate-normalized score.

## Judging coverage, failures and accounting

The approved model was **`gpt-6.1-terra`, medium reasoning**, for both fresh-context passes and adjudication. No tools, browsing, conversation history, provider labels, timings, costs or sealed map entered judge requests. The answering model was from the same family; independent contexts do **not** imply independent errors or remove self-preference bias. URLs/wording can reveal provenance.

- **252 total judging calls:** 194 initial attempts for 192 slots (exactly the two approved retries) plus **58 adjudications**. No other retries or benchmark reruns.
- The first launch's **37 attempts remain unchanged**. Both specifically approved retries succeeded. The append-only continuation made exactly **157 new initial calls** plus 58 adjudications.
- **Eight failed call records remain preserved:** two from the original launch, five invalid initial judgments in the continuation, and the final duplicate-object adjudication. The last is accepted only in the explicitly normalized view. Judge failures add **no contestant correctness zeros**.
- **91 valid initial pairs**, five missing valid pairs. Available-pair agreement: **245/247 criterion scores (99.19%)**, mean absolute difference **0.00405**. Missing opinions are not counted as agreement or invented. Adjudications also resolve support/version/extra-claim/reference differences, not just scores.
- **1,912,860 observed model tokens**; one interrupted call has unavailable provider consumption despite client-initialized zeros. Catalog estimate **$2.232809**, **not an actual bill**. Actual charges are unavailable, not zero. Judging accounting is separate from retrieval/answering workflow costs.
- The continuation ran **2026-11-02T04:11:26.935Z–04:19:59.041Z**. It stopped after the last planned adjudication failed structural validation. All claims remain consumed; runners have exited.

Extra-claim assessment is excerpt-limited: **110 Parallel and 104 Context7 claims were marked unverifiable**, not incorrect; six and four were marked reference-supported. Major/critical flags affect five and three answers respectively and require investigation, **not a claim that eight answers contain proven harmful errors**. Fully-correct rates remain LLM estimates, not exhaustive audits.

One selected adjudication flags a possible reference/alternative-solution concern for `takumi-09`: awaiting a native renderer buffer may provide the requested error behavior without `ImageResponse`/`response.ready`. This remains a disclosed concern, not a confirmed key error. The frozen rubric and all answers were left unchanged; no post-result reference amendment or selective rescoring occurred.

**Live citation support, authenticity/availability, independently verified evidence coverage, runtime correctness and independent human validation remain unverified.** Citation precision is unavailable, not zero or perfect. Model-assessed retained-evidence consistency is not proof of underlying page support.

## Artifacts and validation

Private, outside Git under `~/random/docs-check-runs/`:

- Original judging: `2026-11-02-first-pass-llm-judging-1/`.
- Approved continuation: `2026-11-02-first-pass-llm-judging-continuation-1/`.
- **Offline normalized results, strict bounds and audit:** `2026-11-02-first-pass-llm-quality-report-1/` (`report.md`, `results.json`, `validation-audit.json`, `offline-amendment.json`).

Freeze SHA-256 values:

- Original judging: `06fc4a618401cb1c59d362b7e382b1e735511ff73a43653854f9023e20003b38`.
- Continuation: `e2fa8e9077b77174b9d06bb9af25bcffc03f4a0139386e80ff045e83d335df27`.
- Normalized results: `1b0a3dcf24c27818ae1de62efe372478a53476b29f3b74cbd2e49eef695862f1`.

The offline audit rechecked the complete original artifact hashes, frozen paid-run implementations/dependencies, source chain, snapshot excerpts, both packet sets, exact schedules, all request/payload identities, selected judgments against raw output, strict quote/schema checks, the symmetric duplicate-only exception and all 252 calls. Original benchmark/question/reference artifacts remain unchanged. Final regression checks passed: **118 Node tests, 45 Python tests and 11 dataset tests (174 total)**, plus dataset validation and the real-artifact offline audit. These checks make no additional judging/provider calls. Passing structural checks do not prove semantic grading correctness.
