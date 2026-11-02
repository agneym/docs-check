# Offline human judging

**Automated alternative:** [LLM-JUDGING.md](LLM-JUDGING.md) and the approved [continuation](LLM-CONTINUATION.md) preserve the human-only gates documented here and never label machines as humans. [Automated results](../../evaluation/llm-quality-report.md) are available under an explicit [post-hoc identical-duplicate exception](LLM-OFFLINE-NORMALIZATION.md), with strict score bounds. Strict review remains incomplete for one final answer; no human/live-citation audit is claimed. All 252 judging calls are finished and no more are scheduled. Commands on this page remain the original offline human-review path.

No command here launches providers, models, retrieval, or paid work. These tools do not authorize a full campaign. Run from repository root:

```sh
python3 scripts/full/scoring.py prepare /private/campaign --out /private/campaign/judging
python3 scripts/full/scoring.py report /private/campaign --judging /private/campaign/judging --out /private/new-report
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/full -v
```

All destinations must be new. Never delete old results to rerun; choose a new destination. Preparation/report failures can leave partial destinations; preserve them. Input contract: `manifest.json` contains resolved `config`; `schedule.jsonl` has execution_id/question_id/workflow/repeat, exactly one pair of `parallel`/`context7` per included question, repeat 1. Production requires exactly 96 executions, all 48 public/key questions and four balanced 12-question families. Synthetic/subset campaigns require explicit `config.fixture_mode: true`; never use this bypass for production. Production verifies exact byte SHA-256 values against manifest.hashes for evaluation/questions.jsonl, evaluation/answer-key.json and schedule.jsonl. Production reporting additionally requires immutable launch.json, verifies its manifest_sha256 and execution_config_hash against compact insertion-ordered resolved_config JSON, and requires every outcome.config_hash to match that execution hash. Frozen manifest config can remain pending authorization; launch resolved_config records approved spending/authorization without modifying it. Launch metadata and resolved spending appear only in report metadata, never judge packets. Fixtures need not have a launch, but any supplied launch is validated. Each execution has outcome status (`completed` means success), optional answer `{text: string}`, evidence `{packet: string}` (or `text`). Missing answers/evidence remain empty; terminal outcomes are mandatory. Failed executions receive zero regardless of judges' scores or stale/partial answer text. Any retained failed answer and its criterion judgments are diagnostic only; failures cannot become rubric-perfect or fully correct. Report distinguishes `scheduled_executions` from `executions_started` (excludes not_run). Any not_run row makes `campaign_complete` false and labels the report incomplete/interim; scheduled not_run zeros remain in frozen primary rather than pretending 96 executions occurred.

Outcome telemetry follows the pilot: total_ms/retrieval_ms/answer_ms; model_usage is a list of `{phase, usage: {totalTokens, ...}}`. Runtime charge fields are `provider_charge` (numeric or null), `currency`, and `accounting_status`; null remains unknown. Absent charges, subscription prices, and absent usage are unknown, not zero. Catalog estimates never become actual charges. Raw phase usage, retries, errors, evidence metrics and other outcome fields are preserved in results; structured latency, charge and token summaries are also emitted. Evaluation/judging costs are not workflow charges and should be separately appended by the controller in a new report revision.

## Append-only continuation view

After the continuation has written `campaign-terminal.json` (`pass-ended` or `paused`), run:

```sh
python3 scripts/full/assemble.py /private/original /private/continuation /private/NEW-view
```

The continuation manifest phase is `full-first-pass-continuation`; `origin` binds absolute `run`, byte `manifest_sha256`, `launch_sha256`, and `outcomes` mapping every original execution ID to its outcome SHA-256. Its schedule must be exactly the original 95 `not_run` rows in order, with no attempted-entry replacement or extra execution directories. Launches must bind their own manifests and the same original resolved execution configuration hash. Production validates the original frozen input/runtime/reference archive. Only explicit original `config.fixture_mode: true` permits small synthetic schedules.

The new controller-only directory copies the original manifest/schedule/launch byte-for-byte and selected outcome, answer, evidence, public-request and isolation artifacts. The first setup failure stays failed/zero. Original `not_run` bytes remain untouched, linked by hash to continuation amendments. Raw logs remain in their source roots. `view-provenance.json` records source paths, all validated source hashes and all copied file hashes; keep both roots available and immutable. Prepare and report revalidate provenance and copied bytes. Provenance is sealed in the blind map and disclosed only in reports, never judge packets. A continuation `not_run` still makes the report incomplete. This is not authorization to launch, retry, edit frozen artifacts, or change human review. Preserve the isolation incident, implementation change and interrupted pair/window in the human report appendix.

