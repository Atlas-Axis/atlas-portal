"""walk_content_tree — direct atom-tree walker producing AtlasDoc records.

Replaces the legacy `parse_atlas(compose(content_dir))` round trip in the
renderer pipeline. The atom tree is the source of truth — the filesystem
boundary IS the document boundary, so each `content/<...>/document.md`
file maps to exactly one `AtlasDoc`.

This deliberately diverges from the legacy `parse_atlas(monolith)` path
in cases where an atom's body contains heading-shaped lines inside a
fenced code block (e.g. `# Constants` inside a Python snippet inside a
Reference Implementation Core). The legacy line-based scan emits a
spurious pseudo-doc (uuid=None) for each such line; this walker correctly
treats the body as one document because the file is one document.

The legacy `parse_atlas(monolith)` path is intentionally preserved
elsewhere — pre-cutover comments anchored to monolith line numbers must
keep resolving the same way (the monolith path has no document boundaries,
so line scanning is the only available signal).

Ordering, heading-level computation, and heading-line construction reuse
the existing helpers from `compose.py` so the emitted AtlasDoc list
matches `compose()`'s emit order doc-for-doc (minus pseudo-docs).

Two input adapters are provided:

* `walk_content_tree(content_dir)` — filesystem-based; used by the CLI
  and by tests that fabricate `content/` trees on disk.
* `walk_content_tree_from_tar_stream(stream)` — in-memory tar-stream
  parser; used by the web app's render path so a 10K-file `content/`
  tree never lands on disk during a render. The atomic-atlas tree
  contains ~10K small files, and `tarfile.extractall` on that input is
  the dominant cost in cold render (per the May 2026 perf diagnostic).
  Streaming through `tarfile.open(mode='r|*')` and parsing in-memory
  drops the extract step from ~5s to <1s.
"""

from __future__ import annotations

import io
import os
import tarfile
from pathlib import Path
from typing import IO, Optional

from .compose import (
    ParsedDoc,
    _parse_targets_value,
    _unquote_yaml_name,
    build_heading_line,
    compute_heading_levels,
    find_all_documents,
    _child_sort_key,
)
from .parser import AtlasDoc, DOC_TITLE_RE


def _atlas_doc_from_parsed(
    parsed: ParsedDoc,
    level: int,
) -> AtlasDoc:
    """Build a single AtlasDoc from a ParsedDoc and its computed heading level.

    Field mapping:
      - level, number, name, doc_type, uuid: from frontmatter
      - heading_line: built via the same `build_heading_line` helper that
        compose() uses, so it's byte-identical to the heading line in the
        composed monolith
      - body: the file content as-is (joined ParsedDoc.content_lines), NOT
        re-parsed for headings — every heading-shaped line stays inside the
        body where it belongs
      - line_start / line_end: per-atom 1-indexed offsets covering the whole
        body. They no longer have monolith-relative meaning because we
        skip the compose round trip; downstream renderer/diff code uses
        these for the per-doc surface only (rendering, comment anchoring
        on atom paths, etc.)
    """
    body = "\n".join(parsed.content_lines)
    body_line_count = len(parsed.content_lines)
    # heading is line 1, body lines follow; line_end = number of lines
    # the doc occupies in its own file (heading + body). Per the plan
    # these are file-local, not monolith-local.
    line_start = 1
    line_end = max(1 + body_line_count, line_start)

    name = parsed.name
    doc_type = parsed.doc_type
    number = parsed.doc_no

    # Sanity check: the title we'd build from frontmatter parses with the
    # same regex used by parse_atlas. We don't actually need to round-trip
    # through the regex (we have the structured fields), but if a future
    # frontmatter exposes a name with bracket characters we want to know.
    title_text = f"{number} - {name} [{doc_type}]"
    if not DOC_TITLE_RE.match(title_text):
        # Don't fail — match the legacy parse_atlas behavior of accepting
        # whatever's in the title. The doc still gets emitted.
        pass

    return AtlasDoc(
        level=level,
        number=number,
        name=name,
        doc_type=doc_type,
        uuid=parsed.uuid,
        heading_line=build_heading_line(parsed, level),
        body=body.strip(),
        line_start=line_start,
        line_end=line_end,
    )


