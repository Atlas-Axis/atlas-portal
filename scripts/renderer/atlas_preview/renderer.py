"""Scope-data builder for Atlas edit proposals.

This is the public-clean subset of the upstream renderer: scope detection,
scope-tree building, per-document diff HTML, and final JSON shape.

It deliberately omits:
  - the full review-chrome HTML emitter (`render_doc_html`, page templates)
  - research-note rendering and discovery (`find_research_note`,
    `render_research_note`) — research notes are internal artifacts
  - CLI / serve-mode entry points
  - any review-app coupling (no `gh pr view`, no API key env vars)
"""

import difflib
import html
import re

from .compose import find_all_documents as _fs_find_all_documents
from .diff import word_diff
from .parser import (
    AtlasDoc,
    assign_parent_uuids,
    find_ancestor_docs,
    find_doc_by_number,
    find_doc_by_uuid,
    normalize_body,
)


# ---------------------------------------------------------------------------
# Inline formatting helpers
# ---------------------------------------------------------------------------

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)


def _rewrite_link(match: 're.Match[str]') -> str:
    """Rewrite a markdown link to HTML.

    Atlas cross-references use the form [Doc Name](uuid). The UUID identifies
    the target document. We emit a server-side default href pointing to the
    Atlas viewer (https://sky-atlas.io/#<uuid>) with target="_blank" so that
    no-JS clients get a sensible navigation. Client-side script on the
    proposal page upgrades in-page cross-references to a smooth-scroll + flash
    handler so that links to docs on the current proposal stay in-page.

    External URLs (http://, https://) are passed through with target="_blank"
    + rel="noopener" so they open in a new tab. Other hrefs are left as-is.
    """
    text, href = match.group(1), match.group(2)
    if _UUID_RE.match(href):
        return f'<a href="https://sky-atlas.io/#{href}" target="_blank" rel="noopener" data-xref-uuid="{href}">{text}</a>'
    if href.startswith('http://') or href.startswith('https://'):
        return f'<a href="{href}" target="_blank" rel="noopener">{text}</a>'
    return f'<a href="{href}">{text}</a>'


def _apply_inline_formatting(text: str) -> str:
    """Apply markdown inline formatting to text that has already been HTML-escaped.

    Converts **bold**, *italic*, ~~strikethrough~~, `code`, __underline__,
    and [link](url) syntax to their HTML equivalents. UUID-only hrefs are
    rewritten to /atlas#<uuid> so they navigate to the Atlas viewer.

    This operates on plain text segments only — the caller must ensure it is
    not called on raw HTML that contains tags (use _apply_inline_formatting_to_html
    for diff output that contains <span> tags).
    """
    # Render inline code first (protect contents from other formatting)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Render bold (must come before italic since ** contains *)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Render underline (__text__) — must come before italic-like patterns
    text = re.sub(r'__(.+?)__', r'<u>\1</u>', text)
    # Render italic
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    # Render strikethrough
    text = re.sub(r'~~(.+?)~~', r'<s>\1</s>', text)
    # Render links — UUID hrefs become /atlas#<uuid>; external URLs get target=_blank
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', _rewrite_link, text)
    return text


def _apply_inline_formatting_to_html(diff_html: str) -> str:
    """Apply markdown inline formatting to diff HTML without breaking diff markup.

    The diff output contains <span class="added/removed">...</span> tags.
    We must only apply inline formatting to the text content between/within
    these tags, not to the tags themselves.
    """
    # Split into HTML tags and text segments
    parts = re.split(r'(<[^>]+>)', diff_html)
    result = []
    for part in parts:
        if part.startswith('<'):
            # HTML tag — pass through unchanged
            result.append(part)
        else:
            # Text content — apply inline formatting
            result.append(_apply_inline_formatting(part))
    return ''.join(result)


# ---------------------------------------------------------------------------
# Block / diff HTML rendering
# ---------------------------------------------------------------------------

