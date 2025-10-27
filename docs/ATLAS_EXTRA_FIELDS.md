# Atlas Extra Fields Documentation

## Overview

**Extra Fields** are specialized properties that exist only for specific Atlas document types. Unlike standard properties (name, content, doc_no, type) that all documents have, extra fields provide additional metadata or structured information unique to certain document types.

Extra fields are:

- Stored in the `extra_fields` JSONB column in Supabase's `notion_database_pages` table
- Imported from specific Notion database page properties during sync
- Exported to JSON and Markdown formats
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
3. **Iteration**: Each function loops over its property mapping to extract values from Notion properties
4. **Storage**: Extracted fields are stored as a JSONB object in the `extra_fields` column

**Null Content Handling**: For Scenario, Scenario Variation, and Needed Research documents, the `content` property mapping is `null`. The extraction logic handles this by defaulting to an empty string.

### Export Process (Supabase → JSON/Markdown)

#### JSON Export

**Files**:

- `app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree.ts`
  - `pickExtraFields()` function: Extracts extra fields based on document type
  - `atlasNodeToStandardized()` function: Must spread `...pickExtraFields(node)` in the document type's case
  - Validates presence of expected fields and warns about missing ones
  - Returns a record with all expected keys (null if missing)

- `app/server/atlas/json-export/types.ts`
  - `extraFieldsByDocumentType` constant: Maps document types to their extra field keys
  - Document interfaces extend `BaseAtlasDocument` with extra field properties

#### Markdown Export

**File**: `app/server/atlas/json-export/atlas-markdown-exporter.ts`

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

**File**: `app/server/atlas/json-export/atlas-markdown-importer.ts`

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
  - Each function extracts fields from both Notion and Supabase, then compares field-by-field

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
  - `StandardizedExtraData` component: Renders extra fields in tree view
  - Filters out empty values before display
  - Uses property mappings to get human-readable labels

- `app/atlas/sync/page.tsx`
  - Displays extra fields in change detection UI
  - Uses property mappings for labels
  - Helper function `getExtraFieldMapping()`: Returns appropriate mapping

### Validation

**File**: `app/server/atlas/json-export/validate-standardized-atlas-tree.ts`

- Validates extra field presence and types for documents
- Ensures all fields defined in mappings exist on documents
- Uses `TYPE_SPECIFICATION_PROPERTY_MAPPING` and similar constants

## Core Files Reference

### Type Definitions & Mappings

- `app/server/atlas/notion-database-properties-and-relationships.ts`
  - Defines all extra field types (derived from property mappings via `ExtraFieldsFromMapping` utility type)
  - Defines property mappings (Supabase field → Notion property name)
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

- `app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree.ts`
  - Picks and validates extra fields for JSON export
  - Warning messages for missing fields

- `app/server/atlas/json-export/atlas-markdown-exporter.ts`
  - Formats extra fields for markdown export
  - Uses property mappings for labels

- `app/server/atlas/json-export/atlas-markdown-importer.ts`
  - Parses markdown back to structured extra fields
  - Handles labeled field format

- `app/server/atlas/json-export/types.ts`
  - Type definitions for exported Atlas documents
  - `extraFieldsByDocumentType` constant

- `app/server/atlas/json-export/validate-standardized-atlas-tree.ts`
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
   - Add mapping entry: `field_name: 'Notion Property Name'`
   - The type definition will automatically update thanks to `ExtraFieldsFromMapping<T>`

2. **Update extraction function** in `convert-notion-pages-to-supabase-format.ts`
   - Add field to initialization object (null default)
   - The loop will automatically extract it using the mapping

3. **All other systems automatically adapt** because they iterate over the mappings dynamically

## Adding Extra Fields to a New Document Type

1. Define property mapping constant in `notion-database-properties-and-relationships.ts` (using `as const`)
2. Define type using `ExtraFieldsFromMapping<typeof YOUR_PROPERTY_MAPPING>`
3. Add extraction function in `convert-notion-pages-to-supabase-format.ts`
4. Add comparison function in `compare-database-pages.ts`
5. Add case in `getExtraFieldKeysForDocumentType()` in `atlas-diff.ts`
6. Add case in `pickExtraFields()` in `atlas-node-tree-to-standardized-atlas-node-tree.ts`
7. **Add `...pickExtraFields(node)` spread** in document type's case in `atlasNodeToStandardized()` function
8. Add case in `getExtraFieldsForDocument()` in `atlas-markdown-exporter.ts`
9. Add case in `extractContentAndExtraFields()` in `atlas-markdown-importer.ts`
10. Add to `extraFieldsByDocumentType` in `json-export/types.ts`
11. Add validation case in `validate-standardized-atlas-tree.ts`
12. Add case in UI components (`page-extra-data.tsx`, `content-tree.tsx`, `sync/page.tsx`)
13. Add unit test in `atlas-node-tree-to-standardized-atlas-node-tree.test.ts`

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
