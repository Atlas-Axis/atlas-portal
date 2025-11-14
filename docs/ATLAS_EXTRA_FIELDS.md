# Atlas Extra Fields Documentation

## Overview

**Extra Fields** are specialized properties that exist only for specific Atlas document types. Unlike standard properties (name, content, doc_no, type) that all documents have, extra fields provide additional metadata or structured information unique to certain document types.

Extra fields are:

- Stored in the `extra_fields` JSONB column in Supabase's `notion_database_pages` table
- Each field stores both plain text and rich text JSON (similar to `json_content`)
- Imported from specific Notion database page properties during sync
- Exported to JSON and Markdown formats with proper formatting support
- Displayed in the UI alongside document content
- Compared during change detection

## Notion Property Types

All properties in Notion databases have a specific type. For Atlas extra fields:

- **Default**: All extra fields are **Rich Text** unless specified otherwise
- **Overrides**: The `NOTION_PROPERTY_TYPE_OVERRIDES` constant in `notion-database-properties-and-relationships.ts` defines exceptions, grouped by Atlas database
- **Document Type Field**: The document type field (`atlasDocumentType`) is **always** a **Select** field across all Atlas databases

### Supported Property Types (Markdown → Notion Sync)

The sync system supports the following Notion property types:

- **rich_text**: Standard text with inline formatting (bold, italic, code, links, etc.) - Default for extra fields
- **title**: Page title field
- **select**: Single selection from predefined options
- **number**: Numeric values

When syncing from Markdown to Notion, the system uses these property types to format the data correctly for the Notion API.

## Document Types with Extra Fields

Currently, four Atlas document types have extra fields: Type Specification, Scenario, Scenario Variation, and Needed Research.

### Centralized Registry

The `DOCUMENT_TYPE_EXTRA_FIELDS` constant in `notion-database-properties-and-relationships.ts` serves as a centralized registry mapping each document type to its extra field property mapping:

```typescript
export const DOCUMENT_TYPE_EXTRA_FIELDS: Partial<Record<AtlasDocumentType, Record<string, string>>> = {
  'Type Specification': TYPE_SPECIFICATION_PROPERTY_MAPPING,
  Scenario: SCENARIO_PROPERTY_MAPPING,
  'Scenario Variation': SCENARIO_VARIATION_PROPERTY_MAPPING,
  'Needed Research': NEEDED_RESEARCH_PROPERTY_MAPPING,
};
```

This allows any part of the codebase to dynamically discover which document types have extra fields and what those fields are, without hardcoding type-specific logic.

### 1. Type Specification

**Interface**: `TypeSpecificationExtraFields`

| Supabase Field                            | Notion Property      | Property Type | Description                    |
| ----------------------------------------- | -------------------- | ------------- | ------------------------------ |
| `type_specification_doc_identifier_rules` | Doc Identifier Rules | Rich Text     | Rules for document identifiers |
| `type_specification_additional_logic`     | Additional Logic     | Rich Text     | Additional logical rules       |
| `type_specification_type_category`        | Type Category        | Select        | Category classification        |
| `type_specification_type_name`            | Type Name            | Rich Text     | Name of the type               |
| `type_specification_type_overview`        | Type Overview        | Rich Text     | Overview description           |
| `type_specification_components`           | Components           | Rich Text     | Component information          |

**Mapping**: `TYPE_SPECIFICATION_PROPERTY_MAPPING`

**Property Type Notes**: All extra fields default to Rich Text unless specified in `NOTION_PROPERTY_TYPE_OVERRIDES`. Currently, only `Type Category` uses Select.

### 2. Scenario

**Interface**: `ScenarioExtraFields`

| Supabase Field                 | Notion Property     | Property Type | Description                                                    |
| ------------------------------ | ------------------- | ------------- | -------------------------------------------------------------- |
| `scenario_finding`             | Finding             | Rich Text     | Finding information                                            |
| `scenario_additional_guidance` | Additional Guidance | Rich Text     | Additional guidance text                                       |
| `scenario_description`         | Description         | Rich Text     | Main description (note: `content` field is null for Scenarios) |

**Mapping**: `SCENARIO_PROPERTY_MAPPING`

**Database**: `Scenarios`