## Second continuation (offline only)

Use `python3 scripts/full/assemble_chain.py BASE_VIEW CONTINUATION_2 NEW_DEST`.
Only the first continuation view is accepted as base: its 88 `not_run` rows
are selected in original order; the two completed and six failed rows remain
unchanged. Original manifest, schedule and launch bytes retain scorer identity.
The new view records `kind: second-continuation-view`, hash-linked amendments,
all three source roots, and the separately frozen parser-correction bundle.
No source is overwritten and existing destinations are rejected. Validation
recursively rechecks the first view and all selected sources. Operational
reports audit all three roots; full chain provenance is controller-only report
metadata, never judge-packet content. Human grading rules are unchanged.

A frozen second-continuation `sensitivity_plan`, when present, additionally
produces `infrastructure_excluded_sensitivity` only after human review. Both
workflows for the four predeclared infrastructure-affected questions are
excluded together (44 paired questions), using the same frozen bootstrap seed
and sample count. This is diagnostic only: mixed implementation/windows remain
confounded. The 48-pair primary retains all failed zeros; the 46-pair nonpilot
analysis is unchanged. Without a frozen plan this diagnostic is null. No
answer scores are used to choose exclusions.

## Separation

Keep `blind-map.json` controller-only (0600; parent directory 0700). It is sealed by access separation, **not encryption**. Give each judge only their independently seeded `judge-N-packets.json`. Do not share map, schedule, outcome, manifest, timing or costs. Seeds derive deterministically as the first eight big-endian bytes of SHA-256 of `config.judging.seed:judge-N`; independently shuffled, unrelated to execution order. The manifest also controls bootstrap_seed and bootstrap_samples (10000). Packet contents are hashed in the sealed map and both judge packet files are verified before reporting. Same anonymous IDs allow matching. Answer wording and retained evidence text are unchanged; only explicit provider wrappers are omitted. Inspect packet text for accidental operational identifiers before release: wording, source URLs, and native evidence style can reveal provenance. This is provider-label blinding, not guaranteed anonymity. Reference question IDs remain visible to judges, as needed for source verification.

Freeze preparation and artifacts before review; report rejects changed manifest, schedule, public/key data, outcomes, answers or evidence. Hashes detect accidental changes, not malicious controller rewriting. Do not allow contestant access to judging storage.

## Judge files

Two distinct named humans independently score **every answer**, including failed/empty answers. Write one JSON object per answer to `judge-1.jsonl` and `judge-2.jsonl`:

```json
{"anonymous_id":"A0001","judge_id":"judge-1","judge_type":"human","reviewer":"Alice","criteria":[{"id":"c1","score":1,"quote":"exact substring from answer","evidence_refs":["e1"],"returned_support":"verified","verification_notes":"Compared retained passage with independent cached official source.","retained_quote":"exact substring from retained evidence","cache_refs":["official-page"]}],"extra_claims":[],"version":{"status":"unsupported","compliant":true,"rationale":"Honest disclosure; behavior satisfies requested scope."},"citations":{"material_claims":1,"cited_claims":0,"links":[]}}
```

Include exactly all reference criteria, once each. Scores are numeric 0, 0.5 or 1 (not booleans). Every criterion needs either a literal answer `quote` **or** nonempty `omission` rationale, never both, plus nonempty reference evidence IDs. Half credit requires substantively correct but incomplete content. Contradictions negate affected criteria; API-name mentions alone do not earn credit. Accept equivalent implementations. Missing citations do not erase factual rubric credit.

`returned_support`: verified/absent/unknown. Verified requires independent official documentation verification of retained support, not trusting provider synthesis. Verified support requires nonempty `verification_notes`, exact `retained_quote` from that packet's retained evidence, and nonempty `cache_refs`; each reference must pass the same independent citation-cache body hash/timestamp validation as final citations. A reference-key evidence ID alone cannot verify a retained live packet. Unknown must not be counted verified. Full native output coverage is a separate manual diagnostic if truncation occurred; the tool does not fetch or infer unseen sources.

