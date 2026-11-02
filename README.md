# Documentation search evaluation dataset

A documentation-grounded question and reference-answer set for a comparison of **direct Parallel Task API with structured documentation findings** and **Context7 documentation search**. The Parallel workflow will use HTTP or the official SDK, not the deep-research CLI/skill. **Neither tool has been evaluated or queried to author this dataset.**

## Start here

- [`evaluation/llm-quality-report.md`](evaluation/llm-quality-report.md) — **automated comparison available: 93.02% Parallel vs 88.63% Context7; no clear quality winner** (paired 95% interval spans zero). Includes all benchmark failed zeros, sensitivities, 252 judging calls and an explicit post-hoc identical-duplicate exception. Strict review remains incomplete for one answer; human/live-citation audit is outstanding.
- [`evaluation/llm-judging-report.md`](evaluation/llm-judging-report.md) — preserved initial judging incident and link to the approved continuation/results; no original failures were overwritten.
- [`evaluation/full-run-report.md`](evaluation/full-run-report.md) — **benchmark execution complete: 96 attempted once, 90 answers completed, 6 preserved failures, 0 unrun**. Operational results and both blinded judge packet sets are ready. No further benchmark attempts are scheduled.
- [`evaluation/full-preparation.md`](evaluation/full-preparation.md) — offline preparation status, freeze location and remaining spending/reviewer gates; no full executions or results.
- [`scripts/full/README.md`](scripts/full/README.md) — dedicated single-pass runner, offline freeze/tests, single-use spending gate, failure preservation and blinded scoring. [`evaluation/full-config.json`](evaluation/full-config.json) freezes the 96-entry design; **the execution pass has ended; see the final operational report and pending blinded-review requirements**.
- [`evaluation/pilot-report.md`](evaluation/pilot-report.md) — completed four-execution pilot: isolation checks, rubric results, timing, usage, citations, and preserved setup failure. **The first full pass finished execution; the separate automated quality analysis is available above.**
- [`evaluation/PROTOCOL.md`](evaluation/PROTOCOL.md) — evaluation process: pilot, isolation, workflow settings, blinded scoring, full-run gates, and reporting.
- [`evaluation/pilot-config.json`](evaluation/pilot-config.json) — completed four-execution pilot configuration (authorization consumed): `core-fast`, `gpt-6.1-terra` with medium reasoning, and no monetary cap for the pilot only.
- [`evaluation/parallel-task-spec.json`](evaluation/parallel-task-spec.json) — explicit Task API output schema for documentation findings, source URLs/excerpts, and version gaps; not a final-answer/report schema.
- [`evaluation/questions.md`](evaluation/questions.md) — readable questions, no answers.
- [`evaluation/questions.jsonl`](evaluation/questions.jsonl) — machine-readable public prompts.
- [`evaluation/answer-key.md`](evaluation/answer-key.md) — reference answers, weighted criteria, common mistakes, and quoted evidence.
- [`evaluation/answer-key.json`](evaluation/answer-key.json) — machine-readable private answer key.
- [`evaluation/validation-report.json`](evaluation/validation-report.json) — mechanical validation and dataset counts.
- [`sources/manifest.json`](sources/manifest.json) — source repositories, exact commits, paths, and SHA-256 hashes of every downloaded file.

Keep the answer key, drafts, source checkouts, evaluation protocol, and judge/controller artifacts **out of the search/answering agents' context** during evaluation. Only the evaluator receives them. “Private” here means withheld from benchmark contestants, not filesystem access control.

## Documentation snapshots

Downloaded on **2026-11-01 UTC** into this folder. These are source-document snapshots, not built/served website mirrors. Embedded code examples remain; application implementations, website build code, dependencies, binary assets, and Git metadata/history are not retained.

| Folder under `sources/` | Official repository | Ref | Commit | Files |
|---|---|---|---|---:|
| `react/` | `reactjs/react.dev` | `main` | `0821e7d9428a` | 227 |
| `nextjs/` | `vercel/next.js` | `v16.4.3` | `29bbeab09981` | 475 |
| `tanstack-query/` | `TanStack/query` | `main` | `604d0a5aaf7b` | 1,670 |
| `tanstack-router/` | `TanStack/router` | `main` | `da2adec76dbe` | 251 |
| `tanstack-table/` | `TanStack/table` | `main` | `c14e0221b1e6` | 1,264 |
| `takumi/` | `kane50613/takumi` | `master` | `0cb1228af6dc` | 57 |

