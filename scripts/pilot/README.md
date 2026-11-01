# Isolated pilot runner

This runner is restricted to the approved **four executions** in `evaluation/pilot-config.json`. That pilot has now completed; `pilot_completed: true` blocks further paid campaigns until fresh authorization is recorded. It does not implement or launch the 96-execution full pass. Results are in [`../../evaluation/pilot-report.md`](../../evaluation/pilot-report.md).

## Setup

Requires Linux x86_64, Node >=24, and QEMU. The current host has no usable KVM access, so the pinned Gondolin runtime uses QEMU TCG software emulation. No sudo or system-wide changes are needed for the Ubuntu fallback:

```sh
bash scripts/pilot/setup-qemu.sh
cd scripts/pilot
npm ci --ignore-scripts
npm test
npm run preflight  # no benchmark API calls
npm run pilot     # paid/provider calls; refuses consumed or missing authorization
```

Dependencies are pinned by `package-lock.json`; the guest image is pinned to Alpine build `f59d9a69-1f62-57e0-a392-6800d3dd021d` when cached. The manifest records the actual image manifest, QEMU binary hash, source hashes, prompts, model metadata, and effective settings. The host resolves model metadata from Pi's local model store without starting a Pi agent/session. Authentication is resolved on the host from configured OpenAI Codex OAuth, the existing Parallel data API key, and Context7 credentials (or anonymous Context7 if none exist). No credential store is mounted into the VM. `PARALLEL_PYTHON` and `DOCS_CHECK_QEMU_ROOT` can override installation locations.

## Isolation

- Each workflow gets a fresh QEMU VM and disposable filesystem; **no host directory mounts**.
- Only three public fields are exported: `product`, `version_context`, `question`. No key, local source, family/difficulty labels, or previous-session context.
- The guest receives only its public request, the generic Task spec, safe model metadata, executable bundle, and credential placeholders.
- HTTP host/path/method policy permits only the selected provider API and `POST /backend-api/codex/responses`. No web browsing, raw TCP mapping, ingress, SSH, or WebSockets.
- Model calls are low-level API calls with exactly one user message, no tools, medium reasoning, no previous response ID, and `store: false`. There is no coding-agent resource/session discovery.
- Host-side Gondolin hooks inject real credentials only into allowed headers/destinations. A shaped **fake JWT** lets the Codex client extract a placeholder account ID; both it and its authorization header are substituted on the host. Real tokens never enter the guest.
- A host-only random canary detects accidental outbound/log leakage. Checks verify absent private paths, blocked external and metadata hosts, no inherited Pi session, and no marker from a previous VM.
- Parallel gets a fresh random `memory_scope_key` per execution and no `previous_interaction_id`, isolating it from personal/prior Task memory.

## Retrieval/answering

Parallel uses direct Task API, explicit `core-fast`, and the JSON spec; task creation is never automatically retried. Context7 uses the v2 HTTP endpoints used by CLI 0.8.2. Two frozen model planning calls choose up to two library resolutions, then up to four doc queries using only returned IDs. No follow-up retrieval loop is enabled for this pilot. The answering call is separate, using only that workflow's evidence.

Retrieval deadline: 300s; answering: 60s; total: 360s. VM preparation is recorded separately. Failed paths pause the campaign; remaining planned executions get `not_run` records, never replacement calls. Local fixture tests and sandbox preflight can be rerun without querying contestants.

### Explicit pilot limitations/deviations

- Exact GPT-6.1 tokenizer details are unverified: the local evidence/output budget uses pinned `o200k_base` as a **proxy**, not an exact model token count. Actual model usage is kept separately.
- Codex subscription transport has no native output-token cap in this client. The runner enforces the 4,096-proxy-token cap locally, but cannot guarantee a client abort stops provider charging immediately. No unsupported token-limit parameter is silently sent.
- Actual subscription/provider charges may be unavailable. Catalog model cost estimates are not actual bills and are never labeled zero/free usage.
- This is a minimal pilot runner, not the complete full-evaluation/scoring implementation. It intentionally does not run double judging or bootstrap statistics.

## Artifacts

Each permitted runner invocation creates a new private directory under `~/random/docs-check-runs/`. Override the parent with `DOCS_CHECK_RUN_ROOT`, and the campaign ID with `DOCS_CHECK_CAMPAIGN`. Existing campaigns are refused. The result root is printed before execution.

The runner saves each public request, isolation check, model/provider request payload, raw response/error, retained evidence, final answer, timing, and usage. Task IDs are saved immediately on creation so an interrupted run is not blindly resubmitted. Request headers and credential stores are never logged; secret values are also redacted defensively. Post-run judging and summarization (already executed for the completed pilot):

```sh
node scripts/pilot/judge.mjs <campaign-directory>  # one paid, fresh, blinded judge call; refuses existing outputs
python3 scripts/pilot/summarize.py <campaign-directory>  # offline; refuses to overwrite results.json
```

The original judge prompt/code are archived with its outputs. The current judge prompt includes a post-pilot clarification about honest version-provenance disclosures. Frozen pre-run runner/input copies are also retained; current source changes after the pilot do not replace those records.

Review artifacts only on the host, after contestant executions. Do not mount results back into another contestant VM.
