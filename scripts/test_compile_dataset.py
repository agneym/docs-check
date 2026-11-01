#!/usr/bin/env python3
"""Regression tests for mechanical dataset checks; no network or model calls."""
from collections import Counter
import copy
import hashlib
import json
from pathlib import Path
import unittest

import compile_dataset as compiler


class DatasetValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest, cls.index = compiler.manifest_index()
        cls.rows = json.loads((compiler.ROOT / "evaluation/drafts/react.json").read_text())

    def reject_change(self, change):
        rows = copy.deepcopy(self.rows)
        change(rows)
        with self.assertRaises(ValueError):
            compiler.validate_project("react", rows, self.index)

    def test_all_drafts(self):
        for project in compiler.PROJECTS:
            with self.subTest(project=project):
                rows = json.loads((compiler.ROOT / f"evaluation/drafts/{project}.json").read_text())
                self.assertEqual(len(compiler.validate_project(project, rows, self.index)), 12)

    def test_rejects_changed_quote(self):
        self.reject_change(lambda rows: rows[0]["evidence"][0].update(quote="DELIBERATELY INVALID QUOTE"))

    def test_rejects_out_of_bounds_lines(self):
        self.reject_change(lambda rows: rows[0]["evidence"][0].update(end_line=999999))

    def test_rejects_unknown_citation(self):
        self.reject_change(lambda rows: rows[0]["criteria"][0].update(evidence_ids=["unknown"]))

    def test_rejects_duplicate_question_ids(self):
        self.reject_change(lambda rows: rows[1].update(id=rows[0]["id"]))

    def test_rejects_unbalanced_difficulty(self):
        self.reject_change(lambda rows: rows[0].update(difficulty="hard"))

    def test_rejects_out_of_scope_source(self):
        self.reject_change(lambda rows: rows[0]["evidence"][0].update(path="sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx"))

    def test_public_prompts_do_not_include_keys(self):
        rows = [json.loads(line) for line in (compiler.ROOT / "evaluation/questions.jsonl").read_text().splitlines()]
        self.assertEqual(len(rows), 48)
        self.assertEqual(len({r["id"] for r in rows}), 48)
        for row in rows:
            self.assertEqual(set(row), set(compiler.PUBLIC_FIELDS))

    def test_compiled_artifacts_match_drafts(self):
        rows = []
        for project in compiler.PROJECTS:
            draft = json.loads((compiler.ROOT / f"evaluation/drafts/{project}.json").read_text())
            rows.extend(compiler.validate_project(project, draft, self.index))
        enriched = [compiler.enrich(row, self.index) for row in rows]
        output = compiler.ROOT / "evaluation"
        self.assertEqual(json.loads((output / "answer-key.json").read_text()), enriched)
        public = [{field: row[field] for field in compiler.PUBLIC_FIELDS} for row in enriched]
        actual_public = [json.loads(line) for line in (output / "questions.jsonl").read_text().splitlines()]
        self.assertEqual(actual_public, public)
        self.assertEqual((output / "questions.md").read_text(), compiler.render_markdown(enriched))
        self.assertEqual((output / "answer-key.md").read_text(), compiler.render_markdown(enriched, answers=True))

    def test_validation_report_matches_current_dataset(self):
        output = compiler.ROOT / "evaluation"
        rows = json.loads((output / "answer-key.json").read_text())
        report = json.loads((output / "validation-report.json").read_text())
        self.assertEqual(report["questions"], len(rows))
        self.assertEqual(report["projects"], dict(Counter(row["project"] for row in rows)))
        self.assertEqual(report["difficulty"], dict(Counter(row["difficulty"] for row in rows)))
        self.assertEqual(report["categories"], dict(Counter(row["category"] for row in rows)))
        self.assertEqual(report["criteria"], sum(len(row["criteria"]) for row in rows))
        self.assertEqual(report["evidence_excerpts"], sum(len(row["evidence"]) for row in rows))
        self.assertEqual(report["multi_file_questions"], sum(len({e["path"] for e in row["evidence"]}) >= 2 for row in rows))
        self.assertEqual(report["snapshot_files_verified"], len(self.index))
        manifest_hash = hashlib.sha256((compiler.ROOT / "sources/manifest.json").read_bytes()).hexdigest()
        self.assertEqual(report["snapshot_manifest_sha256"], manifest_hash)
        for project in compiler.PROJECTS:
            draft_hash = hashlib.sha256((output / f"drafts/{project}.json").read_bytes()).hexdigest()
            self.assertEqual(report["drafts_sha256"][project], draft_hash)

    def test_snapshots_have_no_git_or_implementation_files(self):
        sources = compiler.ROOT / "sources"
        self.assertFalse(list(sources.rglob(".git")))
        implementation_extensions = {".js", ".jsx", ".ts", ".tsx", ".rs", ".wasm"}
        self.assertFalse([p for p in sources.rglob("*") if p.is_file() and p.suffix in implementation_extensions])


if __name__ == "__main__":
    unittest.main()
