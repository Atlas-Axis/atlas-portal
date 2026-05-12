#!/usr/bin/env python3
"""generate.py — build scope_data JSON for an Atlas Edit Proposal diff.

Inputs:
    --base-content-dir   path to the base version's content/ directory
    --head-content-dir   path to the head version's content/ directory
    --branch             head branch name (e.g. "proposal/2026-05-11")
    --base-ref           base ref name (e.g. "main")
    --repo               public repo identifier (e.g. "sky-ecosystem/next-gen-atlas")
    --pr-number          PR number on the public repo (optional)
    --pr-title           PR title (optional; falls back to a humanized branch name)
    --output             path to write the scope_data JSON

Usage from atlas-portal's build pipeline:
    python3 scripts/renderer/generate.py \\
        --base-content-dir /tmp/base/content \\
        --head-content-dir /tmp/head/content \\
        --branch proposal/2026-05-11 \\
        --base-ref main \\
        --repo sky-ecosystem/next-gen-atlas \\
        --pr-number 242 \\
        --pr-title "May 11 Atlas Edit Cycle" \\
        --output /tmp/scope-data.json

Exit codes:
    0  on success
    1  on invalid input (missing dir, missing argument)
    2  on rendering failure
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Ensure the package is importable when invoked as a script.
sys.path.insert(0, str(Path(__file__).parent))

from atlas_preview.renderer import build_scope_data  # noqa: E402
from atlas_preview.walk_content_tree import walk_content_tree  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build scope_data JSON for an Atlas Edit Proposal diff.",
    )
    parser.add_argument("--base-content-dir", required=True,
                        help="Path to the base version's content/ directory.")
    parser.add_argument("--head-content-dir", required=True,
                        help="Path to the head version's content/ directory.")
    parser.add_argument("--branch", required=True,
                        help="Head branch name.")
    parser.add_argument("--base-ref", required=True,
                        help="Base ref name (e.g. 'main').")
    parser.add_argument("--repo", required=True,
                        help="Public repo identifier, e.g. 'sky-ecosystem/next-gen-atlas'.")
    parser.add_argument("--pr-number", type=int, default=None,
                        help="PR number on the public repo (optional).")
    parser.add_argument("--pr-title", default=None,
                        help="PR title (optional; falls back to humanized branch name).")
    parser.add_argument("--output", required=True,
                        help="Path to write the scope_data JSON.")
    args = parser.parse_args()

    base_dir = args.base_content_dir
    head_dir = args.head_content_dir

    if not os.path.isdir(base_dir):
        print(f"error: --base-content-dir not a directory: {base_dir}", file=sys.stderr)
        return 1
    if not os.path.isdir(head_dir):
        print(f"error: --head-content-dir not a directory: {head_dir}", file=sys.stderr)
        return 1

    try:
        base_docs = walk_content_tree(base_dir)
        head_docs = walk_content_tree(head_dir)
    except Exception as exc:  # pragma: no cover — defensive
        print(f"error: failed to walk content trees: {exc}", file=sys.stderr)
        return 2

    if not base_docs:
        print(f"error: base content tree produced 0 AtlasDocs at {base_dir}", file=sys.stderr)
        return 2
    if not head_docs:
        print(f"error: head content tree produced 0 AtlasDocs at {head_dir}", file=sys.stderr)
        return 2

    try:
        scope_data = build_scope_data(
            head_docs, base_docs,
            branch=args.branch,
            base=args.base_ref,
            repo_str=args.repo,
            pr_number=args.pr_number,
            pr_title=args.pr_title,
        )
    except Exception as exc:  # pragma: no cover — defensive
        print(f"error: build_scope_data failed: {exc}", file=sys.stderr)
        return 2

    output_path = args.output
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(scope_data, f, ensure_ascii=False)

    # Brief summary on stderr for build logs.
    stats = scope_data.get("stats", {})
    scopes = scope_data.get("scopes", {})
    print(
        f"scope_data: {len(scopes)} scope(s), {stats.get('modified', 0)} edited, "
        f"{stats.get('new', 0)} new, {stats.get('removed', 0)} removed, "
        f"{stats.get('renumbered', 0)} renumbered. Written to {output_path}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
