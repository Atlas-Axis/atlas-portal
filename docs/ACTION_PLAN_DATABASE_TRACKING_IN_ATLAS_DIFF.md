# Action Plan: Add Database Tracking to Atlas Diff

## Executive Summary

Replace the current flaky document name-based workaround for Agent Scope Database detection **in the sync library** with a proper architectural solution that tracks database information during tree traversal in `atlas-diff.ts`.

**Current Problem:** When `buildLookupMaps()` flattens the Export Tree into lookup maps, it loses the collection context (e.g., which collection a document came from: `sections_and_primary_docs` vs `agent_scope_database`). This makes it impossible to reliably determine if a Core or Active Data Controller document belongs to "Sections & Primary Docs" vs "Agent Scope Database".

**Current Workaround:** Check ancestry for a hard-coded document name "List Of Prime Agent Artifacts" (stored in `AGENT_ROOT_DOCUMENT_NAME`). This is flaky because:

- Breaks if the document is renamed
- Breaks if the document is deleted
- Breaks if a different document structure is used
- Not a proper architectural solution

**Proposed Solution:** Track the collection name during tree traversal and derive the database from it. Since each collection name uniquely maps to exactly one database, this provides reliable database identification.

**IMPORTANT SCOPE LIMITATION:** This solution applies **only to the sync library** (`atlas-database-mapper.ts`). The markdown importer (`atlas-markdown-importer.ts`) requires a different approach (see "Markdown Importer Consideration" section below).

## Why This Solution Works

### Collection Name → Database Mapping

Each collection name in the Export Tree uniquely identifies a database:

| Collection Name             | Database Name           | Document Types                                            |
| --------------------------- | ----------------------- | --------------------------------------------------------- |
| `articles`                  | Articles                | Article                                                   |
| `sections_and_primary_docs` | Sections & Primary Docs | Section, Core, Type Specification, Active Data Controller |
| `agent_scope_database`      | Agent Scope Database    | Core, Active Data Controller                              |
| `annotations`               | Annotations             | Annotation                                                |
| `tenets`                    | Tenets                  | Action Tenet                                              |
| `scenarios`                 | Scenarios               | Scenario                                                  |
| `scenario_variations`       | Scenario Variations     | Scenario Variation                                        |
| `active_data`               | Active Data             | Active Data                                               |
| `needed_research`           | Needed Research         | Needed Research                                           |

**Key Insight:** Even though Section documents can have BOTH `sections_and_primary_docs` AND `agent_scope_database` child collections, a Core document that appears in the `agent_scope_database` collection definitively belongs to the "Agent Scope Database" database, while one in `sections_and_primary_docs` belongs to "Sections & Primary Docs".

### Why Current Code Loses This Information

In `atlas-diff.ts`, the `buildLookupMaps()` function:

```typescript
function traverseDocument(doc: ExportAtlasTreeDocument, ancestry: string[] = []) {
  // Stores stripped document (without children)
  uuidToDoc.set(doc.uuid, strippedDoc);

  // Traverses child collections
  for (const collectionName of childCollectionNames) {
    const collection = docAsRecord[collectionName];
    if (Array.isArray(collection)) {
      for (const child of collection) {
        traverseDocument(child, childAncestry); // ❌ collectionName is lost here!
      }
    }
  }
}
```

The `collectionName` is available during traversal but not passed down or tracked, so when we later need to know which database a document belongs to, we have no way to determine it.

## Implementation Plan

### Phase 1: Add Database Tracking to `buildLookupMaps()`

**File:** `app/server/atlas/diff/atlas-diff.ts`

#### Step 1.1: Update `LookupMaps` Interface

Add a new map to track UUID → database mappings:

```typescript
export interface LookupMaps {
  uuidToDoc: Map<string, ExportAtlasTreeBaseDocument>;
  docNoToDoc: Map<string, ExportAtlasTreeBaseDocument>;
  uuidToAncestry: Map<string, string[]>;
  uuidToDatabase: Map<string, AtlasDatabaseName>; // NEW: Track which database each document belongs to
}
```