def _render_block(text: str, format_fn=None) -> str:
    """Render a text block as HTML, handling bullet lists.

    If the block contains lines starting with '- ', those lines are rendered
    as <ul><li> elements. Other lines become <p> tags. format_fn is applied
    to each line's content (defaults to escape + inline formatting).
    """
    if format_fn is None:
        def format_fn(t):
            return _apply_inline_formatting(html.escape(t))

    lines = text.split('\n')
    parts = []
    list_items = []

    def flush_list():
        if list_items:
            items_html = ''.join(f'<li>{item}</li>' for item in list_items)
            parts.append(f'<ul>{items_html}</ul>')
            list_items.clear()

    for line in lines:
        stripped = line.strip()
        if stripped.startswith('- '):
            item_text = stripped[2:].strip()
            list_items.append(format_fn(item_text))
        else:
            flush_list()
            if stripped:
                parts.append(f'<p>{format_fn(stripped)}</p>')

    flush_list()
    return ''.join(parts) if parts else '<p></p>'


def _make_compare_html(old_body: str, new_body: str,
                       is_new: bool = False, is_deleted: bool = False) -> str:
    """Generate paragraph-level word diff HTML for compare mode.

    Splits bodies by double-newline into paragraphs, diffs each pair,
    transforms CSS classes from word_diff output (added/removed) to
    diff-add/diff-del, applies inline formatting, and wraps in <p> tags.
    """
    # Normalize cross-reference numbers for display output so links always
    # show name only (e.g. [Name](UUID)), never the number prefix.
    new_display = normalize_body(new_body) if new_body else ''

    if is_deleted:
        # Everything shown as deleted — wrap each element in diff-del
        def del_format(t):
            return f'<span class="diff-del">{_apply_inline_formatting(html.escape(t))}</span>'
        return _render_block(new_display, format_fn=del_format)

    if is_new or not old_body:
        # Everything shown as added — wrap each element in diff-add
        def add_format(t):
            return f'<span class="diff-add">{_apply_inline_formatting(html.escape(t))}</span>'
        return _render_block(new_display, format_fn=add_format)

    # Normalize bodies to strip cross-reference numbers before diffing.
    # This prevents renumbering of referenced docs from showing as diffs.
    old_norm = normalize_body(old_body)
    new_norm = new_display

    old_paras = [p.strip() for p in old_norm.split('\n\n') if p.strip()]
    new_paras = [p.strip() for p in new_norm.split('\n\n') if p.strip()]

    max_len = max(len(old_paras), len(new_paras))
    parts = []
    for i in range(max_len):
        old_p = old_paras[i] if i < len(old_paras) else ''
        new_p = new_paras[i] if i < len(new_paras) else ''

        if old_p == new_p:
            # Unchanged paragraph — render with normalized display text
            new_display_paras = [p.strip() for p in new_display.split('\n\n') if p.strip()]
            display_p = new_display_paras[i] if i < len(new_display_paras) else new_p
            parts.append(_render_block(display_p))
        elif not old_p:
            # Entirely new paragraph
            new_display_paras = [p.strip() for p in new_display.split('\n\n') if p.strip()]
            display_p = new_display_paras[i] if i < len(new_display_paras) else new_p
            def add_fmt(t):
                return f'<span class="diff-add">{_apply_inline_formatting(html.escape(t))}</span>'
            parts.append(_render_block(display_p, format_fn=add_fmt))
        elif not new_p:
            # Entirely deleted paragraph
            def del_fmt(t):
                return f'<span class="diff-del">{_apply_inline_formatting(html.escape(t))}</span>'
            parts.append(_render_block(old_p, format_fn=del_fmt))
        else:
            # Line-level diffing with word-level within each changed line.
            # This matches the original approach — word_diff works much
            # better on short strings (single lines) than on long paragraphs.
            old_lines = old_p.split('\n')
            new_lines = new_p.split('\n')

            line_sm = difflib.SequenceMatcher(None, old_lines, new_lines)
            block_parts = []
            list_items = []

            def _flush_list():
                if list_items:
                    items_html = ''.join(f'<li>{it}</li>' for it in list_items)
                    block_parts.append(f'<ul>{items_html}</ul>')
                    list_items.clear()

            def _diff_line(old_l, new_l):
                """Word-diff a single line pair, return formatted HTML."""
                d = word_diff(old_l, new_l)
                d = d.replace('class="added"', 'class="diff-add"')
                d = d.replace('class="removed"', 'class="diff-del"')
                return _apply_inline_formatting_to_html(d)

            def _format_line(text):
                return _apply_inline_formatting(html.escape(text))

            def _emit_line(content, is_list_item=False):
                if is_list_item:
                    list_items.append(content)
                else:
                    _flush_list()
                    block_parts.append(f'<p>{content}</p>')

            def _is_list_line(line):
                return line.strip().startswith('- ')

            def _strip_list_prefix(line):
                return re.sub(r'^-\s*', '', line.strip(), count=1)

            for op, li1, li2, lj1, lj2 in line_sm.get_opcodes():
                if op == 'equal':
                    # Use normalized display text for cross-ref output
                    new_display_paras = [p.strip() for p in new_display.split('\n\n') if p.strip()]
                    display_p = new_display_paras[i] if i < len(new_display_paras) else new_p
                    display_lines = display_p.split('\n')
                    for k, line in enumerate(new_lines[lj1:lj2]):
                        display_idx = lj1 + k
                        display_line = display_lines[display_idx] if display_idx < len(display_lines) else line
                        is_li = _is_list_line(display_line)
                        content = _format_line(_strip_list_prefix(display_line) if is_li else display_line.strip())
                        _emit_line(content, is_li)
                elif op == 'replace':
                    for k in range(max(li2 - li1, lj2 - lj1)):
                        old_l = old_lines[li1 + k].strip() if li1 + k < li2 else ''
                        new_l = new_lines[lj1 + k].strip() if lj1 + k < lj2 else ''
                        is_li = _is_list_line(new_l) if new_l else _is_list_line(old_l) if old_l else False
                        if is_li:
                            old_l = _strip_list_prefix(old_l) if old_l else ''
                            new_l = _strip_list_prefix(new_l) if new_l else ''
                        if old_l and not new_l:
                            content = f'<span class="diff-del">{_format_line(old_l)}</span>'
                        elif new_l and not old_l:
                            content = f'<span class="diff-add">{_format_line(new_l)}</span>'
                        else:
                            content = _diff_line(old_l, new_l)
                        _emit_line(content, is_li)
                elif op == 'insert':
                    for line in new_lines[lj1:lj2]:
                        is_li = _is_list_line(line)
                        text = _strip_list_prefix(line) if is_li else line.strip()
                        content = f'<span class="diff-add">{_format_line(text)}</span>'
                        _emit_line(content, is_li)
                elif op == 'delete':
                    for line in old_lines[li1:li2]:
                        is_li = _is_list_line(line)
                        text = _strip_list_prefix(line) if is_li else line.strip()
                        content = f'<span class="diff-del">{_format_line(text)}</span>'
                        _emit_line(content, is_li)

            _flush_list()
            parts.append(''.join(block_parts) if block_parts else '<p></p>')

    return ''.join(parts) if parts else '<p></p>'


