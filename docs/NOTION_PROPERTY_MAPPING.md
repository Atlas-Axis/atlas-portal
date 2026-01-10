# Notion Property Mapping

## Overview

This document provides a comprehensive reference for how Notion database properties are mapped to Supabase fields during the Atlas import process. The mapping system enables consistent data transformation between Notion API responses and Supabase storage format.

**Source of Truth:** `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`

**Related Documentation:**

- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - Detailed 10-step import workflow
- **[ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md)** - Complete data pipeline overview

## Master Status Filters

All Atlas databases are filtered by their "Master Status" relation property during import. Only pages with the following statuses are imported:

**Included Statuses:**

- Approved
- Provisional
- Placeholder

**Excluded Statuses:**

- Deferred
- Archived

This filtering is implemented in `app/server/services/notion/notion-master-status-filters.ts` and applied during database queries via the Notion API.

## Property Mappings

The following table shows how Notion property names map to internal Supabase fields for each Atlas database:

| Database Name           | Name                  | Doc No                | Type     | Content | Extra Fields                                                                                |
| ----------------------- | --------------------- | --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------- |
| Scopes                  | Name                  | Doc No                | Type     | Content |                                                                                             |
| Articles                | Name                  | Doc No                | Type     | Content |                                                                                             |
| Sections & Primary Docs | Doc No (or Temp Name) | Doc No (or Temp Name) | Type     | Content | Components, Doc Identifier Rules, Additional Logic, Type Category, Type Name, Type Overview |
| Annotations             | Doc No                | Doc No                | Type     | Content |                                                                                             |
| Tenets                  | Doc No (or Temp Name) | Doc No (or Temp Name) | Type     | Content |                                                                                             |
| Scenarios               | Doc No (or Temp Name) | Doc No (or Temp Name) | Type     | N/A     | Description, Finding, Additional Guidance                                                   |
| Scenario Variations     | Doc No                | Doc No                | Type     | N/A     | Description, Finding, Additional Guidance                                                   |
| Active Data             | Doc No                | Doc No                | Type     | Content |                                                                                             |
| Agent Scope Database    | Document Name         | Formal Doc ID         | Doc Type | Content |                                                                                             |
| Needed Research         | Doc No                | Doc No                | Type     | N/A     | Content                                                                                     |

**Notes:**

- **Name**: Notion property name mapped to `atlasDocumentName` (document name display)
- **Doc No**: Notion property name mapped to `atlasDocumentNo` (document number identifier)
- **Type**: Notion property name mapped to `atlasDocumentType` (document type selector)
- **Content**: Notion property name mapped to main content field, or "N/A" if content is stored in extra fields
- **Extra Fields**: Additional properties specific to certain document types (see below)

## New Standardized Properties (Migration)

As part of the property standardization migration, two new properties have been added to ALL 10 Atlas databases:

| Property Name   | Type      | Purpose                      | Maps to Supabase Field  |
| --------------- | --------- | ---------------------------- | ----------------------- |
| Document Number | rich_text | Standardized document number | `atlas_document_number` |
| Document Title  | rich_text | Standardized document name   | `plain_text_name`       |

**Migration Status**: These fields are being populated as part of the ongoing migration. See [NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md](./action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md) for details.

**Import Behavior**: The import uses dual-read logic - preferring new fields when populated, falling back to old fields if empty.

**Sync Behavior**: The Markdown-to-Notion sync writes ONLY to new standardized fields, preserving old fields as backup during migration.

**Future State**: After migration is complete, the old database-specific property names (shown in the table above) will be deprecated and eventually removed. The new standardized properties will become the primary fields used across all workflows.

### Extra Fields by Document Type

**Type Specification** (in Sections & Primary Docs database):

- Components (Rich Text)
- Doc Identifier Rules (Rich Text)
- Additional Logic (Rich Text)
- Type Category (Select)
- Type Name (Rich Text)
- Type Overview (Rich Text)

**Scenario** (in Scenarios database):

- Description (Rich Text)
- Finding (Rich Text)
- Additional Guidance (Rich Text)

**Scenario Variation** (in Scenario Variations database):