Extract distinct material extra claims once. Each extra_claims item has exact `quote`, verdict correct/incorrect/unverifiable, severity minor/major/critical, rationale and nonempty evidence_refs (URLs/cache IDs permissible here), plus independent `cache_refs` validated against citation-cache.json and archived bodies. Correct/incorrect verdicts require independently checked official evidence; unverifiable claims require an archived failure/unknown-verification record and rationale, not an invented fact judgment. Absence from key is not proof of error. Major changes API behavior or breaks solution; critical risks security/data loss. Incorrect and unverifiable remain separate. Fully correct requires rubric perfection, version compliance and no material incorrect extra claim.

Version status: exact/unsupported/missing/silent_substitution/drift/disputed, with rationale and boolean compliant. **Honest canary/index provenance disclosure is not itself an incorrect factual claim.** Grade requested reference scope separately from evidence provenance; do not falsely penalize an honest caveat. Do not equate main/master with a release. Genuine drift, key errors or silent substitution need documented investigation.

Citations count distinct material externally checkable claims and claims linked to citations. Each claim–citation link has claim, url, status, rationale, cache_ref. Status: supported/wrong/broken/inaccessible/version_mismatch/unknown. Every link also requires `quote`, an exact answer substring. Every distinct HTTP(S) answer URL must have a link record; omissions block reporting. Independently verify every distinct page using existing offline caches; archive body, SHA-256 and verification timestamp separately in judge-only storage. If unavailable offline, record unknown/inaccessible, not factual falsehood. The program validates structure and cache bytes, not factual verification. `citation-cache.json` maps each cache_ref to `{url, path, sha256, verified_at}`. Paths are relative to judging storage and cannot escape it. Every linked page requires an existing archived body (or archived failure response for inaccessible/broken pages), matching SHA-256 and nonempty verification timestamp. Missing caches block reporting; no network fetch is attempted. No links means support precision null, not 100%; no citations for existing claims means coverage zero. Counts must be audited manually against atomic claims.

## Adjudication before unblinding

Any score or diagnostic disagreement, major/critical claim flag, or drift/version dispute blocks reporting until human resolution. Differences in rationale alone conservatively trigger adjudication. Write `adjudications.jsonl` with one record per affected anonymous_id:

```json
{"anonymous_id":"A0001","human":true,"rationale":"Resolution and source verification, before map access.","judgment":{"anonymous_id":"A0001","judge_id":"adjudicator","judge_type":"human","reviewer":"Carol","criteria":[],"extra_claims":[],"version":{},"citations":{}}}
```

Replace empty placeholders with a complete valid judgment. Preserve both original judgments; adjudication is not an overwrite. Distinguish reference error, index drift, citation failure and reasoning failure. Frozen key remains primary: do not edit dataset. Any confirmed reference amendment requires separately documented symmetric rescoring of every affected answer in a new revision, with original/amended hashes and sensitivity analysis. This CLI does not silently amend references or automatically exclude invalid items.

## Interpretation

Weighted question correctness → within-family mean → unweighted family macro. Failures included. Paired Parallel−Context7 bootstrap samples question pairs within each family 10,000 times, manifest-frozen seed (currently 9102026); percentile interpolation `(n−1)p`. Nonpilot sensitivity excludes nextjs-02 and tanstack-06. It measures selected-item uncertainty, not universal representativeness or within-item variability. CI spanning zero is inconclusive on this set, not universal equivalence. No composite winner or post-hoc decision margin.

`results.json` contains records, diagnostics, agreement and mean absolute criterion difference, family/difficulty/category analyses, successful/all-terminal latency medians/p95, costs and missingness. `report.md` starts with a readable workflow table and paired difference/interval, followed by detailed summaries and limitations. Per-question paired differences, phase usage observations/missingness, retries/attempts and error/timeout summaries are included in JSON. Unknown returned support is counted separately from absent and verified. Tiny groups are descriptive. Timeouts censor actual completion latency. Multi-source breakdown is derived from more than one distinct frozen reference evidence file path (not provider output count); false-premise uses the frozen key category. Code/version flags are unavailable and explicitly reported as such, not inferred post hoc. Truncation/native-output support, incident narratives, late charges and confirmed-invalid-item sensitivities require human appendices; do not claim these were automatically verified. Preserve protocol deviations and pilot changes, including upstream synthesis/snippet asymmetry.