def _make_final_html(body: str) -> str:
    """Generate clean paragraph HTML for final mode."""
    if not body:
        return '<p></p>'
    return _render_block(normalize_body(body))


# ---------------------------------------------------------------------------
# Slug / sort helpers
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    """Convert text to a URL-safe slug."""
    slug = text.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def _doc_number_sort_key(number: str):
    """Sort key for document numbers like A.2.2.8.1.2.1.4."""
    parts = number.split('.')
    result = []
    for p in parts:
        if p.isdigit():
            result.append((0, int(p), p))
        else:
            result.append((1, 0, p))
    return result


# ---------------------------------------------------------------------------
# Scope detection
# ---------------------------------------------------------------------------

def _detect_scopes(changed_docs: list[AtlasDoc], all_current_docs: list[AtlasDoc],
                   base_docs: list[AtlasDoc]) -> dict[str, dict]:
    """Group changed docs into disconnected edit scopes.

    Algorithm:
    1. Collect all changed doc numbers
    2. For each, check if any ancestor number is also changed
    3. No changed ancestor = scope root
    4. Group sibling scope roots under common parent
    5. Return scope definitions keyed by slug
    """
    changed_numbers = {d.number for d in changed_docs if d.number}

    # Find scope roots: changed docs with no changed ancestor
    scope_roots = []
    for doc in changed_docs:
        if not doc.number:
            continue
        parts = doc.number.split('.')
        has_changed_ancestor = False
        for i in range(1, len(parts)):
            ancestor_num = '.'.join(parts[:i])
            if ancestor_num in changed_numbers:
                has_changed_ancestor = True
                break
        if not has_changed_ancestor:
            scope_roots.append(doc)

    if not scope_roots:
        return {}

    # Step 1: Group siblings by immediate parent and elevate where safe.
    all_root_nums = {r.number for r in scope_roots}
    parent_groups: dict[str, list[AtlasDoc]] = {}
    for root in scope_roots:
        parts = root.number.split('.')
        parent_num = '.'.join(parts[:-1]) if len(parts) > 1 else ''
        parent_groups.setdefault(parent_num, []).append(root)

    grouped_roots: list[AtlasDoc] = []
    for parent_num, roots in parent_groups.items():
        if len(roots) == 1:
            grouped_roots.append(roots[0])
            continue
        group_nums = {r.number for r in roots}
        elevating_would_overlap_other_root = any(
            other_num != parent_num
            and other_num.startswith(parent_num + '.')
            and other_num not in group_nums
            for other_num in all_root_nums
        )
        if elevating_would_overlap_other_root:
            grouped_roots.extend(roots)
            continue
        parent_doc = find_doc_by_number(all_current_docs, parent_num)
        if parent_doc:
            grouped_roots.append(parent_doc)
        else:
            grouped_roots.extend(roots)

    # Step 2: Drop any scope root that has a descendant which is also a
    # scope root.
    kept_roots = []
    for root in grouped_roots:
        has_descendant_root = any(
            other.number != root.number
            and other.number.startswith(root.number + '.')
            for other in grouped_roots
        )
        if not has_descendant_root:
            kept_roots.append(root)
    current_roots = kept_roots

    # Build scopes from final roots
    scopes = {}
    for root_doc in current_roots:
        scope_key = _slugify(root_doc.name)
        base_key = scope_key
        counter = 2
        while scope_key in scopes:
            scope_key = f'{base_key}-{counter}'
            counter += 1
        scopes[scope_key] = {'root_doc': root_doc, 'root_number': root_doc.number}

    return scopes