- Description (Rich Text)
- Finding (Rich Text)
- Additional Guidance (Rich Text)

**Needed Research** (in Needed Research database):

- Content (Rich Text)

For complete documentation on extra fields, see **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)**.

## Inter-Database Relationships

The following table shows cross-database parent-child relationships via Notion relation properties:

| Parent Database         | Child Database          | Relationship Property Name |
| ----------------------- | ----------------------- | -------------------------- |
| Scopes                  | Articles                | Articles                   |
| Scopes                  | Needed Research         | Needed Research            |
| Articles                | Sections & Primary Docs | Sections & Primary Docs    |
| Articles                | Annotations             | Annotations                |
| Articles                | Needed Research         | Needed Research            |
| Sections & Primary Docs | Agent Scope Database    | Agent Scope Database       |
| Sections & Primary Docs | Annotations             | Annotations                |
| Sections & Primary Docs | Tenets                  | Tenets                     |
| Sections & Primary Docs | Active Data             | Active Data                |
| Sections & Primary Docs | Needed Research         | Needed Research            |
| Agent Scope Database    | Annotations             | Annotations                |
| Agent Scope Database    | Tenets                  | Tenets                     |
| Agent Scope Database    | Active Data             | Active Data                |
| Agent Scope Database    | Needed Research         | Needed Research            |
| Annotations             | Needed Research         | Needed Research            |
| Tenets                  | Scenarios               | Scenarios                  |
| Tenets                  | Needed Research         | Needed Research            |
| Scenarios               | Scenario Variations     | Scenario Variations        |
| Scenarios               | Needed Research         | Needed Research            |
| Scenario Variations     | Needed Research         | Needed Research            |

**Note:** Relationships in Supabase are stored as typed child ID arrays (e.g., `child_article_ids`, `child_section_and_primary_doc_ids`) rather than foreign key references.

## Same-Database Nested Relationships

Two Atlas databases support internal nesting where documents can be nested under other documents of the same type:

| Database Name           | Parent Property Name | Child Property Name |
| ----------------------- | -------------------- | ------------------- |
| Sections & Primary Docs | Parent Doc           | Subdocs             |
| Agent Scope Database    | Parent item          | Sub-item            |

These internal relationships enable deep hierarchical structures within a single database (e.g., Core → Core → Core nesting).

**Implementation Notes:**

- Internal parent-child relationships are managed exclusively through Notion relation properties
- The `parent_notion_page_id` field in Supabase stores internal parent references (null for cross-database children)
- When creating pages via Notion API, `parent` must always be set to database ID, never page ID
- Internal hierarchy is established through the relation properties listed above

## Property Type Overrides

Most Notion properties are assumed to be "rich_text" type. The following properties use different types:

**Title Properties:**

- Scopes: "Doc No"
- Articles: "Doc No"
- Sections & Primary Docs: "Doc No (or Temp Name)"
- Agent Scope Database: "Document Name"
- Annotations: "Doc No"
- Tenets: "Doc No (or Temp Name)"
- Active Data: "Doc No"
- Scenarios: "Doc No (or Temp Name)"
- Scenario Variations: "Doc No"
- Needed Research: "Doc No"

**Number Properties:**

- Sections & Primary Docs: "No." (sort order field)

**Select Properties:**

- All databases: "Type" (document type selector), except Agent Scope Database which uses "Doc Type"
- Sections & Primary Docs: "Type Category" (extra field for Type Specification)

These type overrides are critical when syncing from Markdown to Notion, as they determine the correct Notion API property format to use.

## Related Documentation

### Import Process

- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - Step-by-step import workflow with change detection
- **[ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md)** - Complete Notion → Supabase → Markdown pipeline
- **[NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md](./action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md)** - Property standardization migration plan

### Configuration Files

- `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts` - Complete property and relationship configuration
- `app/server/services/notion/notion-master-status-filters.ts` - Master Status filter implementation
- `app/server/atlas/constants.ts` - Atlas database constants and names

### Related Concepts

- **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)** - Extra fields documentation
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)** - Tree architecture and data structures
- **[UUID_MAPPING.md](./UUID_MAPPING.md)** - UUID mapping system
