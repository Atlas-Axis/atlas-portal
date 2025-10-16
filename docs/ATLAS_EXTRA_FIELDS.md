# Atlas Extra Fields Documentation

## Overview

**Extra Fields** are specialized properties that exist only for specific Atlas document types. Unlike standard properties (name, content, doc_no, type) that all documents have, extra fields provide additional metadata or structured information unique to certain document types.

Extra fields are:

- Stored in the `extra_fields` JSONB column in Supabase's `notion_database_pages` table
- Imported from specific Notion database page properties during sync
- Exported to JSON and Markdown formats
- Displayed in the UI alongside document content
- Compared during change detection

## Document Types with Extra Fields

Currently, four Atlas document types have extra fields: Type Specification, Scenario, Scenario Variation, and Needed Research.

### 1. Type Specification

**Interface**: `TypeSpecificationExtraFields`

| Supabase Field                            | Notion Property      | Description                    |
| ----------------------------------------- | -------------------- | ------------------------------ |
| `type_specification_doc_identifier_rules` | Doc Identifier Rules | Rules for document identifiers |
| `type_specification_additional_logic`     | Additional Logic     | Additional logical rules       |
| `type_specification_type_category`        | Type Category        | Category classification        |
| `type_specification_type_name`            | Type Name            | Name of the type               |
| `type_specification_type_overview`        | Type Overview        | Overview description           |
| `type_specification_components`           | Components           | Component information          |

**Mapping**: `TYPE_SPECIFICATION_PROPERTY_MAPPING`

### 2. Scenario

**Interface**: `ScenarioExtraFields`

| Supabase Field                 | Notion Property     | Description                                                    |
| ------------------------------ | ------------------- | -------------------------------------------------------------- |
| `scenario_finding`             | Finding             | Finding information                                            |
| `scenario_additional_guidance` | Additional Guidance | Additional guidance text                                       |
| `scenario_description`         | Description         | Main description (note: `content` field is null for Scenarios) |

**Mapping**: `SCENARIO_PROPERTY_MAPPING`

**Important**: The `Description` property maps to `scenario_description` in extra_fields, NOT to the `content` field.

### 3. Scenario Variation

**Interface**: `ScenarioVariationExtraFields`

| Supabase Field                           | Notion Property     | Description                                                              |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| `scenario_variation_finding`             | Finding             | Finding information                                                      |
| `scenario_variation_additional_guidance` | Additional Guidance | Additional guidance text                                                 |
| `scenario_variation_description`         | Description         | Main description (note: `content` field is null for Scenario Variations) |

**Mapping**: `SCENARIO_VARIATION_PROPERTY_MAPPING`

**Important**: The `Description` property maps to `scenario_variation_description` in extra_fields, NOT to the `content` field.

### 4. Needed Research

**Interface**: `NeededResearchExtraFields`

| Supabase Field            | Notion Property | Description                                                      |
| ------------------------- | --------------- | ---------------------------------------------------------------- |
| `needed_research_content` | Content         | Main content (note: `content` field is null for Needed Research) |

**Mapping**: `NEEDED_RESEARCH_PROPERTY_MAPPING`

**Important**: The `Content` property maps to `needed_research_content` in extra_fields, NOT to the `content` field.

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
- Iterates over the property mapping to generate `**Label**: value` formatted lines
- Handles null/undefined values gracefully

#### Markdown Import

**File**: `app/server/atlas/json-export/atlas-markdown-importer.ts`

- `extractContentAndExtraFields()` function: Parses markdown back to structured data
- Detects `**Label**: value` patterns
- Separates content from extra fields
- Initializes all expected fields to empty strings if not found

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
  - Defines all extra field interfaces
  - Defines property mappings (Supabase field → Notion property name)
  - Central source of truth for extra fields

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

1. **Update interface** in `notion-database-properties-and-relationships.ts`
   - Add new field to the appropriate `*ExtraFields` interface

2. **Update property mapping** in `notion-database-properties-and-relationships.ts`
   - Add mapping entry: `field_name: 'Notion Property Name'`

3. **Update extraction function** in `convert-notion-pages-to-supabase-format.ts`
   - Add field to initialization object (null default)
   - The loop will automatically extract it using the mapping

4. **All other systems automatically adapt** because they iterate over the mappings dynamically

## Adding Extra Fields to a New Document Type

1. Define interface in `notion-database-properties-and-relationships.ts`
2. Define property mapping constant
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
