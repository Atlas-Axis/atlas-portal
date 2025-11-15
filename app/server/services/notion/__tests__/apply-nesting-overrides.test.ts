import { describe, expect, it } from 'vitest';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { NotionNestingBugMapping } from '../../supabase/notion-nesting-bug-mappings';
import { applyNestingOverrides } from '../apply-nesting-overrides';

// Helper to create a minimal NotionDatabasePage for testing
function createMockPage(id: string, childIds: string[] = []): NotionDatabasePage {
  return {
    notion_page_id: id,
    canonical_document_title: null,
    atlas_document_type: 'Core',
    atlas_document_number: '',
    atlas_database_name: 'Sections & Primary Docs',
    has_children: false,
    archived: false,
    in_trash: false,
    plain_text_content: '',
    json_content: [],
    plain_text_name: `Page ${id}`,
    json_name: [],
    parent_notion_page_id: null,
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: childIds,
    child_annotation_ids: [],
    child_tenet_ids: [],
    child_scenario_ids: [],
    child_scenario_variation_ids: [],
    child_active_data_ids: [],
    child_agent_scope_ids: [],
    child_needed_research_ids: [],
    extra_fields: {},
    sort_order: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_edited_by_user_id: null,
  };
}

describe('applyNestingOverrides', () => {
  describe('Sections & Primary Docs database', () => {
    it('should remove child ID from original parent and add to new parent', () => {
      const childId = 'child-1';
      const originalParentId = 'parent-1';
      const newParentId = 'parent-2';

      const pages: NotionDatabasePage[] = [
        createMockPage(childId, []),
        createMockPage(originalParentId, [childId]),
        createMockPage(newParentId, []),
      ];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: childId,
          parent_notion_page_id: newParentId,
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      // Original parent should not have the child
      const originalParent = result.find((p) => p.notion_page_id === originalParentId);
      expect(originalParent?.child_section_and_primary_doc_ids).not.toContain(childId);

      // New parent should have the child
      const newParent = result.find((p) => p.notion_page_id === newParentId);
      expect(newParent?.child_section_and_primary_doc_ids).toContain(childId);
    });

    it('should handle multiple mappings correctly', () => {
      const child1 = 'child-1';
      const child2 = 'child-2';
      const originalParent = 'parent-1';
      const newParent1 = 'parent-2';
      const newParent2 = 'parent-3';

      const pages: NotionDatabasePage[] = [
        createMockPage(child1, []),
        createMockPage(child2, []),
        createMockPage(originalParent, [child1, child2]),
        createMockPage(newParent1, []),
        createMockPage(newParent2, []),
      ];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: child1,
          parent_notion_page_id: newParent1,
          atlas_database_name: 'Sections & Primary Docs',
        },
        {
          child_notion_page_id: child2,
          parent_notion_page_id: newParent2,
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      // Original parent should have no children
      const original = result.find((p) => p.notion_page_id === originalParent);
      expect(original?.child_section_and_primary_doc_ids).toHaveLength(0);

      // New parents should have their respective children
      const parent1 = result.find((p) => p.notion_page_id === newParent1);
      expect(parent1?.child_section_and_primary_doc_ids).toContain(child1);
      expect(parent1?.child_section_and_primary_doc_ids).not.toContain(child2);

      const parent2 = result.find((p) => p.notion_page_id === newParent2);
      expect(parent2?.child_section_and_primary_doc_ids).toContain(child2);
      expect(parent2?.child_section_and_primary_doc_ids).not.toContain(child1);
    });

    it('should handle non-existent child IDs gracefully', () => {
      const parentId = 'parent-1';

      const pages: NotionDatabasePage[] = [createMockPage(parentId, [])];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: 'non-existent-child',
          parent_notion_page_id: parentId,
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      // Should not throw
      const result = applyNestingOverrides(pages, mappings);

      expect(result).toHaveLength(1);
      expect(result[0].child_section_and_primary_doc_ids).toHaveLength(0);
    });

    it('should handle non-existent parent IDs gracefully', () => {
      const childId = 'child-1';
      const originalParentId = 'parent-1';

      const pages: NotionDatabasePage[] = [createMockPage(childId, []), createMockPage(originalParentId, [childId])];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: childId,
          parent_notion_page_id: 'non-existent-parent',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      // Should not throw, child should remain with original parent
      const result = applyNestingOverrides(pages, mappings);

      const originalParent = result.find((p) => p.notion_page_id === originalParentId);
      expect(originalParent?.child_section_and_primary_doc_ids).toContain(childId);
    });

    it('should not add duplicate child IDs to parent', () => {
      const childId = 'child-1';
      const parentId = 'parent-1';

      const pages: NotionDatabasePage[] = [createMockPage(childId, []), createMockPage(parentId, [childId])];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: childId,
          parent_notion_page_id: parentId,
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      const parent = result.find((p) => p.notion_page_id === parentId);
      expect(parent?.child_section_and_primary_doc_ids).toHaveLength(1);
      expect(parent?.child_section_and_primary_doc_ids).toContain(childId);
    });
  });

  describe('Agent Scope Database', () => {
    it('should remove child ID from original parent and add to new parent in child_agent_scope_ids', () => {
      const childId = 'agent-child-1';
      const originalParentId = 'agent-parent-1';
      const newParentId = 'agent-parent-2';

      const pages: NotionDatabasePage[] = [
        { ...createMockPage(childId, []), atlas_database_name: 'Agent Scope Database', child_agent_scope_ids: [] },
        {
          ...createMockPage(originalParentId, []),
          atlas_database_name: 'Agent Scope Database',
          child_agent_scope_ids: [childId],
        },
        {
          ...createMockPage(newParentId, []),
          atlas_database_name: 'Agent Scope Database',
          child_agent_scope_ids: [],
        },
      ];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: childId,
          parent_notion_page_id: newParentId,
          atlas_database_name: 'Agent Scope Database',
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      // Original parent should not have the child
      const originalParent = result.find((p) => p.notion_page_id === originalParentId);
      expect(originalParent?.child_agent_scope_ids).not.toContain(childId);

      // New parent should have the child
      const newParent = result.find((p) => p.notion_page_id === newParentId);
      expect(newParent?.child_agent_scope_ids).toContain(childId);
    });
  });

  describe('Database filtering', () => {
    it('should only apply mappings for the specified database', () => {
      const childId = 'child-1';
      const parentId = 'parent-1';

      const pages: NotionDatabasePage[] = [createMockPage(childId, []), createMockPage(parentId, [childId])];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: childId,
          parent_notion_page_id: parentId,
          atlas_database_name: 'Agent Scope Database', // Different database
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      // Should not apply the mapping since it's for a different database
      const parent = result.find((p) => p.notion_page_id === parentId);
      expect(parent?.child_section_and_primary_doc_ids).toContain(childId);
    });

    it('should return pages unchanged for databases without internal nesting', () => {
      const pages: NotionDatabasePage[] = [{ ...createMockPage('article-1', []), atlas_database_name: 'Articles' }];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: 'article-1',
          parent_notion_page_id: 'article-2',
          atlas_database_name: 'Articles',
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      // Should return pages unchanged
      expect(result).toEqual(pages);
    });

    it('should return pages unchanged when no mappings exist', () => {
      const pages: NotionDatabasePage[] = [createMockPage('page-1', []), createMockPage('page-2', [])];

      const mappings: NotionNestingBugMapping[] = [];

      const result = applyNestingOverrides(pages, mappings);

      expect(result).toEqual(pages);
    });
  });

  describe('Edge cases', () => {
    it('should handle child without any current parent', () => {
      const childId = 'orphan-child';
      const newParentId = 'new-parent';

      const pages: NotionDatabasePage[] = [createMockPage(childId, []), createMockPage(newParentId, [])];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: childId,
          parent_notion_page_id: newParentId,
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      // New parent should have the child
      const newParent = result.find((p) => p.notion_page_id === newParentId);
      expect(newParent?.child_section_and_primary_doc_ids).toContain(childId);
    });

    it('should preserve other child IDs in parent arrays', () => {
      const childToMove = 'child-1';
      const childToKeep = 'child-2';
      const originalParentId = 'parent-1';
      const newParentId = 'parent-2';

      const pages: NotionDatabasePage[] = [
        createMockPage(childToMove, []),
        createMockPage(childToKeep, []),
        createMockPage(originalParentId, [childToMove, childToKeep]),
        createMockPage(newParentId, []),
      ];

      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: childToMove,
          parent_notion_page_id: newParentId,
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const result = applyNestingOverrides(pages, mappings);

      // Original parent should still have the child that wasn't moved
      const originalParent = result.find((p) => p.notion_page_id === originalParentId);
      expect(originalParent?.child_section_and_primary_doc_ids).toContain(childToKeep);
      expect(originalParent?.child_section_and_primary_doc_ids).not.toContain(childToMove);

      // New parent should have the moved child
      const newParent = result.find((p) => p.notion_page_id === newParentId);
      expect(newParent?.child_section_and_primary_doc_ids).toContain(childToMove);
      expect(newParent?.child_section_and_primary_doc_ids).not.toContain(childToKeep);
    });
  });
});
