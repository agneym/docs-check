# Documentation search evaluation dataset

A documentation-grounded question and reference-answer set for a future comparison of **Parallel Tasks API** and **Context7 documentation search**. **Neither tool has been evaluated or queried to author this dataset.**

## Start here

- [`evaluation/questions.md`](evaluation/questions.md) — readable questions, no answers.
- [`evaluation/questions.jsonl`](evaluation/questions.jsonl) — machine-readable public prompts.
- [`evaluation/answer-key.md`](evaluation/answer-key.md) — reference answers, weighted criteria, common mistakes, and quoted evidence.
- [`evaluation/answer-key.json`](evaluation/answer-key.json) — machine-readable private answer key.
- [`evaluation/validation-report.json`](evaluation/validation-report.json) — mechanical validation and dataset counts.
- [`sources/manifest.json`](sources/manifest.json) — source repositories, exact commits, paths, and SHA-256 hashes of every downloaded file.

Keep the answer key, drafts, and source checkouts **out of the search/answering agents' context** during evaluation. Only the evaluator receives them. “Private” here means withheld from benchmark contestants, not filesystem access control.

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

Separate **raw retrieval quality** from **end-to-end answer quality**. If one tool synthesizes answers and the other retrieves excerpts, document that asymmetry. Use the same downstream answering model, question text, time budget, and retry policy; record tool-specific settings. Preserve all raw results, including failures. Randomize execution order; repeat each question 3 times to measure variability. Report paired per-question differences, uncertainty, and family/category breakdowns, rather than a single winner by an arbitrary composite score.

Suggested next step: a small balanced pilot, then a frozen full run of **48 × 2 workflows × 3 repeats = 288 workflow executions**. Context7 library resolution and Parallel polling may require additional API calls. **Running that evaluation is a separate action; it has not been started.**

## Revalidate or rebuild artifacts

No third-party Python dependencies are needed:

```sh
python3 scripts/compile_dataset.py --validate-only
python3 scripts/compile_dataset.py --project react
python3 scripts/compile_dataset.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/test_compile_dataset.py -v
```

The compile command rebuilds public/private artifacts from the four draft JSON files and rechecks all snapshot hashes. It makes no network requests. `scripts/snapshot_docs.py` refuses to overwrite existing source folders; `scripts/start_authors.py` starts interactive agents and should not be rerun unless intentionally reauthoring the dataset.
