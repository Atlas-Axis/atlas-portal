# Content Truncation Prevention Action Plan

## Problem Summary

During Markdown → Notion sync, some Atlas document content is truncated due to Notion API limits on rich text arrays.

## Notion API Limits on Rich Text

Notion enforces strict limits on `rich_text` arrays:

| Limit                  | Value | Current Workaround   | Data Loss?                 |
| ---------------------- | ----- | -------------------- | -------------------------- |
| Characters per element | 2,000 | Text splitting       | ✅ No                      |
| Elements per array     | 100   | Merging + truncation | ❌ **Yes** (when over 100) |

## Existing Workarounds (Already Implemented)

**Location**: `app/server/markdown/markdown-to-rich-text.ts`

### 1. Text Splitting (2000-char limit) ✅

**Function**: `splitLongRichTextElements()`

**How it works**:

- Detects rich text elements exceeding 2,000 characters
- Splits at word boundaries for cleaner results
- Preserves all formatting annotations across split segments
- Falls back to hard split at 2,000 chars if no word boundary found

**Result**: ✅ No data loss - all content preserved across multiple elements

### 2. Element Merging (Reduce element count) ✅

**Function**: `mergeAdjacentTextElements()`

**How it works**:

- Identifies adjacent text elements with identical annotations
- Merges them into single elements (if combined length ≤ 2,000)
- Only merges text elements (not mentions or equations)
- Only merges elements without links

**Result**: ✅ Reduces element count without data loss

### 3. Truncation with Marker (100-element limit) ⚠️

**Function**: `limitRichTextArrayLength()`

**How it works**:

1. First applies element merging (workaround #2)
2. If still over 100 elements, truncates to 99
3. Adds visible marker: `[...content truncated due to Notion limit...]`
4. Logs warning and adds to `ContentConversionWarning` array

**Result**: ❌ **Data loss** when content exceeds 100 elements after merging

## The Remaining Problem: 100-Element Limit

### Why 100 Elements Is Exceeded

Each formatted segment creates a separate rich text element:

- Plain text between formatting
- Bold/italic/code segments
- **Links and mentions** (one element per link)

Documents with many inline links (e.g., tables with hyperlinks in each cell) can easily exceed 100 elements even after merging.

## Options to Prevent Truncation

### Option 1: Split Content Across Multiple Notion Properties (Recommended)

**Approach**: When content exceeds 100 elements, split into multiple properties (e.g., Content, Content 2, Content 3).

**Pros**:

- Preserves all content
- No changes to Markdown format
- Single Notion page per document

**Cons**:

- Requires adding new database properties to Notion
- Requires UI changes to display combined content
- Max practical limit ~300 elements (3 properties)

**Effort**: Medium

### Option 2: Convert Links to Plain Text When Near Limit

**Approach**: When approaching 100 elements, convert remaining links to plain text format `[text](url)` instead of Notion mentions.

**Pros**:

- No schema changes needed
- Preserves all text content
- Easy implementation

**Cons**:

- Links become non-clickable plain text
- Inconsistent link behavior within same document

**Effort**: Low

### Option 3: Use Notion Page Content Blocks Instead

**Approach**: Store long content as page children (blocks) instead of database properties.

**Pros**:

- No element limit per block
- Supports much longer content
- Native Notion structure

**Cons**:

- Major architecture change
- Different sync logic for blocks vs properties
- May affect other features (diff, export)

**Effort**: High

### Option 4: Aggressive Element Merging

**Approach**: More aggressive merging strategy - convert all links to text with underline annotation, then merge.

**Pros**:

- Simple implementation
- Reduces element count significantly

**Cons**:

- Loses actual URL information
- Not a complete solution for extreme cases

**Effort**: Low

### Option 5: Fail Fast with Error (Current + Warning)

**Approach**: Keep current truncation but add explicit sync error/warning to audit log.

**Pros**:

- No changes to sync logic
- Makes truncation visible in logs
- Documents affected can be manually handled

**Cons**:

- Doesn't actually prevent data loss
- Requires manual intervention

**Effort**: Very Low

## Recommendation

**Phase 1** (Quick fix): Implement **Option 2** - Convert excess links to plain text. This prevents data loss with minimal effort.

**Phase 2** (Long-term): Consider **Option 1** - Multiple content properties. This preserves full formatting while keeping content in database properties.

## Affected Documents

Documents most likely to hit this limit:

- Large tables with many cell hyperlinks
- Documents with extensive cross-references
- Type Specifications with many component links

## Implementation Notes

For Option 2, modify `limitRichTextArrayLength()` in `markdown-to-rich-text.ts`:

```typescript
// Before truncating, convert remaining links to plain text
if (result.length > NOTION_RICH_TEXT_MAX_ELEMENTS) {
  result = convertExcessLinksToPlainText(result, NOTION_RICH_TEXT_MAX_ELEMENTS);
  // Re-merge after link conversion
  result = mergeAdjacentTextElements(result);
}
```

## Related Files

- `app/server/markdown/markdown-to-rich-text.ts` - Core conversion logic
- `app/atlas/sync/AGENTS.md` - Sync documentation (Rich Text Constraints section)
- `docs/MARKDOWN_TO_NOTION_SYNC.md` - High-level sync docs

## Status

- [ ] Decision on approach
- [ ] Implementation
- [ ] Testing with affected documents
- [ ] Documentation update
