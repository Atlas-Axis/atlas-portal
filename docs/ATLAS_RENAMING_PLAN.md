# Rename Atlas Tree Types to Distinguish Notion Tree vs Export Tree

## Type Renaming Strategy

### Notion Tree Types (Internal Representation)

- `AtlasTreeNode` → `NotionAtlasTreeNode`
- `AtlasTreeResult` → `NotionAtlasTreeResult`
- `AtlasTreeNodeRelationship` → `NotionAtlasTreeNodeRelationship`
- `atlasTreeNodeRelationshipNames` → `notionAtlasTreeNodeRelationshipNames`
- `DuplicatedNodeEntry` → `NotionAtlasTreeDuplicatedNodeEntry`
- `AtlasUUIDToDocNoAndDocNameMaps` → `NotionAtlasTreeUUIDToDocNoAndDocNameMaps`
- `TreeConstructionError` → `NotionAtlasTreeConstructionError`
- `AtlasLookupMaps` → `NotionAtlasTreeLookupMaps`
- `TreeConstructionOptions` → `NotionAtlasTreeConstructionOptions`

### Export Tree Types (External Representation)

- `StandardizedAtlasDocument` → `ExportAtlasTreeDocument`
- `StandardizedAtlasScopeTrees` → `ExportAtlasTreeScopeTrees`
- `BaseAtlasDocument` → `ExportAtlasTreeBaseDocument`
- Database-specific document types:
- `ScopesDocument` → `ExportAtlasTreeScopesDocument`
- `ArticlesDocument` → `ExportAtlasTreeArticlesDocument`
- `SectionsAndPrimaryDocsDocument` → `ExportAtlasTreeSectionsAndPrimaryDocsDocument`
- `AnnotationsDocument` → `ExportAtlasTreeAnnotationsDocument`
- `TenetsDocument` → `ExportAtlasTreeTenetsDocument`
- `ScenariosDocument` → `ExportAtlasTreeScenariosDocument`
- `ScenarioVariationsDocument` → `ExportAtlasTreeScenarioVariationsDocument`
- `ActiveDataDocument` → `ExportAtlasTreeActiveDataDocument`
- `AgentScopeDatabaseDocument` → `ExportAtlasTreeAgentScopeDatabaseDocument`
- `NeededResearchDocument` → `ExportAtlasTreeNeededResearchDocument`

### Function Renaming

- `atlasNodeToStandardized()` → `notionTreeNodeToExportTreeDocument()`
- `buildAtlasTree()` → `buildNotionAtlasTree()`
- `validateStandardizedAtlasTree()` → `validateExportAtlasTree()`
- `buildAtlasJSON()` → `buildExportAtlasTreeJSON()` (in `atlas-json-exporter.ts`)

## Implementation Steps

### 1. Core Type Definitions

**File: `app/server/atlas/tree/atlas-tree-types.ts`**

- Rename all Notion Tree type definitions
- Update JSDoc comments to clarify "Notion Tree (Internal Representation)"
- Update interface field documentation

**File: `app/server/atlas/export/types.ts`**

- Rename all Export Tree type definitions
- Update JSDoc comments to clarify "Export Tree (External Representation)"
- Update `childCollectionNameToDatabaseName` and related constants
- Update `allowedChildCollectionNamesPerDatabase` map

### 2. Tree Building and Processing

**File: `app/server/atlas/tree/atlas-tree-builder.ts`**

- Rename `buildAtlasTree()` → `buildNotionAtlasTree()`
- Update all internal type references
- Update return type and parameters

**File: `app/server/atlas/tree/atlas-tree-system.ts`**

- Update all re-exports with new names

**Files: `app/server/atlas/tree/atlas-tree-*.ts`**

- `atlas-tree-traversal.ts` - Update type references in function signatures
- `atlas-tree-helpers.ts` - Update type references
- `atlas-tree-numbering.ts` - Update type references
- `atlas-tree-mentions.ts` - Update type references
- `atlas-tree-errors.ts` - Update type references

### 3. Conversion Function

**File: `app/server/atlas/export/atlas-node-tree-to-standardized-atlas-node-tree.ts`**

- Rename function: `atlasNodeToStandardized()` → `notionTreeNodeToExportTreeDocument()`
- Update all type references (parameter types, return types, internal variables)
- Update file-level JSDoc comments
- Consider renaming file to match new function name

### 4. Export System

**File: `app/server/atlas/export/atlas-json-exporter.ts`**

- Rename `buildAtlasJSON()` → `buildExportAtlasTreeJSON()`
- Update all type references
- Update function calls to use new names

**File: `app/server/atlas/export/atlas-markdown-exporter.ts`**

- Update type references for Export Tree types
- Update function signatures if needed

**File: `app/server/atlas/export/atlas-markdown-importer.ts`**

- Update return types and type references