def _build_scope_labels(scope_defs: dict[str, dict],
                        all_current_docs: list[AtlasDoc]) -> dict[str, dict]:
    """Build deterministic display labels for edit scopes.

    If multiple scopes share the same root document name, append the shortest
    unique nearest-parent path needed to distinguish them. Otherwise, keep the
    plain document name.
    """
    def _label_group_key(name: str) -> str:
        return re.sub(r'\s+', ' ', re.sub(r'[-‐-―]+', ' ', name.lower())).strip()

    grouped: dict[str, list[tuple[str, AtlasDoc]]] = {}
    for scope_key, scope_def in scope_defs.items():
        root_doc = scope_def['root_doc']
        grouped.setdefault(_label_group_key(root_doc.name), []).append((scope_key, root_doc))

    labels = {}
    for _, items in grouped.items():
        if len(items) == 1:
            scope_key, root_doc = items[0]
            labels[scope_key] = {
                'label': root_doc.name,
                'labelDetail': '',
                'displayLabel': root_doc.name,
            }
            continue

        ancestor_chains = {}
        for scope_key, root_doc in items:
            ancestors = find_ancestor_docs(root_doc, all_current_docs)
            ancestor_chains[scope_key] = [doc.name for doc in reversed(ancestors)]

        for scope_key, root_doc in items:
            chain = ancestor_chains[scope_key]
            detail = ''
            for depth in range(1, len(chain) + 1):
                candidate = tuple(chain[:depth])
                if all(
                    tuple(other_chain[:depth]) != candidate
                    for other_key, other_chain in ancestor_chains.items()
                    if other_key != scope_key
                ):
                    detail = ' / '.join(candidate)
                    break

            if not detail:
                detail = root_doc.number

            labels[scope_key] = {
                'label': root_doc.name,
                'labelDetail': detail,
                'displayLabel': f'{root_doc.name} — {detail}',
            }

    return labels