#### Step 1.2: Create Collection → Database Mapping Function

Add a helper function to derive database from collection name:

```typescript
/**
 * Maps a collection name to its corresponding Atlas database name.
 * Each collection name uniquely identifies a database in the Export Tree.
 */
function getDatabaseFromCollectionName(collectionName: string): AtlasDatabaseName {
  const mapping: Record<string, AtlasDatabaseName> = {
    articles: 'Articles',
    sections_and_primary_docs: 'Sections & Primary Docs',
    agent_scope_database: 'Agent Scope Database',
    annotations: 'Annotations',
    tenets: 'Tenets',
    scenarios: 'Scenarios',
    scenario_variations: 'Scenario Variations',
    active_data: 'Active Data',
    needed_research: 'Needed Research',
  };

  const database = mapping[collectionName];
  if (!database) {
    throw new Error(`Unknown collection name: ${collectionName}`);
  }
  return database;
}
```

#### Step 1.3: Update `buildLookupMaps()` to Track Database

Modify the traversal function to track which collection (and thus which database) each document came from:

```typescript
export function buildLookupMaps(scopeTrees: ExportAtlasTreeScopeTrees): LookupMaps {
  const uuidToDoc = new Map<string, ExportAtlasTreeBaseDocument>();
  const docNoToDoc = new Map<string, ExportAtlasTreeBaseDocument>();
  const uuidToAncestry = new Map<string, string[]>();
  const uuidToDatabase = new Map<string, AtlasDatabaseName>(); // NEW

  function traverseDocument(
    doc: ExportAtlasTreeDocument,
    ancestry: string[] = [],
    parentCollectionName?: string, // NEW: Track which collection this doc came from
  ) {
    const strippedDoc = stripChildCollections(doc);

    if (!doc.uuid) {
      console.error(`Document without UUID found: type="${doc.type}", doc_no="${doc.doc_no}", name="${doc.name}"`);
    } else {
      uuidToDoc.set(doc.uuid, strippedDoc);
      uuidToAncestry.set(doc.uuid, [...ancestry]);

      // NEW: Derive and store database from collection name
      if (parentCollectionName) {
        const database = getDatabaseFromCollectionName(parentCollectionName);
        uuidToDatabase.set(doc.uuid, database);
      } else {
        // Root documents are always Scopes
        uuidToDatabase.set(doc.uuid, 'Scopes');
      }
    }

    docNoToDoc.set(doc.doc_no, strippedDoc);

    const childAncestry = doc.uuid ? [...ancestry, doc.uuid] : ancestry;

    // Traverse child collections and pass collection name down
    const docAsRecord = doc as unknown as Record<string, unknown>;
    for (const collectionName of childCollectionNames) {
      const collection = docAsRecord[collectionName];
      if (Array.isArray(collection)) {
        for (const child of collection as ExportAtlasTreeDocument[]) {
          traverseDocument(child, childAncestry, collectionName); // NEW: Pass collection name
        }
      }
    }
  }

  for (const rootDoc of scopeTrees) {
    traverseDocument(rootDoc); // Root docs have no parent collection
  }

  return { uuidToDoc, docNoToDoc, uuidToAncestry, uuidToDatabase }; // NEW: Include database map
}
```

#### Step 1.4: Update `AtlasDiffResult` Interface

Include the new database map in the diff result:

```typescript
export interface AtlasDiffResult {
  changes: GroupedAtlasChanges;
  originalIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>;
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>;
  originalIdsToDatabase: Map<string, AtlasDatabaseName>; // NEW
  newIdsToDatabase: Map<string, AtlasDatabaseName>; // NEW
}
```

#### Step 1.5: Update `diffAtlasScopeTreeLists()` Function

Pass the database maps through to the result:

```typescript
export function diffAtlasScopeTreeLists(
  originalTrees: ExportAtlasTreeScopeTrees,
  newTrees: ExportAtlasTreeScopeTrees,
): AtlasDiffResult {
  const original = buildLookupMaps(originalTrees);
  const updated = buildLookupMaps(newTrees);

  const changes = detectChanges(original.uuidToDoc, updated.uuidToDoc, original.uuidToAncestry, updated.uuidToAncestry);

  return {
    changes,
    originalIdsToDocuments: original.uuidToDoc,
    newIdsToDocuments: updated.uuidToDoc,
    originalIdsToDatabase: original.uuidToDatabase, // NEW
    newIdsToDatabase: updated.uuidToDatabase, // NEW
  };
}
```

### Phase 2: Update Sync Library to Use Database Tracking

**Files:**

- `app/atlas/sync/_lib/atlas-database-mapper.ts`
- `app/atlas/sync/_lib/__tests__/atlas-database-mapper.test.ts`
- `app/atlas/sync/_actions/sync-actions.ts`
- `app/atlas/sync/_lib/sync-orchestrator.ts`
- `app/atlas/sync/_lib/notion-property-builder.ts`

#### Step 2.1: Update `getDatabaseNameFromDocument()` Signature

Remove the workaround logic and use the database map directly:

```typescript
/**
 * Gets the Atlas database name for a document based on its type.
 *
 * For Core and Active Data Controller, uses the database tracking map
 * to determine the correct database (Sections & Primary Docs vs Agent Scope Database).
 */
export function getDatabaseNameFromDocument(
  documentType: AtlasDocumentType,
  documentUuid: string,
  uuidToDatabase: Map<string, AtlasDatabaseName>,
): AtlasDatabaseName {
  // Most types have direct mappings
  const directMapping: Partial<Record<AtlasDocumentType, AtlasDatabaseName>> = {
    Scope: 'Scopes',
    Article: 'Articles',
    Section: 'Sections & Primary Docs',
    'Type Specification': 'Sections & Primary Docs',
    Annotation: 'Annotations',
    'Action Tenet': 'Tenets',
    Scenario: 'Scenarios',
    'Scenario Variation': 'Scenario Variations',
    'Active Data': 'Active Data',
    'Needed Research': 'Needed Research',
  };

  const directDatabase = directMapping[documentType];
  if (directDatabase) {
    return directDatabase;
  }

  // Core and Active Data Controller need disambiguation via database tracking
  if (documentType === 'Core' || documentType === 'Active Data Controller') {
    const database = uuidToDatabase.get(documentUuid);
    if (database) {
      return database;
    }

    // Fallback: If not in map (shouldn't happen), default to Sections & Primary Docs
    console.warn(`Document ${documentUuid} not found in database tracking map, defaulting to Sections & Primary Docs`);
    return 'Sections & Primary Docs';
  }

  throw new Error(`No database mapping found for document type: ${documentType}`);
}
```

#### Step 2.2: Update All Callers

Update all calls to `getDatabaseNameFromDocument()`:

**In `sync-actions.ts`:**

```typescript
// Update content changes
const databaseName = getDatabaseNameFromDocument(
  change.oldValues.type,
  change.uuid,
  originalIdsToDatabase, // NEW: Pass database map instead of document map
);

// Create new pages
const databaseName = getDatabaseNameFromDocument(
  doc.type,
  doc.uuid,
  newIdsToDatabase, // NEW
);

// Check for children
const databaseName = getDatabaseNameFromDocument(
  pageDocument.type,
  pageUuid,
  uuidToDatabase, // NEW
);
```

**In `sync-orchestrator.ts`:**

```typescript
// Pass database maps to sync actions
await updateNotionPageContent(change, uuidMappings, diffResult.originalIdsToDatabase);
await createNotionDatabasePage(change, uuidMappings, diffResult.newIdsToDatabase);
```

**In `notion-property-builder.ts`:**

```typescript
const parentDatabaseName = getDatabaseNameFromDocument(
  parentDoc.type,
  parentUuid,
  uuidToDatabase, // NEW
);
```

#### Step 2.3: Update Tests

Simplify tests by removing the workaround logic and using direct database lookups:

```typescript
it('maps Core to Agent Scope Database when tracked in database map', () => {
  const uuidToDatabase = new Map<string, AtlasDatabaseName>([['agent-core-uuid', 'Agent Scope Database']]);

  expect(getDatabaseNameFromDocument('Core', 'agent-core-uuid', uuidToDatabase)).toBe('Agent Scope Database');
});

it('maps Core to Sections & Primary Docs when tracked in database map', () => {
  const uuidToDatabase = new Map<string, AtlasDatabaseName>([['regular-core-uuid', 'Sections & Primary Docs']]);

  expect(getDatabaseNameFromDocument('Core', 'regular-core-uuid', uuidToDatabase)).toBe('Sections & Primary Docs');
});
```

### Phase 3: Remove Workaround Code

**Files:**

- `app/server/atlas/constants.ts` (keep constant, update documentation)
- `app/atlas/sync/_lib/atlas-database-mapper.ts` (remove workaround logic)
- `app/server/atlas/export/atlas-markdown-importer.ts` (update/improve logic)
- `docs/ATLAS_DATA_PIPELINE.md`
- `app/atlas/sync/AGENTS.md`

#### Step 3.1: Update Constant Documentation

Update the documentation for `AGENT_ROOT_DOCUMENT_NAME` in `constants.ts`:

```typescript
/**
 * Hard-coded document name used to identify Agent Scope Database context.
 *
 * MARKDOWN IMPORTER REQUIREMENT: The markdown importer requires this constant
 * because it parses documents incrementally and must decide which collection
 * to insert Core/ADC children into based on the parent Section's name.
 *
 * The parent Section "List Of Prime Agent Artifacts" belongs to "Sections & Primary Docs"
 * database but has Core children that should go into its `agent_scope_database` collection
 * rather than `sections_and_primary_docs` collection. Without this name check, the
 * importer cannot make the correct collection-level decision during incremental parsing.
 *
 * SYNC LIBRARY: The sync library does NOT use this constant. It uses database tracking
 * from buildLookupMaps() in atlas-diff.ts for reliable database identification.
 *
 * This name-based check is unavoidable for the markdown importer due to its parsing model.
 */
export const AGENT_ROOT_DOCUMENT_NAME = 'List Of Prime Agent Artifacts';
```

#### Step 3.2: Update Markdown Importer Logic

Improve `mapTypeToDatabase()` in `atlas-markdown-importer.ts` to handle nested Agent documents:

```typescript
case 'Core':
case 'Active Data Controller': {
  // Check if parent is the agent root section by name
  const parentIsAgentRoot = ancestors.length > 0 &&
    (ancestors[ancestors.length - 1].node as ExportAtlasTreeBaseDocument).name === AGENT_ROOT_DOCUMENT_NAME;

  if (parentIsAgentRoot) {
    return 'Agent Scope Database';
  }

  // Also check if ANY ancestor in the chain is from Agent Scope Database
  // This handles nested Core → Core → Core under the agent root
  const hasAgentAncestor = ancestors.some(a => a.database === 'Agent Scope Database');
  if (hasAgentAncestor) {
    return 'Agent Scope Database';
  }

  // Default to Sections & Primary Docs
  return 'Sections & Primary Docs';
}
```

#### Step 3.3: Update Documentation

Update the "Agent Scope Database Detection" sections in documentation to explain the two different approaches:

**In `docs/ATLAS_DATA_PIPELINE.md`:**

Replace the current workaround section with:

```markdown
### Agent Scope Database Detection

Two different approaches are used depending on the context:

#### Sync Library (Proper Solution)

The sync library uses **database tracking from `buildLookupMaps()`** in `atlas-diff.ts`:

- When the Export Tree is flattened into lookup maps, the system tracks which collection each document came from
- Collection name uniquely identifies the database (e.g., `agent_scope_database` collection → Agent Scope Database)
- Core/ADC documents are reliably identified via direct map lookup using their UUID
- No heuristics or hardcoded values needed

**Files:** `app/server/atlas/diff/atlas-diff.ts`, `app/atlas/sync/_lib/atlas-database-mapper.ts`

#### Markdown Importer (Name-Based Check)

The markdown importer uses **document name checking**:

- Parses line-by-line incrementally, building the tree as it goes
- Must decide which collection to insert Core/ADC children into when parsing
- Checks if parent Section is named "List Of Prime Agent Artifacts"
- If yes, child goes into `agent_scope_database` collection; otherwise `sections_and_primary_docs`
- This is unavoidable due to the incremental parsing model

**Limitation:** Relies on a hard-coded document name and will break if renamed.

**Files:** `app/server/atlas/export/atlas-markdown-importer.ts`, `app/server/atlas/constants.ts` (`AGENT_ROOT_DOCUMENT_NAME`)
```