**File: `app/server/atlas/export/validate-standardized-atlas-tree.ts`**

- Rename `validateStandardizedAtlasTree()` → `validateExportAtlasTree()`
- Update validation function names and type references
- Update ValidationError types if needed

### 5. Scripts

**File: `scripts/atlas-export/generate-atlas-json.ts`**

- Update function calls: `buildAtlasTree()` → `buildNotionAtlasTree()`
- Update type imports and references

**File: `scripts/atlas-export/generate-atlas-markdown.ts`**

- Update function calls and type references

**File: `scripts/atlas-export/convert-atlas-markdown-to-json.ts`**

- Update type references

**File: `scripts/validate-atlas-json.ts`**

- Update function calls: `validateStandardizedAtlasTree()` → `validateExportAtlasTree()`
- Update type references

### 6. UI Components

**File: `app/atlas/page.tsx`**

- Update function calls: `buildAtlasTree()` → `buildNotionAtlasTree()`
- Update type references
- Update props passed to components

**File: `app/atlas/sidebar.tsx`**

- Update prop types and internal references

**File: `app/atlas/content-tree.tsx`**

- Update prop types and internal references

**File: `app/atlas/search-modal.tsx`**

- Update type references

**File: `app/atlas/mobile-top-bar.tsx`**

- Update type references

**File: `app/atlas/tree-utils.ts`**

- Update type references

**File: `app/atlas/standardized-extra-data.tsx`**

- Update type references

**File: `app/atlas/atlas-page-prerendered.tsx`**

- Update type references

### 7. Atlas Sync System (Markdown to Notion)

**File: `app/atlas/sync/_lib/sync-orchestrator.ts`**

- Update type references to Export Tree types

**File: `app/atlas/sync/_lib/notion-property-builder.ts`**

- Update type references to Export Tree types

**File: `app/atlas/sync/_lib/atlas-database-mapper.ts`**

- Update type references to Export Tree types

**File: `app/atlas/sync/_actions/sync-actions.ts`**

- Update type references

**Test files:**

- `app/atlas/sync/_lib/__tests__/sync-orchestrator.test.ts`
- `app/atlas/sync/_lib/__tests__/notion-property-builder.test.ts`
- `app/atlas/sync/_lib/__tests__/atlas-database-mapper.test.ts`
- `app/atlas/sync/_actions/__tests__/sync-actions.test.ts`

### 8. Other Server Files

**File: `app/server/atlas/formatters/atlas-rich-text-formatter.ts`**

- Update type references

**File: `app/server/atlas/diff/atlas-diff.ts`**

- Update type references

**File: `app/server/atlas/diff/markdown-supabase-diff.ts`**

- Update type references

### 9. Test Files

Update all test files to use new type names:

- `app/server/atlas/tree/__tests__/atlas-tree-builder.test.ts`
- `app/server/atlas/tree/__tests__/atlas-tree-numbering.test.ts`
- `app/server/atlas/tree/__tests__/atlas-tree-helpers.test.ts`
- `app/server/atlas/tree/__tests__/atlas-tree-builder-mentions.test.ts`
- `app/server/atlas/export/__tests__/atlas-node-tree-to-standardized-atlas-node-tree.test.ts`
- `app/server/atlas/export/__tests__/atlas-markdown-exporter.test.ts`
- `app/server/atlas/export/__tests__/validate-standardized-atlas-tree.test.ts`
- `app/server/atlas/diff/__tests__/markdown-supabase-diff.test.ts`
- `app/atlas/__tests__/search-modal.test.tsx`

### 10. Documentation Files

Update all documentation to use new type names and clarify the distinction:

**File: `docs/ATLAS_TREE_STRUCTURES.md`** (Primary documentation - 797 lines)

- Update all type names throughout
- Update code examples
- Update type structure sections
- Update field mapping tables
- Update comparison summary table

**File: `app/server/atlas/tree/AGENTS.md`** (450 lines)

- Update all type references
- Update API reference section
- Update code examples
- Update data structures section

**File: `docs/UUID_MAPPING.md`**

- Update type references where Atlas trees are mentioned

**File: `docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md`**

- Update type references for Export Tree

**File: `docs/ATLAS_EXTRA_FIELDS.md`**

- Update type references if mentioned

**File: `docs/ATLAS_DIFFING.md`**

- Update type references if mentioned

**File: `.cursorrules`** (669 lines)

- Update type references in relevant sections

**File: `README.md`** (691 lines)

- Update any references to tree types

## Validation

After renaming:

1. Run TypeScript compiler to check for any missed references: `npm run build`
2. Run full test suite: `npm run test:run`
3. Verify documentation is consistent with code
4. Test Atlas page loads correctly in browser
5. Test export scripts work: `npx tsx scripts/atlas-export/generate-atlas-markdown.ts`
