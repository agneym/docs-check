# Initial LLM judging incident — preserved without retries

**Subsequent update:** the user approved the [append-only continuation](../scripts/full/LLM-CONTINUATION.md); all 252 bounded judging calls are finished. [Automated quality results and strict unresolved bounds](llm-quality-report.md) are now available under a disclosed post-hoc identical-duplicate exception. Strict review remains incomplete for one final adjudication. No further calls are scheduled. The initial incident and original artifacts below remain unchanged.

**Initial-launch status at the first stop: no comparative quality result was available.** On 2026-11-02 the user selected LLM judging instead of the planned human review and explicitly clarified **no spending cap**. The bounded approved scope was `gpt-6.1-terra`, medium reasoning, 192 initial judgments plus up to 96 LLM adjudications, no retries or benchmark reruns. The [protocol amendment](../scripts/full/LLM-JUDGING.md), prompts, code, model metadata, source fingerprints and dependencies were frozen before launch. Original benchmark outcomes and human judge packets remain unchanged.

## Preserved judging outcomes

The first judging launch ran from **2026-11-02T03:53:41.299Z** to **03:54:30.557Z**. It paused new dispatch after failures and drained active requests.

| Item | Count |
|---|---:|
| Initial judge calls attempted | 37 |
| Validated initial judgments | 35 |
| Preserved failed judge calls | 2 |
| Initial judgments not attempted | 155 |
| Adjudications attempted | 0 |
| Retries / benchmark reruns | **0 / 0** |

Both failures are in the first blinded pass:

- `judge-1-A0028`: the model returned JSON, but one alleged retained-evidence quotation was not an exact substring. The validator rejected it. Raw output and the failed outcome remain preserved; no quotation normalization, score repair or replacement judgment occurred.
- `judge-1-A0063`: the response stream terminated with only a partial JSON string. The raw partial response and failure remain preserved. No retry occurred. Its default zero-valued client usage fields do **not** establish zero provider consumption.

The 35 validated judgments are neither a representative subset result nor a completed double review. Do not compute or publish a workflow winner from them. Failed **judging** calls are not failed contestant answers and must not introduce new primary correctness zeros. A complete report is blocked until missing valid judgments are resolved under an explicit amendment.

There were 37 one-shot HTTP model requests. Logged token observations sum to **249,909**, with provider usage unavailable for the interrupted call. Logged catalog cost estimates sum to **$0.314357**, **not an actual bill**; total actual judging charges are unavailable and may exceed these observations. Judging accounting is separate from benchmark workflow accounting.

## Offline checks and boundaries

- **108 Node tests, 44 Python tests and 11 dataset tests passed (163 total).** New tests exercise strict quotes/criteria, bounded approval, fresh payload boundaries, real pinned-SDK request construction and offline SSE/error fixtures, no retry on 429, failure drain, source tampering, failed-answer zeros and explicit machine-review labels. These tests do not prove model outputs will satisfy the schema.
- All **96 original entries and 332 source artifacts** were verified and hashed before launch; frozen source files and verbatim reference excerpts were checked. Post-stop freeze/source verification passed again.
- The two original 96-entry packet files were copied byte-for-byte; model requests had no map, workflow labels, operational metadata, tools, history or cache affinity. URLs/wording can reveal provenance. Same-model isolated contexts are not independent model families and can share biases with the answerer.
- The original `scoring.py` human-only gate is unchanged. The additive `llm_report.py`/`llm-judge.mjs --audit` path explicitly rejects the paused campaign: **Judging incomplete; no quality report**.
- Tool-free judges do not independently verify live citation pages. Citation support precision and independently verified evidence coverage remain unavailable, not zero/perfect. This automated analysis cannot be labeled human-validated or completion of the original human/citation audit.

## Initial artifacts and historical next gate

Private judging artifacts are outside Git at:

`~/random/docs-check-runs/2026-11-02-first-pass-llm-judging-1/`

Judge manifest SHA-256:

`06fc4a618401cb1c59d362b7e382b1e735511ff73a43653854f9023e20003b38`

Original source fingerprint:

`3f610fba9818758beb6c7c8bed08e11df0cafe9dfe1cfba4ce1c0be541796457`

The exclusive judging claim is consumed and the runner has exited. **Do not replay the runner or delete any claim/outcome.** Completing the analysis requires an explicitly approved append-only continuation and a decision on the two missing judgments; retrying those would amend the approved no-retry scope. Preserve all 37 earlier attempts and distinguish any later judging attempt from the original. At this initial stop, no continuation, retry or replacement was scheduled. The user subsequently approved the separately frozen continuation linked above; this historical instruction does not authorize another launch.