**Important**: The `Description` property maps to `scenario_description` in extra_fields, NOT to the `content` field.

**Property Type Notes**: All Scenario extra fields use Rich Text property type (no overrides in `NOTION_PROPERTY_TYPE_OVERRIDES` for this database).

### 3. Scenario Variation

**Interface**: `ScenarioVariationExtraFields`

| Supabase Field                           | Notion Property     | Property Type | Description                                                              |
| ---------------------------------------- | ------------------- | ------------- | ------------------------------------------------------------------------ |
| `scenario_variation_finding`             | Finding             | Rich Text     | Finding information                                                      |
| `scenario_variation_additional_guidance` | Additional Guidance | Rich Text     | Additional guidance text                                                 |
| `scenario_variation_description`         | Description         | Rich Text     | Main description (note: `content` field is null for Scenario Variations) |

**Mapping**: `SCENARIO_VARIATION_PROPERTY_MAPPING`

**Database**: `Scenario Variations`

**Important**: The `Description` property maps to `scenario_variation_description` in extra_fields, NOT to the `content` field.

**Property Type Notes**: All Scenario Variation extra fields use Rich Text property type (no overrides in `NOTION_PROPERTY_TYPE_OVERRIDES` for this database).

### 4. Needed Research

**Interface**: `NeededResearchExtraFields`

| Supabase Field            | Notion Property | Property Type | Description                                                      |
| ------------------------- | --------------- | ------------- | ---------------------------------------------------------------- |
| `needed_research_content` | Content         | Rich Text     | Main content (note: `content` field is null for Needed Research) |

**Mapping**: `NEEDED_RESEARCH_PROPERTY_MAPPING`

**Database**: `Needed Research`

**Important**: The `Content` property maps to `needed_research_content` in extra_fields, NOT to the `content` field.

**Property Type Notes**: Needed Research extra fields use Rich Text property type (no overrides in `NOTION_PROPERTY_TYPE_OVERRIDES` for this database).

## How Extra Fields Work

### Import Process (Notion → Supabase)

**File**: `app/server/services/notion/convert-notion-pages-to-supabase-format.ts`

1. **Detection**: During page conversion, the document type is checked
2. **Extraction**: Type-specific extraction functions are called:
   - `extractTypeSpecificationExtraFields()`
   - `extractScenarioExtraFields()`
   - `extractScenarioVariationExtraFields()`
   - `extractNeededResearchExtraFields()`
3. **Rich Text Extraction**: Each function uses `extractRichTextFromProperty()` helper to extract both plain text and rich text JSON arrays
4. **Storage Structure**: Each field is stored as an object with two properties:
   - `plain_text`: String representation (for quick display and comparison)
   - `rich_text`: Rich text JSON array (for preserving formatting, links, etc.)
5. **Property Type Handling**:
   - **Rich Text properties**: Both `plain_text` and `rich_text` are populated
   - **Select/Number properties**: Only `plain_text` is populated, `rich_text` is `null`
6. **Storage**: Extracted fields are stored as a JSONB object in the `extra_fields` column

**Storage Format Example**:

```json
{
  "type_specification_type_name": {
    "plain_text": "Example Type",
    "rich_text": [{ "type": "text", "text": { "content": "Example Type" } }]
  },
  "type_specification_type_category": {
    "plain_text": "Category A",
    "rich_text": null
  }
}
```

**Null Content Handling**: For Scenario, Scenario Variation, and Needed Research documents, the `content` property mapping is `null`. The extraction logic handles this by defaulting to an empty string.

### Export Process (Supabase → JSON/Markdown)

#### JSON Export

**Files**:

- `app/server/atlas/export/notion-tree-to-export-tree.ts`
  - `convertExtraFieldToMarkdown()` helper: Converts rich text structure to markdown strings
    - Handles both `plain_text` and `rich_text` properties
    - Uses `convertNotionRichTextToMarkdown()` for rich text arrays
    - Falls back to plain text for Select/Number fields
  - `pickExtraFields()` function: Extracts and converts extra fields to markdown strings
    - Iterates over property mappings for document type
    - Calls `convertExtraFieldToMarkdown()` for each field
    - Returns a record with markdown string values (null if missing)
  - `notionTreeNodeToExportTreeNode()` function: Spreads `...pickExtraFields(node, uuidMappings)` in document type's case
  - Validates presence of expected fields and warns about missing ones

