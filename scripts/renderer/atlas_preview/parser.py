"""Atlas document parsing — dataclass, regex patterns, and parse/query functions."""

import re
from dataclasses import dataclass, field
from typing import Optional


HEADING_RE = re.compile(r'^(#{1,6})\s+(.+?)(?:\s*<!--\s*UUID:\s*(\S+)\s*-->)?\s*$')
DOC_TITLE_RE = re.compile(r'^([\w.]+)\s*-\s*(.+?)\s*\[(\w[\w\s]*)\]$')
# Matches cross-reference display text: [A.x.x.x - Name](UUID)
# Also handles bold variants like [**A.x.x.x - Name**](UUID)
XREF_NUMBER_RE = re.compile(r'\[(\*{0,2})([A-Z][\d.]+)\s*-\s*([^\]]+?)\1\]\(([^)]+)\)')


def normalize_body(text: str) -> str:
    """Strip document numbers from cross-reference display text for comparison.

    Converts [A.2.2.8.1 - Name](UUID) -> [Name](UUID) so that renumbering
    of referenced documents doesn't count as a substantive change.
    Also handles [**A.2.2.8.1 - Name**](UUID) -> [**Name**](UUID).
    Normalizes non-breaking spaces to regular spaces (common in Atlas source).
    """
    text = text.replace('\xa0', ' ')
    return XREF_NUMBER_RE.sub(r'[\1\3\1](\4)', text)


@dataclass
class AtlasDoc:
    """A single Atlas document (heading + body)."""
    level: int
    number: str
    name: str
    doc_type: str
    uuid: Optional[str]
    heading_line: str
    body: str
    line_start: int
    line_end: int
    children: list = field(default_factory=list)
    parent_uuid: Optional[str] = None


def parse_atlas(text: str) -> list[AtlasDoc]:
    """Parse Atlas markdown into a flat list of AtlasDoc objects."""
    lines = text.split('\n')
    docs = []
    current = None

    for i, line in enumerate(lines):
        m = HEADING_RE.match(line)
        if m:
            # Save previous doc
            if current:
                current.body = '\n'.join(lines[current.line_start + 1:i]).strip()
                current.line_end = i - 1
                docs.append(current)

            level = len(m.group(1))
            title_text = m.group(2).strip()
            uuid = m.group(3)

            # Parse document number, name, type from title
            tm = DOC_TITLE_RE.match(title_text)
            if tm:
                number, name, doc_type = tm.group(1), tm.group(2), tm.group(3)
            else:
                number, name, doc_type = "", title_text, ""

            current = AtlasDoc(
                level=level, number=number, name=name, doc_type=doc_type,
                uuid=uuid, heading_line=line.strip(), body="",
                line_start=i, line_end=i
            )

    # Last doc
    if current:
        current.body = '\n'.join(lines[current.line_start + 1:]).strip()
        current.line_end = len(lines) - 1
        docs.append(current)

    return docs


def find_doc_by_uuid(docs: list[AtlasDoc], uuid: str) -> Optional[AtlasDoc]:
    """Find a doc by UUID."""
    for doc in docs:
        if doc.uuid == uuid:
            return doc
    return None


def find_doc_by_number(docs: list[AtlasDoc], number: str) -> Optional[AtlasDoc]:
    """Find a doc by document number."""
    for doc in docs:
        if doc.number == number:
            return doc
    return None


def find_ancestor_docs(doc: AtlasDoc, all_docs: list[AtlasDoc]) -> list[AtlasDoc]:
    """Find all ancestor docs for a given doc (for context)."""
    ancestors = []
    if not doc.number:
        return ancestors
    parts = doc.number.split('.')
    for i in range(1, len(parts)):
        parent_num = '.'.join(parts[:i])
        parent = find_doc_by_number(all_docs, parent_num)
        if parent:
            ancestors.append(parent)
    return ancestors


def assign_parent_uuids(docs: list[AtlasDoc]) -> None:
    """Populate parent_uuid on each doc based on the number hierarchy.

    For doc A.1.2.3, the parent is the doc with number A.1.2 in this
    version.  Walks up number segments to handle Active Data numbering
    (e.g. X.0.6.1 whose parent is X).  The relationship is recorded as
    a UUID link so it survives renumbering across versions.
    """
    num_to_doc = {d.number: d for d in docs if d.number}
    for doc in docs:
        doc.parent_uuid = None
        if not doc.number:
            continue
        parts = doc.number.split('.')
        for i in range(len(parts) - 1, 0, -1):
            parent_num = '.'.join(parts[:i])
            parent = num_to_doc.get(parent_num)
            if parent and parent.uuid:
                doc.parent_uuid = parent.uuid
                break


def build_hierarchy(docs: list[AtlasDoc]) -> list[AtlasDoc]:
    """Build a tree from a flat list of docs using UUID parent-child links.

    Uses parent_uuid (populated by assign_parent_uuids) for structure.
    Falls back to number-based parent lookup if parent_uuid is not set.
    """
    # Ensure parent UUIDs are assigned
    assign_parent_uuids(docs)

    # Sort by document number
    docs = sorted(docs, key=lambda d: [int(x) if x.isdigit() else x for x in d.number.split('.')] if d.number else [])

    roots = []
    uuid_to_doc = {d.uuid: d for d in docs if d.uuid}

    for doc in docs:
        doc.children = []  # Reset

    for doc in docs:
        if not doc.number:
            roots.append(doc)
            continue
        # Use UUID-based parent link
        if doc.parent_uuid and doc.parent_uuid in uuid_to_doc:
            uuid_to_doc[doc.parent_uuid].children.append(doc)
        else:
            roots.append(doc)

    return roots
