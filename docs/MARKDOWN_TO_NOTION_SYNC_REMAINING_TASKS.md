# Markdown → Notion Sync - Remaining Tasks

**Status:** Implementation 90% Complete  
**Last Updated:** 2025-11-26  
**Related:** [MARKDOWN_TO_NOTION_SYNC.md](./MARKDOWN_TO_NOTION_SYNC.md)

## Summary

Core sync functionality is working with audit logging, UUID mapping, and all 5 change types. Key remaining work:

- ❌ **Reverse nesting overrides** - Function half-finished and not integrated
- ❌ **Documentation updates** - ATLAS_DATA_PIPELINE.md shows incorrect status
- ⚠️ **Integration testing** - Only unit tests exist

## ✅ Completed Features

- All 5 change types: added, changed, deleted, parent_changed, sibling_order_changed
- Audit logging with request/response tracking
- UUID mapping persistence for new pages
- 22+ unit tests (all passing)
- Error handling and progress tracking

---

## 🔴 Critical: Reverse Nesting Overrides INCOMPLETE

**Status:** Function half-finished and not integrated into workflow.

**Purpose:** Reverse the nesting bug fix mappings before syncing to Notion. Required because:

- Notion has a bug where sub-item relationships fail at deep nesting levels (10+)
- Forward sync (Notion → Supabase) applies manual fixes via `notion_nesting_bug_mapping` table
- Reverse sync (Markdown → Notion) must undo these fixes to match Notion's structure

**Current State:**

- ⚠️ Function started: `app/server/services/notion/reverse-nesting-overrides.ts`
- ⚠️ Unit tests partial: `app/server/services/notion/__tests__/reverse-nesting-overrides.test.ts`
- ❌ **Implementation incomplete**
- ❌ **Not integrated** into sync workflow

**Integration Options:**

- **Option A:** Apply during Supabase data loading (before Export Tree conversion)
- **Option B:** Apply during Export Tree building

---

## 📝 Documentation Updates Needed

### `docs/ATLAS_DATA_PIPELINE.md` ⚠️

**Issues:**

- Stage 10 (Reverse Overrides): Shows "[PLANNED]" but should be "[INCOMPLETE - NOT INTEGRATED]"
- Stage 11 (Build Properties): Shows "[PLANNED]" but is **IMPLEMENTED**
- Stage 12 (Sync to Notion): Shows "[PLANNED]" but is **IMPLEMENTED**
- File references show "(to be created)" for files that exist

**Changes Needed:**

```diff
- | **[PLANNED] 10. Reverse Overrides**
+ | **[INCOMPLETE - NOT INTEGRATED] 10. Reverse Overrides**

- | **[PLANNED] 11. Build Properties**
+ | **[IMPLEMENTED] 11. Build Properties**

- | **[PLANNED] 12. Sync to Notion**
+ | **[IMPLEMENTED] 12. Sync to Notion**
```

Update file references to:

- `app/atlas/sync/_lib/notion-property-builder.ts`
- `app/atlas/sync/_lib/sync-orchestrator.ts`
- `app/atlas/sync/_actions/sync-actions.ts`

---

## 🔧 Optional Improvements

### Unused Functions

Functions exist but not used. Decision: keep or remove?

- UUID Mapping: `storeUuidMappingsBatch()`, `getNotionPageIdForAtlasUuid()`, `getAtlasUuidForNotionPageId()`
- Audit Log: `logNotionApiOperationsBatch()`, `getAuditLogEntriesForBatch()`, `getAuditLogEntriesForPage()`

### Other Nice-to-Haves

- **Dry-run mode** - Preview changes without syncing
- **Type safety** - Better payload types for JSONB fields
- **Audit log UI** - Browse historical operations

---

## 🎯 Next Steps

### Priority 1: Critical

1. **Update ATLAS_DATA_PIPELINE.md**
   - Fix stages 10-12 status
   - Update file references

2. **Finish reverse nesting implementation**
   - Complete the function implementation
   - Integrate into sync workflow
   - Test with real data

### Priority 2: Optional

- Review unused functions (keep or remove?)
- Add integration tests
- Implement dry-run mode

---

## ✅ Status Checklist

**Completed:**

- [x] All 5 change types working
- [x] 22+ unit tests (all passing)
- [x] Audit logging with request/response tracking
- [x] UUID mapping persistence

**Remaining:**

- [ ] Update ATLAS_DATA_PIPELINE.md
- [ ] Query `notion_nesting_bug_mapping` in production
- [ ] Finish reverse nesting implementation (if needed)
- [ ] Add integration tests (optional)

---

## 📚 Related Documentation

- [MARKDOWN_TO_NOTION_SYNC.md](./MARKDOWN_TO_NOTION_SYNC.md) - High-level sync workflow documentation
- [ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md) - Complete pipeline overview
- [NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md) - Nesting bug context
- [UUID_MAPPING.md](./UUID_MAPPING.md) - UUID mapping system

---

**Status:** Core sync 100% complete, reverse nesting incomplete/not integrated