**3,944 documentation/metadata/license files; approximately 19.9 MB of file contents.** Files retain their original repository-relative paths. TanStack Start documentation is included in `tanstack-router/docs/start/`. TanStack is a family, not a single library; this dataset samples Query, Router, Start, and Table, not every TanStack product. Takumi is the rendering project at **takumi.kane.tw**.

Next.js is release-pinned. Other repositories are commit-pinned main/master documentation snapshots, **not release-pinned package implementations**. Table's current documentation explicitly describes **v9**, and the Table questions say so; do not grade them as v8 questions. Do not infer package versions from branch names.

The download script used depth-1, blob-filtered sparse Git clones in temporary directories, copied documentation text and licenses only, then discarded the clones. No `.git` directories are present in `sources/`. The script's main/master refs move on future downloads; the retained manifest and file hashes identify **this** corpus precisely.

## Question coverage

**48 questions: 12 per family**, each with 4 easy, 4 medium, and 4 hard items. One documented false-premise question per family tests whether an answer corrects a demonstrably wrong assumption, not whether it guesses about undocumented features.

- **React:** state, refs/context, effects/Strict Mode, Effect Events, Actions/Transitions, external stores, hydration.
- **Next.js 16.4.3:** App Router, cookies/components, Route Handlers, caching/revalidation, migration, async image-metadata arguments.
- **TanStack:** 4 Query, 2 Router, 1 Router–Query integration, 2 Start, 3 Table questions.
- **Takumi:** fonts, raster/SVG output, styles, migration, PDF constraints, image-fetch safety, Next.js image responses and failure fallbacks.

The set includes code repair and API discovery from symptoms (`react-11`), a version-specific TypeScript migration (`nextjs-11`), cross-library integration (`tanstack-06`), and code construction with asynchronous error handling (`takumi-09`). These four replace overlapping questions; the total remains 48.

The reference answers were authored and revised using only the local official docs rather than either tool under test. The compiler separates prompts from answer keys and adds immutable GitHub line links and source hashes. The four JSON files in `evaluation/drafts/` are the canonical editable dataset, despite the directory name; authoring instructions are in `evaluation/AUTHORING.md`. Intermediate drafts, review logs, and agent-launch metadata are not retained.

The current set contains **130 grading criteria, 131 evidence excerpts, and 15 questions requiring multiple source files**. Current dataset and snapshot hashes are recorded in `evaluation/validation-report.json`.

Automated validation checks every snapshot hash, question IDs/counts, difficulty balance, source scope, evidence references, inclusive line ranges, and exact verbatim quotes. Eleven regression tests pass, including rejection of bad citations/quotes, checking that public prompts omit answer-key fields, and ensuring compiled artifacts and reported counts/hashes match the current drafts. These checks **do not prove semantic correctness**, and documentation review is not infallible. These are source-grounded reference answers, **not runtime-tested application solutions**.

### Source caveats

- A repository's default-branch docs can be ahead of the published website or a search provider's index. A live answer's apparent mismatch may be version/index drift rather than reasoning failure. Record this separately and adjudicate against the requested scope.
- Takumi's concepts and images pages disagree about automatic fetching of stylesheet image URLs. No question relies on that disputed behavior. Its migration guides describe historical changes; do not blindly apply every migration statement to every later release.
- Takumi's Next.js examples use `route.tsx`, whereas Next.js's own Route Handler guide documents `route.js|ts`. The corrected `takumi-09` reference uses `route.ts` with a supported HTML-string input, avoiding that documentation mismatch; no runtime failure of `.tsx` was established.
- TanStack Query's general invalidation guide and `static` stale-time guidance differ about stale marking. The affected question grades invalidation-triggered **refetch**, not the disputed stale-state wording.
- Historical Next.js migration-guide setup requirements are not used as current-version requirements.
- Easy/medium/hard labels are author-assigned, not empirically calibrated. Results describe this selected set, not all coding tasks. A pilot can identify ambiguities, but freeze revisions before scored runs.

## Suggested scoring when evaluation is approved

Submit each public row's **question plus product/version context**, verbatim, to both workflows. Do not supply evidence excerpts, expected terms, difficulty, false-premise labels, or answer hints. Use isolated working directories/contexts so neither workflow can inspect this folder.

