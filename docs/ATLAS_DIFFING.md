# Atlas Tree Diffing

Compares two versions of the Atlas document hierarchy (Supabase vs Markdown export) and identifies all changes.

The Atlas Diffing system provides a robust mechanism for comparing two versions of the Atlas document hierarchy and identifying all changes between them.

### Purpose

Compare two versions of the complete Atlas document tree:

- **Original version**: Current data stored in Supabase database
- **New version**: Markdown export of Atlas documents

### Goal

Identify all changes between versions with high precision:

- New documents added
- Documents deleted/removed
- Field modifications (content, name, type)
- Documents moved to different parents
- Documents reordered among siblings

### Use Cases

- **Change Tracking**: See the list of differences between the Atlas stored in a Markdown file (new) and in Supabase (old)
- **Synchronization**: Use the change list to synchronize changes back to Notion

## Change Types

### 1. Added

New documents (UUID in new version only)

### 2. Deleted

Removed documents (UUID in original only)

### 3. Changed

Field modifications: `type`, `name`, `content`, and type-specific extra fields

- **Note**: `last_modified` changes are ignored

### 4. Parent Changed

Document moved to different parent (ancestry array differs)

- **Note**: When parent changes, `doc_no` typically changes too, but only `parent_changed` is recorded

### 5. Sibling Order Changed

Document reordered among siblings (`doc_no` changed, same ancestry)

- **Note**: Mutually exclusive with Parent Changed

## Key Design Decision: Ancestry Tracking

**Problem with doc_no parsing:**

- Parsing `"A.1.2.3"` → `["A", "A.1", "A.1.2"]` fails for Needed Research documents
- Needed Research uses global numbering (`NR-1`, `NR-2`) regardless of parent
- Moving `NR-1` between parents wouldn't be detected (number stays same)

**Solution:**
Track ancestry during tree traversal, not by parsing `doc_no`:

- Build `uuidToAncestry` map during recursive traversal
- Each document stores actual parent chain
- Works for all document types (hierarchical or global numbering)

**Example:**

```typescript
// Standard hierarchical doc: A.1.2.3
ancestry: ['uuid-A.1.2', 'uuid-A.1', 'uuid-A'];

// Needed Research with global numbering: NR-1
ancestry: ['uuid-article', 'uuid-scope'];
```

## API

```typescript
async function diffAtlasScopeTreeLists(): Promise<AtlasDiffResult>;

interface AtlasDiffResult {
  changes: GroupedAtlasChanges;
  originalIdsToDocuments: Map<string, BaseAtlasDocument>;
  newIdsToDocuments: Map<string, BaseAtlasDocument>;
}

interface GroupedAtlasChanges {
  added: AtlasDocumentChange[];
  deleted: AtlasDocumentChange[];
  changed: AtlasDocumentChange[];
  parent_changed: AtlasDocumentChange[];
  sibling_order_changed: AtlasDocumentChange[];
}
```

## Important Implementation Details

### Multiple Changes for Same Document

A document can appear in multiple change arrays:

- Field changes + parent change = 2 separate change records
- Each change type is logged separately for complete audit trail
- **Note**: `parent_changed` and `sibling_order_changed` are mutually exclusive (only one per document)

### Change Detection Algorithm

1. If ancestry changed → `parent_changed` (takes priority)
2. Else if doc_no changed → `sibling_order_changed`
3. If fields changed → `changed` (independent check, can coexist with above)

### Documents Without UUIDs

- Logged as errors, skipped from change detection
- Still stored in `docNoToDoc` map for debugging

## Usage Examples

### Basic Usage

```typescript
import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/atlas-diff';

const result = await diffAtlasScopeTreeLists();

console.log(`Added: ${result.changes.added.length}`);
console.log(`Deleted: ${result.changes.deleted.length}`);
console.log(`Changed: ${result.changes.changed.length}`);
console.log(`Parent changed: ${result.changes.parent_changed.length}`);
console.log(`Sibling order changed: ${result.changes.sibling_order_changed.length}`);
```

### Processing Specific Change Types

```typescript
// Process moved documents
for (const change of result.changes.parent_changed) {
  console.log(`${change.uuid} moved from ${change.oldValues?.doc_no} to ${change.newValues?.doc_no}`);
  console.log(`  Old ancestry: ${change.oldAncestry?.join(' → ')}`);
  console.log(`  New ancestry: ${change.newAncestry?.join(' → ')}`);
}

// Process content changes
for (const change of result.changes.changed) {
  if (change.oldValues?.content !== change.newValues?.content) {
    console.log(`${change.uuid}: content changed`);
  }
}
```

### Handling Documents with Multiple Changes

```typescript
// Check if document "uuid-123" has both field changes AND was moved
const fieldChange = result.changes.changed.find((c) => c.uuid === 'uuid-123');
const parentChange = result.changes.parent_changed.find((c) => c.uuid === 'uuid-123');

if (fieldChange && parentChange) {
  console.log('Document was both edited and moved');
}
```

### Counting Total Changes

```typescript
const totalChanges =
  result.changes.added.length +
  result.changes.deleted.length +
  result.changes.changed.length +
  result.changes.parent_changed.length +
  result.changes.sibling_order_changed.length;

// Note: Documents with multiple change types are counted multiple times
// Example: field changes + parent change = 2 in the count
```

## Testing

28 test cases in `app/server/atlas/diff/__tests__/atlas-diff.test.ts`

**Key scenarios tested:**

- All 5 change types
- Multiple simultaneous changes (field + parent, field + sibling order)
- Mutual exclusivity (parent vs sibling order)
- Needed Research with global numbering
- Deeply nested documents (9+ levels)
- Documents without UUIDs
- Data inconsistencies

**Run tests:**

```bash
npm run test:run -- app/server/atlas/diff/__tests__/atlas-diff.test.ts
```

## Performance

- **Time**: O(n) - single pass per tree
- **Space**: O(n) - three lookup maps
- **Lookups**: O(1) - Map-based

## Related Documentation

- [Atlas Document Numbering Rules](./ATLAS_DOCUMENT_NUMBERING_RULES.md)
- Implementation: `app/server/atlas/diff/atlas-diff.ts`
- Types: `app/server/atlas/json-export/types.ts`