# ---------------------------------------------------------------------------
# Scope tree
# ---------------------------------------------------------------------------

def _has_visible_descendants(node: dict) -> bool:
    """True if a node has any changed descendants — visible children, or
    visible children of hidden children.

    Prevents unchanged intermediate nodes from hiding their changed
    descendants. An unchanged parent with a changed grandchild must be
    visible so the user can navigate to the change.
    """
    for child in node.get('children', []):
        if child.get('status'):  # Has a change status (Edited, Inserted, Deleted)
            return True
        if _has_visible_descendants(child):
            return True
    for child in node.get('hiddenChildren', []):
        if child.get('status'):
            return True
        if _has_visible_descendants(child):
            return True
    return False


def _build_deleted_node(doc: AtlasDoc, base_children_by_parent: dict[str, list[AtlasDoc]],
                        current_uuid_set: set[str]) -> dict:
    """Build a node dict for a deleted document, recursively including
    deleted children.

    When a parent and its children are all deleted, the children nest
    under the parent — not floating up to the scope level.
    """
    child_nodes = []
    if doc.uuid:
        for d in base_children_by_parent.get(doc.uuid, []):
            if d.uuid and d.uuid not in current_uuid_set:
                child_nodes.append(
                    _build_deleted_node(d, base_children_by_parent, current_uuid_set)
                )
    child_nodes.sort(key=lambda n: _doc_number_sort_key(n['id']))

    return {
        'id': doc.number,
        'title': doc.name,
        'uuid': doc.uuid or '',
        'status': 'Deleted',
        'compact': False,
        'compareHtml': _make_compare_html('', doc.body, is_deleted=True),
        'finalHtml': '<p><em>This document has been removed.</em></p>',
        'lineStart': doc.line_start,
        'lineEnd': doc.line_end,
        'children': child_nodes,
        'hiddenChildren': [],
    }


