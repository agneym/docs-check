#!/usr/bin/env python3
"""Validate documentation-grounded drafts, then separate public prompts from keys.

This checks structure, provenance, line ranges and exact quotes. Semantic
entailment still requires review; passing validation is not proof of correctness.
"""
import argparse
from collections import Counter
import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = ("react", "nextjs", "tanstack", "takumi")
CATEGORIES = {"api-usage", "defaults", "debugging", "migration", "multi-source", "constraints", "false-premise"}
FIELDS = {"id", "project", "product", "category", "difficulty", "version_context", "question", "reference_answer", "criteria", "common_mistakes", "evidence"}
PUBLIC_FIELDS = ("id", "project", "product", "version_context", "question")
SCOPES = {
    "react": ("sources/react/src/content/learn/", "sources/react/src/content/reference/"),
    "nextjs": ("sources/nextjs/docs/",),
    "tanstack": ("sources/tanstack-query/docs/", "sources/tanstack-router/docs/", "sources/tanstack-table/docs/"),
    "takumi": ("sources/takumi/docs/content/docs/",),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def manifest_index(verify=True):
    manifest = json.loads((ROOT / "sources/manifest.json").read_text())
    index = {}
    for source in manifest["sources"]:
        require(source["file_count"] == len(source["files"]), f"Manifest count mismatch: {source['id']}")
        for file in source["files"]:
            path = ROOT / file["path"]
            if verify:
                require(path.is_file(), f"Missing snapshot file: {file['path']}")
                require(hashlib.sha256(path.read_bytes()).hexdigest() == file["sha256"], f"Snapshot hash mismatch: {file['path']}")
            index[file["path"]] = (source, file)
    return manifest, index


def validate_project(project, rows, index):
    require(isinstance(rows, list) and len(rows) == 12, f"{project}: expected 12 questions")
    require({r.get("id") for r in rows} == {f"{project}-{n:02d}" for n in range(1, 13)}, f"{project}: IDs must be unique 01–12")
    require(Counter(r.get("difficulty") for r in rows) == Counter(easy=4, medium=4, hard=4), f"{project}: require 4 easy, 4 medium, 4 hard")
    require(sum(r.get("category") == "false-premise" for r in rows) == 1, f"{project}: require exactly 1 false-premise question")
    require(sum(len({e['path'] for e in r.get('evidence', [])}) >= 2 for r in rows) >= 3, f"{project}: require at least 3 multi-file questions")
    for row in rows:
        label = row["id"]
        require(set(row) == FIELDS, f"{label}: wrong fields: {set(row) ^ FIELDS}")
        require(row["project"] == project, f"{label}: wrong project")
        require(row["category"] in CATEGORIES, f"{label}: invalid category")
        for field in ("product", "version_context", "question", "reference_answer"):
            require(isinstance(row[field], str) and row[field].strip(), f"{label}: empty {field}")
        require(len(row["criteria"]) >= 2, f"{label}: need at least 2 criteria")
        require(row["common_mistakes"], f"{label}: missing common mistakes")
        require(row["evidence"], f"{label}: no evidence")
        evidence_ids = [e["id"] for e in row["evidence"]]
        require(len(set(evidence_ids)) == len(evidence_ids), f"{label}: duplicate evidence IDs")
        for evidence in row["evidence"]:
            require(set(evidence) == {"id", "path", "start_line", "end_line", "quote"}, f"{label}: wrong evidence fields")
            path = evidence["path"]
            require(path in index, f"{label}: {path} missing from snapshot manifest")
            require(path.startswith(SCOPES[project]) and Path(path).suffix in {".md", ".mdx"}, f"{label}: out-of-scope evidence {path}")
            require("/drafts/" not in path and Path(path).name not in {"AGENTS.md", "agent-skills.md"}, f"{label}: draft/instruction evidence")
            lines = (ROOT / path).read_text().splitlines(keepends=True)
            start, end = evidence["start_line"], evidence["end_line"]
            require(type(start) is int and type(end) is int and 1 <= start <= end <= len(lines), f"{label}/{evidence['id']}: invalid line range {start}–{end}")
            require(isinstance(evidence["quote"], str) and evidence["quote"].strip(), f"{label}: empty quote")
            require(evidence["quote"] in "".join(lines[start - 1:end]), f"{label}/{evidence['id']}: quote not verbatim within {path}:{start}–{end}")
        criterion_ids = [c["id"] for c in row["criteria"]]
        require(len(set(criterion_ids)) == len(criterion_ids), f"{label}: duplicate criterion IDs")
        for criterion in row["criteria"]:
            require(set(criterion) == {"id", "description", "weight", "evidence_ids"}, f"{label}: wrong criterion fields")
            require(criterion["description"].strip(), f"{label}: empty criterion")
            require(type(criterion["weight"]) is int and criterion["weight"] in (1, 2), f"{label}: invalid criterion weight")
        for mistake in row["common_mistakes"]:
            require(set(mistake) == {"claim", "correction", "evidence_ids"}, f"{label}: wrong common mistake fields")
            require(mistake["claim"].strip() and mistake["correction"].strip(), f"{label}: empty common mistake")
        for item in row["criteria"] + row["common_mistakes"]:
            require(item["evidence_ids"] and set(item["evidence_ids"]) <= set(evidence_ids), f"{label}: missing/unknown evidence reference")
        for citation in re.findall(r"\[(e\d+)\]", row["reference_answer"]):
            require(citation in evidence_ids, f"{label}: reference answer cites unknown {citation}")
    return sorted(rows, key=lambda r: r["id"])


def enrich(row, index):
    row = json.loads(json.dumps(row))
    for evidence in row["evidence"]:
        source, file = index[evidence["path"]]
        evidence["source_id"] = source["id"]
        evidence["source_commit"] = source["commit"]
        evidence["file_sha256"] = file["sha256"]
        evidence["source_url"] = f"https://github.com/{source['repo']}/blob/{source['commit']}/{quote(file['repo_path'], safe='/')}#L{evidence['start_line']}-L{evidence['end_line']}"
    row["max_points"] = sum(c["weight"] for c in row["criteria"])
    return row


def render_markdown(rows, answers=False):
    title = "Reference answers and grading key — PRIVATE" if answers else "Evaluation questions — public prompts"
    text = [f"# {title}", ""]
    for row in rows:
        text += [f"## {row['id']} — {row['product']}", "", row["question"], "", f"**Scope:** {row['version_context']}", ""]
        if answers:
            text += [f"**Difficulty:** {row['difficulty']} · **Category:** {row['category']}", "", "### Reference answer", "", row["reference_answer"], "", f"### Criteria ({row['max_points']} points)", ""]
            for c in row["criteria"]:
                text.append(f"- **{c['id']} ({c['weight']}):** {c['description']} Evidence: {', '.join(c['evidence_ids'])}.")
            text += ["", "### Common mistakes", ""]
            for mistake in row["common_mistakes"]:
                text.append(f"- Wrong: {mistake['claim']} Correction: {mistake['correction']}")
            text += ["", "### Evidence", ""]
            for e in row["evidence"]:
                text += [f"**{e['id']}:** [{e['path']}:{e['start_line']}–{e['end_line']}]({e['source_url']})", "", "```text", e["quote"], "```", ""]
    return "\n".join(text) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", choices=PROJECTS, help="Validate one draft only; do not compile")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    manifest, index = manifest_index()
    selected = (args.project,) if args.project else PROJECTS
    rows = []
    for project in selected:
        path = ROOT / f"evaluation/drafts/{project}.json"
        draft = json.loads(path.read_text())
        rows += validate_project(project, draft, index)
        print(f"PASS {project}: 12 questions, balanced difficulty, evidence ranges and verbatim quotes verified")
    if args.validate_only or args.project:
        return
    rows = [enrich(row, index) for row in rows]
    public = [{field: row[field] for field in PUBLIC_FIELDS} for row in rows]
    output = ROOT / "evaluation"
    (output / "questions.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in public))
    (output / "answer-key.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    (output / "questions.md").write_text(render_markdown(rows))
    (output / "answer-key.md").write_text(render_markdown(rows, answers=True))
    report = {
        "compiled_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "questions": len(rows),
        "projects": dict(Counter(r["project"] for r in rows)),
        "difficulty": dict(Counter(r["difficulty"] for r in rows)),
        "categories": dict(Counter(r["category"] for r in rows)),
        "multi_file_questions": sum(len({e["path"] for e in r["evidence"]}) >= 2 for r in rows),
        "evidence_excerpts": sum(len(r["evidence"]) for r in rows),
        "criteria": sum(len(r["criteria"]) for r in rows),
        "snapshot_files_verified": len(index),
        "snapshot_manifest_sha256": hashlib.sha256((ROOT / "sources/manifest.json").read_bytes()).hexdigest(),
        "drafts_sha256": {p: hashlib.sha256((output / f"drafts/{p}.json").read_bytes()).hexdigest() for p in PROJECTS},
        "checks": ["all snapshot file hashes", "required fields and counts", "IDs and scope", "difficulty balance", "citation references", "inclusive line ranges", "verbatim quotes"],
        "limitations": ["Automated checks do not establish semantic entailment.", "No application code was executed to test answers.", "Neither Parallel nor Context7 has been queried for this dataset."],
    }
    (output / "validation-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Compiled {len(rows)} prompts and private keys into evaluation/; verified {len(index)} snapshot files")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, FileNotFoundError, json.JSONDecodeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        sys.exit(1)