def walk_content_tree(content_dir: str | os.PathLike) -> list[AtlasDoc]:
    """Walk the decomposed Atlas content tree and emit one AtlasDoc per file.

    Args:
        content_dir: path to the `content/` directory at the root of a
            decomposed Atlas tree (the same input shape `compose()` accepts).

    Returns:
        List of AtlasDoc records, one per `document.md` file under
        `content_dir`. Order matches `compose()`'s emission order:
        depth-first walk of `content/A/`, with NRs emitted immediately
        after their target document. `_index.md` files are skipped.

    Properties guaranteed:
      - `len(walk_content_tree(d)) == len(list(Path(d).rglob('document.md')))`
        — exactly one AtlasDoc per atom file.
      - Every returned AtlasDoc has `uuid` populated from the file's
        frontmatter `id` field. No `uuid=None` pseudo-docs.
      - `body` is taken verbatim from the file (no re-parsing for headings).
    """
    content_root = str(content_dir)

    docs = find_all_documents(content_root)
    document_folders = {d.folder_path for d in docs}

    # Discover the full folder set (including phantom folders with no
    # document.md) so the in-memory tree walk matches what os.walk would
    # have seen.
    folder_set: set[tuple[str, ...]] = {()}
    for root, dirs, _files in os.walk(content_root):
        rel = os.path.relpath(root, content_root)
        if rel == ".":
            base: tuple[str, ...] = ()
        else:
            base = tuple(rel.split(os.sep))
        folder_set.add(base)
        for d in dirs:
            folder_set.add(base + (d,))

    return _atlas_docs_from_parsed_docs(
        docs,
        document_folders=document_folders,
        folder_set=folder_set,
    )


def _parse_document_md_from_bytes(
    blob: bytes, folder_path: tuple[str, ...]
) -> Optional[ParsedDoc]:
    """In-memory ParsedDoc constructor — mirrors compose.parse_document_md.

    Returns None if the blob doesn't look like a well-formed document.md
    file (missing frontmatter delimiter, missing required keys, etc.).
    The caller treats None the same as "no document at this folder".

    We re-implement the key parsing here instead of importing
    `parse_document_md` because that helper raises on malformed input;
    the streaming path's tar parser is best-effort — a single corrupt
    file shouldn't fail the whole render. Logging a warning and skipping
    matches the spirit of `find_all_documents` (which silently skips
    unreadable files via `os.walk` quirks).
    """
    try:
        text = blob.decode("utf-8")
    except UnicodeDecodeError:
        return None

    lines = text.split("\n")
    if not lines or lines[0] != "---":
        return None
    try:
        end_fm = lines.index("---", 1)
    except ValueError:
        return None

    fm: dict[str, str] = {}
    for fl in lines[1:end_fm]:
        if ":" not in fl:
            continue
        key, _, val = fl.partition(":")
        fm[key.strip()] = val.strip()

    required = ("id", "docNo", "name", "type", "depth", "childType")
    if any(k not in fm for k in required):
        return None

    targets: list[str] = []
    if "targets" in fm:
        try:
            targets = _parse_targets_value(fm["targets"])
        except ValueError:
            return None

    post = lines[end_fm + 1:]
    idx = 0
    while idx < len(post) and post[idx] == "":
        idx += 1
    if idx >= len(post):
        content_lines: list[str] = []
    else:
        # idx points at the heading line; content starts after it.
        content_lines = post[idx + 1:]

    try:
        depth = int(fm["depth"])
    except ValueError:
        return None

    return ParsedDoc(
        folder_path=folder_path,
        uuid=fm["id"],
        doc_no=fm["docNo"],
        name=_unquote_yaml_name(fm["name"]),
        doc_type=fm["type"],
        depth=depth,
        child_type=fm["childType"],
        targets=targets,
        content_lines=content_lines,
    )