def _build_scope_tree(scope_root_number: str, all_current_docs: list[AtlasDoc],
                      base_docs: list[AtlasDoc], changed_set: set[str],
                      new_uuids: set[str], deleted_docs: list[AtlasDoc]) -> dict:
    """Build the full node tree for a scope root."""
    base_by_uuid = {d.uuid: d for d in base_docs if d.uuid}
    current_uuid_set = {d.uuid for d in all_current_docs if d.uuid}

    # UUID-based child lookup for current docs
    current_children_by_parent: dict[str, list[AtlasDoc]] = {}
    for d in all_current_docs:
        if d.parent_uuid:
            current_children_by_parent.setdefault(d.parent_uuid, []).append(d)

    # UUID-based child lookup for base docs (used for deleted children)
    base_children_by_parent: dict[str, list[AtlasDoc]] = {}
    for d in base_docs:
        if d.parent_uuid:
            base_children_by_parent.setdefault(d.parent_uuid, []).append(d)

    def build_node(doc: AtlasDoc, is_changed: bool) -> dict:
        status = None
        old_doc = None
        is_new = False

        if doc.uuid:
            old_doc = base_by_uuid.get(doc.uuid)

        if doc.uuid and doc.uuid in new_uuids:
            status = 'Inserted'
            is_new = True
        elif is_changed and old_doc:
            if old_doc.body != doc.body or old_doc.name != doc.name:
                status = 'Edited'
        elif is_changed and not old_doc:
            status = 'Inserted'
            is_new = True

        if status:
            old_body = old_doc.body if old_doc else ''
            compare_html = _make_compare_html(old_body, doc.body, is_new=is_new)
        else:
            compare_html = _make_final_html(doc.body)

        final_html = _make_final_html(doc.body)

        direct_children = current_children_by_parent.get(doc.uuid, []) if doc.uuid else []

        deleted_children = []
        if doc.uuid:
            for d in base_children_by_parent.get(doc.uuid, []):
                if d.uuid and d.uuid not in current_uuid_set:
                    deleted_children.append(d)

        direct_children = sorted(direct_children, key=lambda d: _doc_number_sort_key(d.number))

        children_nodes = []
        hidden_nodes = []

        for child in direct_children:
            child_is_changed = child.number in changed_set
            child_node = build_node(child, child_is_changed)
            if child_is_changed or _has_visible_descendants(child_node):
                children_nodes.append(child_node)
            else:
                hidden_nodes.append(child_node)

        for del_child in deleted_children:
            del_node = _build_deleted_node(del_child, base_children_by_parent, current_uuid_set)
            children_nodes.append(del_node)

        children_nodes.sort(key=lambda n: _doc_number_sort_key(n['id']))

        title_diff = None
        if old_doc and old_doc.name != doc.name:
            title_diff = word_diff(old_doc.name, doc.name)

        node = {
            'id': doc.number,
            'title': doc.name,
            'uuid': doc.uuid or '',
            'status': status,
            'compact': not is_changed,
            'compareHtml': compare_html,
            'finalHtml': final_html,
            'lineStart': doc.line_start,
            'lineEnd': doc.line_end,
            'children': children_nodes,
            'hiddenChildren': hidden_nodes,
        }
        if title_diff:
            node['titleDiff'] = title_diff
        return node

    root_doc = find_doc_by_number(all_current_docs, scope_root_number)
    if not root_doc:
        return {}

    is_root_changed = scope_root_number in changed_set
    return build_node(root_doc, is_root_changed)


# ---------------------------------------------------------------------------
# Top-level scope-data builder
# ---------------------------------------------------------------------------

