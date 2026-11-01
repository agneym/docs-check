#!/usr/bin/env python3
"""Start interactive Pi authors in hc terminals (never print/one-shot mode)."""
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSIGNMENTS = {
    "react": "Use only sources/react/src/content/learn and sources/react/src/content/reference. Cover hooks, state/effects, modern stable APIs and documented constraints. Avoid blog/news and canary-only APIs.",
    "nextjs": "Use only sources/nextjs/docs. This is the stable v16.4.3 release checkout. Focus on App Router: caching/revalidation distinctions, server/client boundaries, route APIs, migration. Explicitly scope questions to Next.js 16.4.3. Do not mix Pages Router behavior without saying so.",
    "tanstack": "Use only sources/tanstack-query/docs, sources/tanstack-router/docs, and sources/tanstack-table/docs. Allocate 4 questions Query React adapter, 3 Router React, 2 Start React, 3 Table React. These are main-branch snapshots, NOT automatically v5/v8: inspect docs for version assertions, especially Table v9. Name the product and explicit major version if documented in the question. No how-to/drafts docs or generated agent-skill instruction files. At least 3 questions must cite 2+ different files.",
    "takumi": "Use only sources/takumi/docs/content/docs. This is kane50613/takumi, the renderer at takumi.kane.tw. Cover rendering/style/font/image behavior and migration; include PDF/paint APIs only if clearly documented and publicly phrased. Broad coverage, not only integrations. Master-branch snapshot is not release-pinned.",
}


def main():
    parent = os.environ["HC_TERMINAL_ID"]
    records = []
    for project, scope in ASSIGNMENTS.items():
        prompt = f"""You are the {project} documentation benchmark author. Workspace: {ROOT}. First read evaluation/AUTHORING.md completely, then inspect the assigned entries in sources/manifest.json. Follow that exact contract. {scope}
Create exactly 12 high-quality questions and complete reference answers with precise verbatim line-cited documentation evidence and atomic criteria. Write only evaluation/drafts/{project}.json. Do not modify sources or other files. Do not start subagents or use either search product under evaluation. Parent terminal: {parent}. When done or blocked, use hc send {parent} with output paths and concise summary. Remain interactive and available for follow-up."""
        command = ["hc", "run", "--bg", "--name", f"docs-{project}", "--cwd", str(ROOT), "/usr/bin/env", f"PATH={os.environ['PATH']}", shutil.which("pi"), "--provider", "openai-codex", "--model", "gpt-6.1-terra", "--thinking", "medium", "--no-extensions", "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-mcp", "--tools", "read,bash,edit,write", prompt]
        result = subprocess.run(command, text=True, capture_output=True, check=True)
        print(project, result.stdout, flush=True)
        records.append(dict(project=project, launch=json.loads(result.stdout)))
    (ROOT / "evaluation" / "author-agents.json").write_text(json.dumps(records, indent=2) + "\n")


if __name__ == "__main__":
    main()
