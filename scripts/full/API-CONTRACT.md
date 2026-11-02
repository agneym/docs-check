# Full-pass API contract review (2026-11-01 UTC)

Controller-only review; no benchmark questions, provider inference, or paid smoke tests were submitted. Official documentation was downloaded directly over HTTPS, not via Parallel research, Search, Extract, or Responses. Archive outside repository: `~/random/docs-check-preflight/api-references-20261101/archive-index.json`. The preparer copies the ten archived bodies, URLs, timestamps and SHA-256 hashes into each private freeze; verification rejects changed copies. One obsolete memory URL returned 404; the index records its replacement.

## Parallel

Reviewed official create/status/result OpenAPI and structured schema guides:

- https://docs.parallel.ai/api-reference/tasks/create-task-run.md
- https://docs.parallel.ai/api-reference/tasks/retrieve-task-run.md
- https://docs.parallel.ai/api-reference/tasks/retrieve-task-run-result.md
- https://docs.parallel.ai/task-api/guides/specify-a-task.md
- https://docs.parallel.ai/task-api/guides/choose-a-processor.md
- https://docs.parallel.ai/resources/memory.md
- https://docs.parallel.ai/getting-started/pricing.md
- https://docs.parallel.ai/llms.txt

Create is POST `/v1/tasks/runs`, normally 202, returning `run_id`; status/result are GET on that ID and `/result`. The documented pending-result 408 is pending, not a reason to recreate. Preserve structured `output.content`, `output.basis`/basis metadata and full raw responses. Empty findings pass schema validation; malformed output fails without repair. Generic findings schema remains `evaluation/parallel-task-spec.json`, used unchanged for all questions.

**Keep `core-fast`.** It worked in both retained pilot Task requests. Current public processor and pricing tables list `core`, but omit `core-fast`; do not infer their prices are identical or replace the selected processor. Its current per-account availability and actual charges cannot be established without a real request or account accounting. First-pass 403/unsupported-processor failures pause the campaign, not trigger an alternative. There is no additional paid availability probe.

Memory documentation says each `memory_scope_key` identifies an isolated application memory bank, and memory retrieval is explicit, not automatic. Use a fresh random key per execution and never send `previous_interaction_id` or call memory endpoints.

No Task cancellation endpoint or create-idempotency contract was verified in the archived Task contract/index. Do not invent either: **never retry Task POST**, even on 429/5xx or ambiguous transport failure. Save a returned ID on the host before delivery to the worker and immediately in worker events; reconcile it into failed outcomes. Preserve outstanding/ambiguous work and later charges. No automated late-result retrieval or cancellation is enabled; any approved host-only reconciliation is an append-only diagnostic, never a replacement answer.

Public pricing says successful Task runs are billable, failed runs are not. A local timeout is not a provider failure and may still incur charges. Published tables are not actual invoices, and the selected alias has no verified public price. Charges remain null/unavailable unless independently reconciled. **Capped launch is blocked** until enforceable live accounting and outstanding-exposure bounds exist; unknown is never zero.

## Context7

The archive includes installed `ctx7@0.8.2` package metadata and its API source (`dist/chunk-BD5YZC3K.js`). The pinned source confirms GET `/api/v2/libs/search?libraryName=...&query=...`, then GET `/api/v2/context?libraryId=...&query=...`, client-version headers and optional Bearer authentication. The runner does not execute the CLI, auto-update it, follow library redirects, cache IDs, or preload IDs from the key. Two fresh planner calls use only public input and this execution's returned candidates. At most two resolutions/four queries; returned IDs only. An empty successful resolution cannot justify invented IDs; unsupported resolution fails and is retained. Empty successful documentation evidence proceeds to a separate answer call with an explicit empty marker.

## Common model and transport

Pinned pi-ai 1.4.0, low-level `openai-codex/gpt-6.1-terra`, medium reasoning; no agent session/resources, tools, history, previous response, or browsing. Static bundled imports work in a dependency-free directory. Host audit decompresses zstd, validates destination/model/reasoning/context/Task schema and call budgets, and rejects canary leakage. SDK retries are disabled; one explicit safe transient model transport retry is allowed inside the original phase deadline. Authentication, exhausted quota and output/schema failures are not retried. Temporary rate-limit 429 is distinct from exhausted quota; 402 pauses even without an error message. Safe GET operations get at most one transient retry. Task POST never does.

Body reads, backoff, polling, planning and generation share the original phase/total deadlines. Late responses cannot turn a failed official execution into success. Output cap is local 4,096 proxy tokens, not a provider-side spend bound; exact GPT-6.1 tokenizer and actual subscription costs are unverified. No unsupported temperature/output-limit fields are silently sent.

## Boundary and review limits

Each execution boots a fresh pinned Gondolin 0.14.0 VM with no mounts, synthetic DNS, no WebSockets, host credential substitution and an outbound audit. Preparation uses a provider-denied VM only. Freeze/launch checks actual image asset checksums, extracted QEMU binary/libraries/modules/BIOS tree, installed dependency tree, bundle, model metadata, code/input hashes and schedule. The host OS/kernel/system dynamic loader remain part of the trusted host, not a hermetic hardware attestation. Controller, reviewers and archived references stay outside all contestant VMs.

Free official documentation HTTP reads above are controller contract research, **not contestant retrieval results**. Citation verification for answers happens later in judge-only storage and never feeds contestants. The public dataset/reference answers and all pilot artifacts are unchanged.