**In `app/atlas/sync/AGENTS.md`:**

Replace the workaround section with:

```markdown
### Database Derivation (Database Tracking)

The sync system uses **database tracking from atlas-diff.ts** for reliable database identification:

- When diffing markdown vs Supabase, `buildLookupMaps()` tracks which collection each document came from
- Collection names uniquely map to databases (e.g., `agent_scope_database` → Agent Scope Database)
- Core/ADC documents are identified via direct UUID lookup in the database tracking map
- No document name checks or ancestry traversal needed

This eliminates the flaky workaround and provides a proper architectural solution for the sync workflow.

**Note:** The markdown importer still uses a name-based check due to its incremental parsing model, but this doesn't affect the sync workflow.
```

#### Step 3.4: Update Comments

Remove workaround comments from `app/atlas/sync/_lib/atlas-database-mapper.ts` and replace with references to database tracking.

### Phase 4: Handle Edge Cases

#### Edge Case 1: Documents Without UUIDs

Current code skips documents without UUIDs. Ensure the database tracking also handles this gracefully:

```typescript
if (!doc.uuid) {
  console.error(`Document without UUID found: type="${doc.type}", doc_no="${doc.doc_no}", name="${doc.name}"`);
  // Don't add to uuidToDatabase map since there's no UUID
} else {
  // Normal tracking
}
```

#### Edge Case 2: New Documents in Markdown

For documents that only exist in the Markdown (not in Supabase yet), the database tracking in the "new" map will correctly identify their database based on which collection they were parsed into.

### Phase 5: Markdown Importer Consideration

**CRITICAL INSIGHT:** The markdown importer (`atlas-markdown-importer.ts`) **CANNOT** use the database tracking solution from `buildLookupMaps()` because:

1. **Different parsing flow**: The importer parses line-by-line and builds the tree incrementally, not by traversing an existing tree
2. **The parent database check is insufficient**: Consider this real-world case:

   ```
   Section "List Of Prime Agent Artifacts" [in Sections & Primary Docs database]
   ├── Core "Spark" [should go into agent_scope_database collection]
   ```

   - The parent Section belongs to "Sections & Primary Docs" database
   - But the Core child should go into the `agent_scope_database` collection, not `sections_and_primary_docs`
   - Checking `parentDatabase === 'Agent Scope Database'` returns false ❌
   - The parent is in "Sections & Primary Docs", but has BOTH collection types

3. **The importer needs collection-level decisions**: It must decide which collection to insert into based on the **parent's name** when the parent is a Section.

#### Solution for Markdown Importer

**Keep the document name check** in `mapTypeToDatabase()` but clarify its purpose:

```typescript
case 'Core':
case 'Active Data Controller': {
  // Check if parent is the agent root section by name
  const parentIsAgentRoot = ancestors.length > 0 &&
    ancestors[ancestors.length - 1].node.name === AGENT_ROOT_DOCUMENT_NAME;

  if (parentIsAgentRoot) {
    return 'Agent Scope Database';
  }

  // Also check if ANY ancestor in the chain is from Agent Scope Database
  // This handles nested Core → Core → Core under the agent root
  const hasAgentAncestor = ancestors.some(a => a.database === 'Agent Scope Database');
  if (hasAgentAncestor) {
    return 'Agent Scope Database';
  }

  // Default to Sections & Primary Docs
  return 'Sections & Primary Docs';
}
```

This approach:

- ✅ Handles the agent root section by name
- ✅ Handles nested Core documents under the agent root
- ✅ Works during incremental parsing
- ⚠️ Still relies on a hard-coded document name (unavoidable for the importer)

**Documentation Update**: Document that the markdown importer requires this workaround due to its incremental parsing model, and explain why it cannot use the database tracking approach.

## Benefits of This Solution (Sync Library)

1. **Architecturally Sound**: Uses the actual data structure rather than heuristics
2. **Reliable**: Collection names are part of the type system and won't change
3. **Type-Safe**: Leverages TypeScript's type system for correctness
4. **No Hardcoded Values in Sync Library**: Eliminates dependency on document names for the sync workflow
5. **Works for All Sync Cases**: Handles both existing and new documents uniformly
6. **Future-Proof**: If more databases with shared document types are added, the approach scales
7. **Better Performance**: Direct map lookup instead of ancestry traversal with name checks
8. **Easier to Test**: Simpler test cases without workarounds
9. **Cleaner Sync Code**: Removes complexity from sync library

## Limitations

1. **Markdown Importer Still Needs Workaround**: The importer's incremental parsing model requires the document name check
2. **Two Different Approaches**: Sync library uses database tracking, importer uses name checking
3. **Not a Complete Elimination**: The `AGENT_ROOT_DOCUMENT_NAME` constant remains needed for the importer

## Testing Strategy

### Unit Tests

1. **`atlas-diff.test.ts`** (new file):
   - Test `getDatabaseFromCollectionName()` for all collection names
   - Test that `buildLookupMaps()` correctly tracks databases
   - Test that root Scope documents are correctly identified
   - Test that nested documents get correct database assignments

2. **`atlas-database-mapper.test.ts`** (update existing):
   - Simplify tests to use database maps directly
   - Remove all ancestry-based workaround tests
   - Add tests for direct database map lookup
   - Test fallback behavior when UUID not in map

### Integration Tests

1. Test full diff workflow with Agent Scope Database documents
2. Test sync workflow with Core documents in both databases
3. Test with real exported Atlas data

### Regression Tests

1. Run existing test suite to ensure no breaking changes
2. Verify all 42 tests in `atlas-database-mapper.test.ts` still pass
3. Verify markdown importer tests still pass

## Rollout Plan

### Step 1: Implement Core Functionality

- Add database tracking to `buildLookupMaps()`
- Update interfaces and types
- Add unit tests for new functionality

### Step 2: Update Sync Library

- Modify `getDatabaseNameFromDocument()` signature
- Update all callers
- Update tests

### Step 3: Update Workaround Documentation

- Keep `AGENT_ROOT_DOCUMENT_NAME` constant (needed for markdown importer)
- Remove workaround logic from sync library only
- Update documentation to clarify the two different approaches

### Step 4: Verification

- Run full test suite
- Test with real Atlas data
- Verify sync workflow works correctly

## Success Criteria

- [ ] All tests pass (no regressions)
- [ ] Database tracking correctly identifies Agent Scope Database documents in sync workflow
- [ ] Sync library eliminates document name checks (uses database tracking)
- [ ] Markdown importer correctly handles agent root section by name (improved logic)
- [ ] Sync workflow correctly creates/updates documents in both databases
- [ ] Documentation explains both approaches and why each is needed
- [ ] Code is clearer with proper separation of concerns

## Estimated Effort

- **Phase 1**: 2-3 hours (core implementation)
- **Phase 2**: 2-3 hours (sync library updates)
- **Phase 3**: 1 hour (cleanup)
- **Phase 4**: 1 hour (edge cases and testing)
- **Total**: 6-8 hours

## References

- **Current Workaround Documentation**: `docs/ATLAS_DATA_PIPELINE.md` (Agent Scope Database Detection section)
- **Export Tree Types**: `app/server/atlas/export/types.ts`
- **Atlas Diff Implementation**: `app/server/atlas/diff/atlas-diff.ts`
- **Sync Library**: `app/atlas/sync/_lib/atlas-database-mapper.ts`
- **Related Issue**: Markdown importer test failing because it relies on parent database from stack