def walk_content_tree_from_tar_stream(
    stream: IO[bytes],
    *,
    archive_prefix: str = "content/",
) -> list[AtlasDoc]:
    """Stream-parse a tar archive of the `content/` tree into AtlasDocs.

    Args:
        stream: a binary file-like object yielding tar bytes (e.g.
            `subprocess.Popen(['git', 'archive', ref, '--', 'content']).stdout`).
        archive_prefix: the leading directory inside the tar that
            corresponds to the content root. `git archive <ref> -- content`
            emits paths starting with `content/`; pass `""` to walk a tar
            whose entries are already rooted at the content directory.

    Returns:
        Same shape as `walk_content_tree(content_dir)` — one AtlasDoc per
        `document.md` blob in the stream, in compose() emit order.

    Streaming guarantees:
      - The stream is consumed exactly once via `tarfile.open(mode='r|*')`.
      - No filesystem extraction happens — `document.md` payloads land in
        a Python dict and `_index.md`/non-document entries are skipped.
      - Memory footprint is dominated by the parsed `document.md` blobs
        (~25 MB for the current 10K-file Atlas tree); the original tar
        bytes are not retained after streaming.

    The function preserves every property of the filesystem-based walker:
      - exactly one AtlasDoc per `document.md` entry
      - every doc has a non-null UUID
      - body taken verbatim
      - emit order matches `compose()` doc-for-doc
    """
    # Map folder_path -> raw document.md bytes; folder_set tracks every
    # ancestor folder we observe (needed for heading-level computation
    # which counts ancestors that have document.md, and for sibling
    # ordering which needs to know what subfolders exist).
    document_blobs: dict[tuple[str, ...], bytes] = {}
    folder_set: set[tuple[str, ...]] = {()}

    prefix = archive_prefix.strip("/")

    with tarfile.open(fileobj=stream, mode="r|*") as tf:
        for member in tf:
            if not member.isfile():
                continue
            name = member.name.replace("\\", "/")
            # Strip leading prefix; a path that doesn't start with
            # the prefix is from outside content/ — skip it.
            if prefix:
                stripped = (
                    name[len(prefix) + 1:]
                    if name.startswith(prefix + "/")
                    else None
                )
                if stripped is None:
                    continue
            else:
                stripped = name

            parts = tuple(p for p in stripped.split("/") if p)
            if not parts:
                continue
            filename = parts[-1]
            folder_path = parts[:-1]

            # Record every ancestor folder, regardless of whether a
            # document.md lives at that level. compute_heading_levels needs
            # the folder set to walk ancestors.
            for i in range(len(folder_path) + 1):
                folder_set.add(folder_path[:i])

            if filename != "document.md":
                # _index.md and any other artifacts are intentionally skipped.
                continue

            f = tf.extractfile(member)
            if f is None:
                continue
            document_blobs[folder_path] = f.read()

    # Parse each document.md blob -> ParsedDoc.
    docs: list[ParsedDoc] = []
    for folder_path, blob in document_blobs.items():
        parsed = _parse_document_md_from_bytes(blob, folder_path)
        if parsed is not None:
            docs.append(parsed)

    return _atlas_docs_from_parsed_docs(
        docs,
        document_folders=set(document_blobs.keys()),
        folder_set=folder_set,
    )