1. **Correctness/completeness (primary):** score each criterion as 0, 0.5, or 1 times its weight. Normalize each question by its maximum points; macro-average questions within families, then families. Also report fully-correct answer rate. Accept semantically equivalent answers and valid alternatives; exact wording is not required.
2. **Unsupported claims:** separately count material incorrect/unsupported assertions and their severity. A rubric-only score can miss harmful extra claims; report the error rate rather than hiding it in an arbitrary composite.
3. **Evidence:** citation coverage and whether cited pages actually support the answer. Reference-key citations establish ground truth; they are not required to be the same URLs contestants cite. Verify returned links/content independently.
4. **Version handling:** compliance with requested versions, and suspected index/publication drift. Do not silently change expected answers after seeing which tool produced a response. Adjudicate disagreements blinded and record corrections.
5. **Latency/reliability:** end-to-end median and p95 wall time, completion rate, errors, timeouts, and retries. Include library resolution, asynchronous task submission/polling, and downstream answer generation where applicable.
6. **Cost/context:** actual provider charges where available, downstream model input/output tokens, raw retrieved content size, and cost/tokens per correct answer. Do not equate subscription access or unavailable usage accounting with zero cost.

Separate **raw retrieval quality** from **end-to-end answer quality**. If one tool synthesizes answers and the other retrieves excerpts, document that asymmetry. Use a common answering model in separate, isolated calls: each receives the same question but only its own workflow's retrieved material, never the other workflow's evidence or answer. Use identical model settings, time budgets, and retry policies; record tool-specific settings. Preserve all raw results, including failures. Randomize execution order; run each question once per workflow for the first pass. Review results before deciding on additional attempts; this pass will not measure within-question run-to-run variability. Report paired per-question differences, uncertainty, and family/category breakdowns, rather than a single winner by an arbitrary composite score.

The process is specified in [`evaluation/PROTOCOL.md`](evaluation/PROTOCOL.md). The **four-execution pilot completed** using direct Task API `core-fast`, Context7, and `gpt-6.1-terra` with medium reasoning inside fresh Gondolin VMs; see [`evaluation/pilot-report.md`](evaluation/pilot-report.md). Both workflows met all rubric criteria on the two pilot questions; the report records timing, version/index limitations, actual-cost unavailability, and an earlier host-only setup failure. These are not full-benchmark results. A dedicated full-run implementation and offline scoring/reporting path are now in [`scripts/full/`](scripts/full/README.md), separate from the consumed pilot runner. Separate uncapped spending and two incident-scoped append-only continuations were explicitly approved, without replacing failures. The **48 questions × 2 workflows × 1 attempt = 96-entry execution pass has finished**: 90 completed answers, 6 preserved failed/zero entries and no unrun entries. The corrected final 88 entries completed 88/88. See [`evaluation/full-run-report.md`](evaluation/full-run-report.md) for infrastructure incidents, timings, usage, accounting limitations and artifacts. Both independent 96-answer judge packet sets were prepared. The user approved a separately frozen [LLM-only judging amendment](scripts/full/LLM-JUDGING.md) and [append-only incident continuation](scripts/full/LLM-CONTINUATION.md), without altering original benchmark runs or the human-only scorer. All 252 authorized judging calls finished (194 initial attempts including exactly two approved retries, plus 58 adjudications). A final deeply identical duplicate criterion was removed only in an explicitly [post-hoc offline analysis](evaluation/llm-quality-report.md), with no score/quote changes or additional calls. Strict review remains incomplete for that one answer; strict score bounds and normalized results both show no clear quality winner. All failures and claims are preserved, all runners stopped, and no further calls are scheduled. Independent human review and live citation verification have not occurred.

## Revalidate or rebuild artifacts

No third-party Python dependencies are needed:

```sh
python3 scripts/compile_dataset.py --validate-only
python3 scripts/compile_dataset.py --project react
python3 scripts/compile_dataset.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/test_compile_dataset.py -v
```

The compile command rebuilds public/private artifacts from the four draft JSON files and rechecks all snapshot hashes. It makes no network requests. `scripts/snapshot_docs.py` refuses to overwrite existing source folders; `scripts/start_authors.py` starts interactive agents and should not be rerun unless intentionally reauthoring the dataset.
