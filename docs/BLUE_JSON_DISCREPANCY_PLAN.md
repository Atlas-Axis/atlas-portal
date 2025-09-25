## Blue JSON Parity: Debug and Fix Plan

This document guides AI agents through comparing and reconciling differences between:

- Generated Blue-style JSON: `.debug-data/atlas-json-generated/blue-from-supabase.json`
- Original reference JSON: `.debug-data/blue-without-inactive.json`

The goal is to achieve structural and content parity while strictly following Atlas rules and the Blue JSON contract.

### Ground Rules

- Build hierarchy using child\_\* relationship arrays only (`child_scope_ids`, `child_article_ids`, `child_section_and_primary_doc_ids`, `child_annotation_ids`, `child_tenet_ids`, `child_scenario_ids`, `child_scenario_variation_ids`, `child_active_data_ids`, `child_agent_scope_ids`, `child_needed_research_ids`). Never use `parent_notion_page_id`.
- Start at `Scopes` only as the top level documents. Exclude the entire `Agent Scope Database` tree.
- Mirror Blue JSON structure and key names exactly.
- Use rules-based generation for Atlas document numbers (see `docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`). If needed, implement the code for this for the Blue JSON generator.
- Sorting within siblings must use natural doc-number order. When sibling `sort_order` ties or is missing, break ties by `originalDocNumber`.
- Inactive items are currently not output. Therefore, skip `inactive_datetime` fields too.

### What the Blue JSON Structure Must Contain

- Scope node: `scope_name`, `scope_content`, `scope_last_modified`, `scope_uuid`, `inactive`, `scope_doc_no`, `scope_articles: []`
- Article node: `article_*` fields, `article_sections: []`
- Section node: `section_*` fields, `section_primary_docs: []`
  - Optional `section_annotations: []` when present in Supabase
- Primary docs:
  - Core nodes: `core_*` fields
    - `core_children: []` (nested Cores only)
    - `core_annotations: []`
    - `core_tenets: []` (each with `tenet_scenarios: []`)
    - `core_needed_research: []`
  - Active Data Controller nodes: `active_data_controller_*` fields

### Step 1: Compare Structure and Paths

Use jq to list scalar paths and diff:

```bash
jq -r 'paths(scalars) | join(".")' .debug-data/atlas-json-generated/blue-from-supabase.json | sort | uniq > /tmp/paths_supabase.txt
jq -r 'paths(scalars) | join(".")' .debug-data/blue-without-inactive.json | sort | uniq > /tmp/paths_blue.txt
comm -3 /tmp/paths_supabase.txt /tmp/paths_blue.txt | sed -e 's/^/DIFF: /'
```

Interpretation:

- Missing `section_annotations` → add at Section level if Supabase has `child_annotation_ids` on the section.
- Missing Active Data Controller entries under `section_primary_docs` → include controller nodes alongside Core nodes.
- Any unexpected arrays/keys → normalize to match Blue JSON contract.

### Step 2: Compare Counts by Level

Use jq to count nodes at each level in both files:

```bash
# Scopes
jq '. | length' .debug-data/atlas-json-generated/blue-from-supabase.json
jq '. | length' .debug-data/blue-without-inactive.json

# Articles
jq '[.[].scope_articles | length] | add' .debug-data/atlas-json-generated/blue-from-supabase.json
jq '[.[].scope_articles | length] | add' .debug-data/blue-without-inactive.json

# Repeat similarly for sections, cores, annotations, tenets, scenarios, scenario_variations, needed_research
```

Use differences to drive investigation in Step 3.

### Step 3: Verify Data in Supabase (Current View)

Use the `notion_database_pages_current` view (filters out old versions). Examples:

```sql
-- Counts by database/type
SELECT atlas_database_name, atlas_document_type, COUNT(*)
FROM notion_database_pages_current
GROUP BY 1,2
ORDER BY 1,2;

-- Sections with many children
SELECT notion_page_id, jsonb_array_length(child_section_and_primary_doc_ids) AS child_count
FROM notion_database_pages_current
WHERE atlas_document_type = 'Section'
ORDER BY child_count DESC
LIMIT 25;

-- Sibling ordering inputs for Articles
SELECT notion_page_id, atlas_document_number AS originalDocNumber, sort_order
FROM notion_database_pages_current
WHERE atlas_database_name = 'Articles'
ORDER BY sort_order NULLS LAST, atlas_document_number NULLS LAST;
```

Use these to confirm that missing or unexpected content is explained by DB presence/absence or linkage in child\_\* arrays.

### Step 4: Document Number Differences

Extract and compare doc numbers:

```bash
# Scopes
jq -r '.[].scope_doc_no' .debug-data/atlas-json-generated/blue-from-supabase.json | sort -V > /tmp/num_scopes_supabase.txt
jq -r '.[].scope_doc_no' .debug-data/blue-without-inactive.json | sort -V > /tmp/num_scopes_blue.txt
comm -3 /tmp/num_scopes_supabase.txt /tmp/num_scopes_blue.txt | sed -e 's/^/NUM DIFF: /'
```

If differences exist:

- Trace a handful by logging parent chain and sibling set used by `generateDocumentNumbers`.
- Ensure parents are discovered via child\_\* arrays only (never by `parent_notion_page_id`).
- Ensure sibling ordering uses `sort_order` and breaks ties with `originalDocNumber`.
- Re-run generation and re-compare.

### Step 5: Field Presence and Naming

Normalize field presence to mirror Blue JSON exactly:

- Always emit arrays for core_children, core_annotations, core_tenets, core_needed_research, tenet_scenarios, scenario_variations (empty arrays when no items), unless Blue JSON omits empty arrays for specific fields (then mirror that behavior).
- Ensure date fields are in the correct keys (e.g., `*_last_modified`).
- Do not emit `inactive_datetime` since we don’t include inactive items.

### Step 6: Database/Type Coverage

Confirm that all needed databases/types are represented at the correct level:

- Scopes → Articles → Sections & Primary Docs
- Under Section: section_primary_docs includes Core and Active Data Controller
- Under Core: annotations, tenets (with scenarios → variations), needed_research

If a type exists in Supabase but not in output, fix the attachment point based on the hierarchy rules and Blue JSON reference.

### Step 7: Iterate and Re-verify

1. Make one fix at a time in `scripts/generate-blue-json.ts`.
2. Re-run:
   ```bash
   npx tsx scripts/generate-blue-json.ts
   ```
3. Re-run jq path and count diffs to track progress.

### Notes for Agents

- All Supabase reads for verification should use the `notion_database_pages_current` view.
- Follow the “Atlas Document Hierarchy” described in Core Project Documentation.
- Use `originalDocNumber` as a tie-breaker when `sort_order` is equal/missing.
- Keep code and documentation changes synchronized across all Core Project Documentation files when applicable.
