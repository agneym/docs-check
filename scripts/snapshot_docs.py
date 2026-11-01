#!/usr/bin/env python3
"""Fetch shallow, sparse official docs; retain no Git metadata or application code."""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    dict(id="react", repo="reactjs/react.dev", ref="main", paths=["src/content"], licenses=["LICENSE-DOCS.md"], website="https://react.dev"),
    dict(id="nextjs", repo="vercel/next.js", ref="v16.4.3", paths=["docs"], licenses=["license.md"], website="https://nextjs.org/docs"),
    dict(id="tanstack-query", repo="TanStack/query", ref="main", paths=["docs"], licenses=["LICENSE"], website="https://tanstack.com/query/latest/docs"),
    dict(id="tanstack-router", repo="TanStack/router", ref="main", paths=["docs"], licenses=["LICENSE"], website="https://tanstack.com/router/latest/docs"),
    dict(id="tanstack-table", repo="TanStack/table", ref="main", paths=["docs"], licenses=["LICENSE"], website="https://tanstack.com/table/latest/docs"),
    dict(id="takumi", repo="kane50613/takumi", ref="master", paths=["docs/content"], licenses=["LICENSE-MIT", "LICENSE-APACHE"], website="https://takumi.kane.tw"),
]
ALLOWED = {".md", ".mdx", ".json", ".yaml", ".yml", ".txt", ".rst"}


def run(*args, cwd=None, input=None):
    return subprocess.run(args, cwd=cwd, input=input, text=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()


def snapshot(spec):
    destination = ROOT / "sources" / spec["id"]
    if destination.exists():
        raise RuntimeError(f"Refusing to overwrite {destination}")
    with tempfile.TemporaryDirectory(prefix="docs-check-") as tmp:
        checkout = Path(tmp) / "repo"
        run("git", "clone", "--depth", "1", "--single-branch", "--no-tags", "--filter=blob:none", "--no-checkout", "--branch", spec["ref"], f"https://github.com/{spec['repo']}.git", str(checkout))
        patterns = "\n".join("/" + p + "/" for p in spec["paths"]) + "\n" + "\n".join("/" + p for p in spec["licenses"]) + "\n"
        run("git", "sparse-checkout", "set", "--no-cone", "--stdin", cwd=checkout, input=patterns)
        run("git", "checkout", cwd=checkout)
        sha = run("git", "rev-parse", "HEAD", cwd=checkout)
        commit_date = run("git", "show", "-s", "--format=%cI", "HEAD", cwd=checkout)
        files = []
        for source in sorted(checkout.rglob("*")):
            relative = source.relative_to(checkout)
            if ".git" in relative.parts or not source.is_file() or source.is_symlink():
                continue
            if source.suffix.lower() not in ALLOWED and relative.as_posix() not in spec["licenses"]:
                continue
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            data = target.read_bytes()
            files.append(dict(path=target.relative_to(ROOT).as_posix(), repo_path=relative.as_posix(), bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
        if not files:
            raise RuntimeError(f"No documentation found for {spec['id']}")
        result = dict(**spec, commit=sha, commit_date=commit_date, file_count=len(files), bytes=sum(f["bytes"] for f in files), files=files)
        print(f"{spec['id']}: {len(files)} files, {result['bytes']:,} bytes @ {sha}", flush=True)
        return result


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(snapshot, SOURCES))
    manifest = dict(created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), method="Depth-1 blob-filtered sparse clone into temporary directories; copy documentation text and licenses only; discard all Git metadata. Embedded documentation code examples are retained, not implementation files.", sources=results)
    (ROOT / "sources" / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