def _build_scope_data(branch: str, base: str, current_docs: list[AtlasDoc],
                      base_docs: list[AtlasDoc], changed_docs: list[AtlasDoc],
                      renumbered_docs: list[AtlasDoc], deleted_docs: list[AtlasDoc],
                      *, repo_str: str, pr_number: int | None = None,
                      pr_title: str | None = None) -> dict:
    """Build the scope_data JSON structure for one proposal diff.

    Args:
        branch:          head branch name (used as fallback title).
        base:            base ref name.
        current_docs:    AtlasDoc list for the head version (parent_uuid set).
        base_docs:       AtlasDoc list for the base version (parent_uuid set).
        changed_docs:    AtlasDoc list of substantively-changed docs (head side).
        renumbered_docs: AtlasDoc list of docs whose number changed but body
                         + name did not (after cross-reference normalization).
        deleted_docs:    AtlasDoc list of base docs whose UUID is absent
                         from the head version.
        repo_str:        public repo identifier, e.g. "sky-ecosystem/next-gen-atlas".
        pr_number:       PR number on the public repo, for display.
        pr_title:        PR title, falls back to a humanized branch name.
    """
    # Stats
    base_uuids = {d.uuid for d in base_docs if d.uuid}
    new_uuids = {d.uuid for d in changed_docs if d.uuid and d.uuid not in base_uuids}
    new_count = len(new_uuids)
    modified_count = len(changed_docs) - new_count
    removed_count = len(deleted_docs)
    renumbered_count = len(renumbered_docs)

    changed_numbers = {d.number for d in changed_docs if d.number}

    # Include deleted docs' nearest living ancestor in the changed set so
    # their parent scope includes them.
    current_by_uuid = {d.uuid: d for d in current_docs if d.uuid}
    base_by_uuid_scope = {d.uuid: d for d in base_docs if d.uuid}
    for d in deleted_docs:
        ancestor_uuid = d.parent_uuid
        while ancestor_uuid:
            if ancestor_uuid in current_by_uuid:
                parent_doc = current_by_uuid[ancestor_uuid]
                changed_numbers.add(parent_doc.number)
                if not any(c.number == parent_doc.number for c in changed_docs):
                    changed_docs.append(parent_doc)
                break
            ancestor_base = base_by_uuid_scope.get(ancestor_uuid)
            ancestor_uuid = ancestor_base.parent_uuid if ancestor_base else None

    # Re-sort by document number.
    changed_docs.sort(key=lambda d: _doc_number_sort_key(d.number) if d.number else [])

    # Detect scopes
    scope_defs = _detect_scopes(changed_docs, current_docs, base_docs)
    scope_labels = _build_scope_labels(scope_defs, current_docs)

    scopes = {}
    for scope_key, scope_def in scope_defs.items():
        root_doc = scope_def['root_doc']
        root_number = scope_def['root_number']
        label_meta = scope_labels.get(scope_key, {
            'label': root_doc.name,
            'labelDetail': '',
            'displayLabel': root_doc.name,
        })

        # Lineage
        lineage = []
        ancestors = find_ancestor_docs(root_doc, current_docs)
        for anc in ancestors:
            lineage.append({
                'id': anc.number,
                'title': anc.name,
                'uuid': anc.uuid or '',
                'finalHtml': _make_final_html(anc.body),
                'lineStart': anc.line_start,
                'lineEnd': anc.line_end,
            })

        # Siblings (children of scope root's parent, excluding the root and changed docs)
        siblings_before = []
        siblings_after = []
        parts = root_number.split('.')
        if len(parts) > 1:
            parent_number = '.'.join(parts[:-1])
            parent_prefix = parent_number + '.'
            parent_parts_len = len(parts) - 1
            sibling_docs = []
            for d in current_docs:
                if not d.number or d.number == root_number:
                    continue
                if not d.number.startswith(parent_prefix):
                    continue
                d_parts = d.number.split('.')
                if len(d_parts) == parent_parts_len + 1:
                    if d.number not in changed_numbers:
                        sibling_docs.append(d)

            sibling_docs.sort(key=lambda d: _doc_number_sort_key(d.number))
            root_sort_key = _doc_number_sort_key(root_number)

            for d in sibling_docs:
                sib_node = {
                    'id': d.number,
                    'title': d.name,
                    'uuid': d.uuid or '',
                    'finalHtml': _make_final_html(d.body),
                    'compact': True,
                    'lineStart': d.line_start,
                    'lineEnd': d.line_end,
                }
                if _doc_number_sort_key(d.number) < root_sort_key:
                    siblings_before.append(sib_node)
                else:
                    siblings_after.append(sib_node)

        # Build the scope tree
        root_node = _build_scope_tree(
            root_number, current_docs, base_docs,
            changed_numbers, new_uuids, deleted_docs
        )

        # Summary text
        changed_in_scope = sum(
            1 for d in changed_docs
            if d.number and (d.number == root_number or d.number.startswith(root_number + '.'))
        )
        new_in_scope = sum(
            1 for d in changed_docs
            if d.number and d.uuid and d.uuid in new_uuids
            and (d.number == root_number or d.number.startswith(root_number + '.'))
        )
        edited_in_scope = changed_in_scope - new_in_scope

        summary_parts = []
        if edited_in_scope > 0:
            summary_parts.append(f'{edited_in_scope} edited document{"s" if edited_in_scope != 1 else ""}')
        if new_in_scope > 0:
            summary_parts.append(f'{new_in_scope} new document{"s" if new_in_scope != 1 else ""}')

        summary_compare = ', '.join(summary_parts) if summary_parts else 'Changes in this scope'
        summary_final = f'Final text for {root_doc.name} and its children'

        scopes[scope_key] = {
            'label': label_meta['label'],
            'labelDetail': label_meta['labelDetail'],
            'displayLabel': label_meta['displayLabel'],
            'summaryCompare': summary_compare,
            'summaryFinal': summary_final,
            'lineage': lineage,
            'siblingsBefore': siblings_before,
            'siblingsAfter': siblings_after,
            'root': root_node,
        }

    # Renumbered docs (global)
    base_by_uuid = {d.uuid: d for d in base_docs if d.uuid}
    all_renumbered = []
    for doc in renumbered_docs:
        old_doc = base_by_uuid.get(doc.uuid)
        if old_doc and old_doc.number != doc.number:
            all_renumbered.append({
                'oldId': old_doc.number,
                'newId': doc.number,
                'title': doc.name,
            })

    if not pr_title:
        # Humanize branch name: edit/dr-ib-expense → DR Ib Expense
        clean = branch.split('/')[-1]
        clean = clean.replace('-', ' ').title()
        pr_title = clean

    return {
        'branch': branch,
        'base': base,
        'title': pr_title,
        'repo': repo_str,
        'pr_number': pr_number,
        'stats': {
            'new': new_count,
            'modified': modified_count,
            'removed': removed_count,
            'renumbered': renumbered_count,
            'total': len(changed_docs),
        },
        'scopes': scopes,
        'renumbered': all_renumbered,
    }