- `app/server/atlas/export/types.ts`
  - `extraFieldsByDocumentType` constant: Maps document types to their extra field keys
  - Document interfaces extend `ExportAtlasTreeBaseDocument` with extra field properties (as strings in JSON export)

#### Markdown Export

**File**: `app/server/atlas/export/atlas-markdown-exporter.ts`

- `getExtraFieldsForDocument()` function: Formats extra fields for markdown
- Iterates over the property mapping to generate formatted fields in the format:

  ```
  **Label**:

  value

  **Next Label**:

  next value
  ```

- Each field consists of:
  - Label line ending with colon: `**Label**:`
  - Blank line
  - Value content (may span multiple lines)
  - Blank line (except after the last field)
- The last field omits the trailing blank line (the document-level separator is added by `formatDocumentRecursive`)
- Handles null/undefined values gracefully (outputs empty string)

#### Markdown Import

**File**: `app/server/atlas/export/atlas-markdown-importer.ts`

- `extractContentAndExtraFields()` function: Parses markdown back to structured data
- Detects `**Label**:` patterns (colon at end of line with no value on the same line)
- Values appear on subsequent lines after the label line
- Automatically trims leading and trailing blank lines from each field's value
- Separates content from extra fields
- Initializes all expected fields to empty strings if not found
- Round-trip compatible: Export → Import preserves all field values correctly

### Change Detection

**Files**:

- `app/server/services/notion/compare-database-pages.ts`
  - `compareTypeSpecificationExtraFields()`: Compares Type Specification fields
  - `compareScenarioExtraFields()`: Compares Scenario fields
  - `compareScenarioVariationExtraFields()`: Compares Scenario Variation fields
  - `compareNeededResearchExtraFields()`: Compares Needed Research fields
  - Each function extracts rich text structure from Notion using `extractRichTextFromProperty()`
  - Compares both `plain_text` and `rich_text` (using JSON stringification for rich text arrays)
  - Detects changes in either plain text content or formatting

- `app/server/atlas/diff/atlas-diff.ts`
  - `getExtraFieldKeysForDocumentType()`: Returns extra field keys by type
  - `compareDocumentFields()`: Compares documents including extra fields
  - `stripChildCollections()`: Preserves extra fields when stripping child collections

### UI Display

**Files**:

- `app/atlas/page-extra-data.tsx`
  - Component for displaying extra fields in Atlas page details
  - `getExtraFieldsForDocument()` function: Determines which mapping to use based on document type
  - Renders as a definition list (`<dl>`) with labels and values

- `app/atlas/content-tree.tsx`
  - `ExportTreeExtraData` component: Renders extra fields in tree view
  - Filters out empty values before display
  - Uses property mappings to get human-readable labels

- `app/atlas/sync/page.tsx`
  - Displays extra fields in change detection UI
  - Uses property mappings for labels
  - Helper function `getExtraFieldMapping()`: Returns appropriate mapping

### Validation

**File**: `app/server/atlas/export/validate-export-atlas-tree.ts`

- Validates extra field presence and types for documents
- Ensures all fields defined in mappings exist on documents
- Uses `TYPE_SPECIFICATION_PROPERTY_MAPPING` and similar constants

## Core Files Reference

### Type Definitions & Mappings

- `app/server/atlas/notion-database-properties-and-relationships.ts`
  - Defines all extra field types (derived from property mappings via `ExtraFieldsFromMapping` utility type)
  - Defines property mappings (Supabase field → Notion property name)
  - **Defines `DOCUMENT_TYPE_EXTRA_FIELDS`** - centralized registry mapping document types to their property mappings
  - Central source of truth for extra fields
  - The `ExtraFieldsFromMapping<T>` utility type automatically generates type definitions from property mappings, ensuring all fields have `string | null` values

### Import/Sync

- `app/server/services/notion/convert-notion-pages-to-supabase-format.ts`
  - Extracts extra fields from Notion pages
  - Handles null content property mappings
  - Type-specific extraction functions

- `app/server/services/notion/compare-database-pages.ts`
  - Compares extra fields between Notion and Supabase
  - Type-specific comparison functions
  - Change detection logic