def _atlas_docs_from_parsed_docs(
    docs: list[ParsedDoc],
    *,
    document_folders: set[tuple[str, ...]],
    folder_set: set[tuple[str, ...]],
) -> list[AtlasDoc]:
    """Shared emit logic for both walker entrypoints.

    Re-implements `compute_heading_levels` and `_child_sort_key` against
    in-memory folder data so it can be used without filesystem access.
    The compose helpers (`build_heading_line`, NR ordering rules) are
    reused verbatim.
    """
    by_uuid = {d.uuid: d for d in docs}
    by_folder = {d.folder_path: d for d in docs}

    # In-memory equivalent of compute_heading_levels.
    levels: dict[str, int] = {}

    def level_of(doc: ParsedDoc) -> int:
        if doc.uuid in levels:
            return levels[doc.uuid]
        if doc.doc_no.startswith("NR-"):
            if not doc.targets:
                lv = 1
            else:
                target = by_uuid.get(doc.targets[0])
                lv = 1 if target is None else min(level_of(target) + 1, 6)
        else:
            count = 0
            for i in range(1, len(doc.folder_path)):
                if doc.folder_path[:i] in document_folders:
                    count += 1
            lv = min(count + 1, 6)
        levels[doc.uuid] = lv
        return lv

    for d in docs:
        level_of(d)

    # Build child index for sibling traversal.
    children_by_parent: dict[tuple[str, ...], list[str]] = {}
    for fp in folder_set:
        if not fp:
            continue
        parent = fp[:-1]
        children_by_parent.setdefault(parent, []).append(fp[-1])

    def child_sort_key(parent: tuple[str, ...], child_name: str):
        # Mirror compose._child_sort_key but using folder_set instead of
        # filesystem stats.
        full_child = parent + (child_name,)
        has_doc = full_child in document_folders
        if child_name.isdigit():
            return (0 if has_doc else 1, int(child_name), child_name)
        return (2, 0, child_name)

    # NR grouping — same logic as compose / filesystem walker.
    nr_by_target: dict[str, list[ParsedDoc]] = {}
    orphan_nrs: list[ParsedDoc] = []
    for d in docs:
        if not d.doc_no.startswith("NR-"):
            continue
        if d.targets and d.targets[0] in by_uuid:
            nr_by_target.setdefault(d.targets[0], []).append(d)
        else:
            orphan_nrs.append(d)
    for k in nr_by_target:
        nr_by_target[k].sort(key=lambda nr: int(nr.doc_no.split("-")[1]))
    orphan_nrs.sort(key=lambda nr: int(nr.doc_no.split("-")[1]))

    output: list[AtlasDoc] = []
    emitted: set[str] = set()

    def emit_doc(d: ParsedDoc) -> None:
        if d.uuid in emitted:
            return
        emitted.add(d.uuid)
        output.append(_atlas_doc_from_parsed(d, levels[d.uuid]))
        for nr in nr_by_target.get(d.uuid, []):
            emit_doc(nr)

    def visit_folder(folder_path: tuple[str, ...]) -> None:
        d = by_folder.get(folder_path)
        if d is not None and not d.doc_no.startswith("NR-"):
            emit_doc(d)
        children = children_by_parent.get(folder_path, [])
        children.sort(key=lambda c: child_sort_key(folder_path, c))
        for child in children:
            visit_folder(folder_path + (child,))

    visit_folder(("A",))

    for nr in orphan_nrs:
        emit_doc(nr)

    return output


def read_uuid_from_frontmatter(file_text: str) -> Optional[str]:
    """Extract the `id` UUID from a document.md file's YAML frontmatter.

    Used by the path-aware UUID resolver when the comment path is an atom
    path (`content/<...>/document.md`) — the file IS the document, so the
    line argument is irrelevant; we just need the UUID off the frontmatter.

    Returns None if the input doesn't look like a document.md file (no
    leading frontmatter delimiter, or no `id:` key).
    """
    if not file_text:
        return None
    lines = file_text.split("\n")
    if not lines or lines[0] != "---":
        return None
    try:
        end_fm = lines.index("---", 1)
    except ValueError:
        return None
    for fl in lines[1:end_fm]:
        if ":" not in fl:
            continue
        key, _, val = fl.partition(":")
        if key.strip() == "id":
            uuid = val.strip()
            return uuid or None
    return None


def is_atom_path(path: str) -> bool:
    """True if `path` looks like a decomposed-tree atom path.

    Atom paths are `content/<segments>/document.md`. Used by the resolver
    to dispatch between the O(1) frontmatter lookup (atom paths) and the
    legacy line-based scan (monolith paths).
    """
    if not path:
        return False
    # Normalize Windows-style separators just in case.
    p = path.replace("\\", "/")
    return p.startswith("content/") and p.endswith("/document.md")