# ---------------------------------------------------------------------------
# Public entry: build scope_data from two AtlasDoc lists
# ---------------------------------------------------------------------------

def build_scope_data(
    current_docs: list[AtlasDoc],
    base_docs: list[AtlasDoc],
    *,
    branch: str,
    base: str,
    repo_str: str,
    pr_number: int | None = None,
    pr_title: str | None = None,
) -> dict:
    """Build the scope_data JSON for two atom-tree AtlasDoc lists.

    Both lists must come from `walk_content_tree` (or equivalent) — every
    AtlasDoc must have a UUID. Change detection is UUID-keyed: a doc is
    "changed" if its UUID is new, or if (after cross-reference number
    normalization) its body, name, or number differs from the base version.

    Returns the scope_data dict ready for `json.dumps`. The dict shape is
    consumed by atlas-portal's `/proposal` page renderer.
    """
    # Parent UUIDs are needed by scope tree building for child lookup
    assign_parent_uuids(current_docs)
    assign_parent_uuids(base_docs)

    base_by_uuid = {d.uuid: d for d in base_docs if d.uuid}

    # UUID-keyed change detection
    changed_docs: list[AtlasDoc] = []
    for doc in current_docs:
        old = base_by_uuid.get(doc.uuid) if doc.uuid else None
        if old is None:
            # New doc — UUID didn't exist in base
            changed_docs.append(doc)
            continue
        if old.body != doc.body or old.name != doc.name or old.number != doc.number:
            changed_docs.append(doc)

    # Categorize changed docs: substantive changes vs renumbering-only.
    # Pure number-only diffs are dropped (continue without classification);
    # cross-reference-only body diffs (where normalize_body matches) go
    # into renumbered_docs.
    substantive_docs = []
    renumbered_docs = []
    for doc in changed_docs:
        if doc.uuid and doc.uuid in base_by_uuid:
            old = base_by_uuid[doc.uuid]
            if old.body == doc.body and old.name == doc.name:
                # Number-only change — drop entirely (not substantive, not renumbered)
                continue
            if normalize_body(old.body) == normalize_body(doc.body) and old.name == doc.name:
                renumbered_docs.append(doc)
                continue
        substantive_docs.append(doc)
    changed_docs = substantive_docs

    # Deleted docs: base uuids not in current
    current_uuids = {d.uuid for d in current_docs if d.uuid}
    deleted_docs = [d for d in base_docs if d.uuid and d.uuid not in current_uuids]

    return _build_scope_data(
        branch, base, current_docs, base_docs,
        changed_docs, renumbered_docs, deleted_docs,
        repo_str=repo_str, pr_number=pr_number, pr_title=pr_title,
    )
