"""One entry point that yields the composed Atlas from EITHER layout.

Vendored counterpart of `sync/atlas_source.py` + the reassembly half of
`sync/decompose_multi.py` in the Atlas repo (branch
`infra/option-c-split-composer`). The decomposition half is deliberately NOT
vendored — atlas-portal only ever reads.

⭐ THIS IS THE WHOLE BACKWARD-COMPATIBILITY STRATEGY, AND IT IS DELIBERATELY SMALL.
De-atomization ("Option C") replaces the ~11,300-file `content/` tree with ~16
composed markdown files — one per top-level Scope (`A.0`–`A.6`) plus one per agent
artifact (`A.6.1.1.1` Spark … `A.6.1.1.8`, and `A.6.1.2`, the Executor list, which
travels with its own children). Every consumer wants exactly one thing: the composed
Atlas markdown for a given checkout. Answer that here and nothing downstream carries
a migration flag.

⛔ DETECTION IS EXPLICIT AND FAILS LOUD. The pre-existing implicit signal — a walk
that finds no `document.md` and returns `[]` — is *silently* interpreted downstream
as "pre-cutover ref". That sentinel is doing load-bearing work by accident:
post-cutover it is also what an EMPTY or BROKEN checkout produces, so a genuine
failure and an old ref become indistinguishable. `detect_layout` raises on ambiguity
rather than guessing.
"""

from __future__ import annotations

import os
import re

from .compose import compose

ATOMIZED = "atomized"
CONSOLIDATED = "consolidated"


class LayoutError(RuntimeError):
    """The checkout matches neither layout, or matches both."""


# ---------------------------------------------------------------------------
# Bucket filenames and order
# ---------------------------------------------------------------------------

# Mirror of `partition.FILENAME_RE`. A consolidated file is named
# `<docNo> - <slug>.md`, e.g. `A.6.1.1.1 - Spark.md`.
FILENAME_RE = re.compile(r"^(A(?:\.\d+)*) - .*\.md$")


def bucket_from_filename(fname: str) -> str | None:
    """Recover a bucket's doc number from its filename, or None if not a bucket file."""
    m = FILENAME_RE.match(fname)
    return m.group(1) if m else None


def order_key(bucket: str) -> tuple[int, ...]:
    """Sort key placing buckets in composed-Atlas order. Deterministic, no stored list.

    Buckets are doc numbers, so their integer-segment tuple IS their position: a
    prefix sorts before its extensions (`A.6` before `A.6.1.1.1`) and segment-wise
    comparison puts `A.6.1.1.8` before `A.6.1.2` because 1 < 2 at the third segment.

    ⛔ DO NOT SUBSTITUTE FILENAME SORTING. It agrees today and diverges the moment a
    tenth Star is added: lexicographically `A.6.1.1.10` sorts between `A.6.1.1.1` and
    `A.6.1.1.2`, silently reordering ~2,000 documents with no error raised anywhere.
    Sky expects to keep onboarding agents, so this is a matter of when, not if.
    """
    return tuple(int(s) for s in bucket.split(".")[1:])


def _bucket_files_in(root: str) -> dict[str, str]:
    """The consolidated bucket files in `root`, keyed by doc number."""
    try:
        names = sorted(os.listdir(root))
    except OSError:
        return {}
    buckets: dict[str, str] = {}
    for fname in names:
        if not os.path.isfile(os.path.join(root, fname)):
            continue
        b = bucket_from_filename(fname)
        if b is None:
            continue
        if b in buckets:
            raise LayoutError(
                f"two files claim bucket {b!r}: {buckets[b]!r} and {fname!r}"
            )
        buckets[b] = fname
    return buckets


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

def detect_layout(root: str) -> str:
    """Classify a checkout's Atlas content as atomized or consolidated.

    `root` is the directory that CONTAINS the layout — the `content/` dir itself
    under the atomized tree, or the directory holding the composed bucket files
    under the consolidated one. Use `resolve_atlas_root` first if you hold a repo
    root.
    """
    if not os.path.isdir(root):
        raise LayoutError(f"{root!r} is not a directory")

    has_buckets = bool(_bucket_files_in(root))
    # The atomized tree is identified by its root scope document, not by a
    # recursive scan — a recursive "is there any document.md anywhere" is both slow
    # and true of a partially written tree.
    has_atom_root = os.path.isfile(os.path.join(root, "A", "0", "document.md"))

    if has_buckets and has_atom_root:
        raise LayoutError(
            f"{root!r} contains BOTH consolidated Atlas files and an atomized content "
            "tree. This is almost certainly a half-finished migration — refusing to guess."
        )
    if has_buckets:
        return CONSOLIDATED
    if has_atom_root:
        return ATOMIZED

    raise LayoutError(
        f"{root!r} matches neither Atlas layout: no consolidated "
        '"<docNo> - <name>.md" files and no A/0/document.md. An empty or truncated '
        "checkout reaches here; it must NOT be treated as a pre-cutover ref, which is "
        "what an empty walk result used to imply."
    )


# ---------------------------------------------------------------------------
# Reassembly (consolidated → composed markdown)
# ---------------------------------------------------------------------------

def reassemble(input_dir: str) -> str:
    """Rebuild the single composed markdown stream from the consolidated files.

    ⭐ NO MANIFEST, BY DESIGN. Every bucket is contiguous in emit order, so the only
    thing reassembly needs is the ORDER of the buckets — and bucket names ARE doc
    numbers, so `order_key` derives it. Nothing is stored, so nothing can go stale,
    nothing conflicts when two edit branches touch different scopes, and onboarding a
    new Star requires no configuration anywhere.

    The messy part of Atlas ordering (real children before phantom extension folders,
    which diverges from naive doc-number sorting in ~410 places) lives entirely WITHIN
    a bucket, already frozen into that file's line order. It is never re-derived.
    """
    buckets = _bucket_files_in(input_dir)
    if not buckets:
        raise LayoutError(f"no Atlas bucket files found in {input_dir!r}")

    out: list[str] = []
    for bucket in sorted(buckets, key=order_key):
        with open(os.path.join(input_dir, buckets[bucket]), "r", encoding="utf-8") as f:
            out.extend(f.read().split("\n"))
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def resolve_atlas_root(root: str) -> str:
    """Resolve a caller-supplied path to the directory that holds the Atlas layout.

    Accepts a repo root (which nests the Atlas under `content/`) or the content
    directory itself, which is what every existing call site already passes.
    """
    nested = os.path.join(root, "content")
    return nested if os.path.isdir(nested) else root


def load_composed(root: str) -> str:
    """The composed Atlas markdown for this checkout, whichever layout it is in."""
    layout = detect_layout(root)
    return compose(root) if layout == ATOMIZED else reassemble(root)