### Export

- `app/server/atlas/export/notion-tree-to-export-tree.ts`
  - Picks and validates extra fields for JSON export
  - Warning messages for missing fields

- `app/server/atlas/export/atlas-markdown-exporter.ts`
  - Formats extra fields for markdown export
  - Uses property mappings for labels

- `app/server/atlas/export/atlas-markdown-importer.ts`
  - Parses markdown back to structured extra fields
  - Handles labeled field format

- `app/server/atlas/export/types.ts`
  - Type definitions for exported Atlas documents
  - `extraFieldsByDocumentType` constant

- `app/server/atlas/export/validate-export-atlas-tree.ts`
  - Validates extra fields in exported data

### Change Detection & Diffing

- `app/server/atlas/diff/atlas-diff.ts`
  - Compares extra fields during diff operations
  - `getExtraFieldKeysForDocumentType()` helper
  - Includes extra fields in change detection

### UI Components

- `app/atlas/page-extra-data.tsx` - Extra fields display in page details
- `app/atlas/content-tree.tsx` - Extra fields in tree view
- `app/atlas/sync/page.tsx` - Extra fields in sync/change UI

## Adding New Extra Fields

To add a new extra field to an existing document type:

1. **Update property mapping** in `notion-database-properties-and-relationships.ts`
   - Add mapping entry to the property mapping constant: `field_name: 'Notion Property Name'`
   - Add property type override if not Rich Text (Select, Number, etc.)
   - The type definition will automatically update thanks to `ExtraFieldsFromMapping<T>`
   - **No need to update `DOCUMENT_TYPE_EXTRA_FIELDS`** - it already references the property mapping constant

2. **Update extraction function** in `convert-notion-pages-to-supabase-format.ts`
   - Add field to initialization object: `field_name: { plain_text: null, rich_text: null }`
   - The loop will automatically extract it using `extractRichTextFromProperty()`

3. **All other systems automatically adapt** because they iterate over the mappings dynamically
   - `DOCUMENT_TYPE_EXTRA_FIELDS` automatically includes the new field
   - Change detection compares both plain_text and rich_text
   - Export converts rich_text to markdown strings
   - UI displays markdown-formatted content

## Adding Extra Fields to a New Document Type

1. Define property mapping constant in `notion-database-properties-and-relationships.ts` (using `as const`)
2. Define type using `ExtraFieldsFromMapping<typeof YOUR_PROPERTY_MAPPING>`
3. **Add entry to `DOCUMENT_TYPE_EXTRA_FIELDS`** mapping the document type to your property mapping constant
4. Add extraction function in `convert-notion-pages-to-supabase-format.ts`
5. Add comparison function in `compare-database-pages.ts`
6. Add case in `getExtraFieldKeysForDocumentType()` in `atlas-diff.ts`
7. Add case in `pickExtraFields()` in `notion-tree-to-export-tree.ts`
8. **Add `...pickExtraFields(node)` spread** in document type's case in `notionTreeNodeToExportTreeNode()` function
9. Add case in `getExtraFieldsForDocument()` in `atlas-markdown-exporter.ts`
10. Add case in `extractContentAndExtraFields()` in `atlas-markdown-importer.ts`
11. Add to `extraFieldsByDocumentType` in `json-export/types.ts`
12. Add validation case in `validate-export-atlas-tree.ts`
13. Add case in UI components (`page-extra-data.tsx`, `content-tree.tsx`, `sync/page.tsx`)
14. Add unit test in `notion-tree-to-export-tree.test.ts`

**Note**: Step 3 (updating `DOCUMENT_TYPE_EXTRA_FIELDS`) enables automatic discovery of extra fields across the codebase, allowing data-driven code to work without hardcoded type checks (e.g., the test database creation script).

## Testing Extra Fields

Run the Notion importer with local cache:

```bash
npx tsx scripts/import-notion-databases --disable-existing-locks --local-cache
```

Verify:

1. Check Supabase `notion_database_pages` table - `extra_fields` column should contain the fields
2. Check JSON export - fields should appear as top-level properties on documents
3. Check markdown export - fields should appear as labeled lines
4. Check UI - fields should display in page details and tree views
5. Test change detection - modify values in Notion and verify changes are detected
