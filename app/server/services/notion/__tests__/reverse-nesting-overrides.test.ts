import { describe, expect, it } from 'vitest';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { NotionNestingBugMapping } from '../../supabase/notion-nesting-bug-mappings';
import { reverseNestingOverrides } from '../reverse-nesting-overrides';

describe('reverseNestingOverrides', () => {
  it('should return unchanged pages when no mappings provided', () => {
    const pages: NotionDatabasePage[] = [
      {
        notion_page_id: 'page-1',
        parent_notion_page_id: 'parent-1',
        child_section_and_primary_doc_ids: ['child-1'],
      } as NotionDatabasePage,
    ];

    const result = reverseNestingOverrides(pages, []);

    expect(result).toEqual(pages);
  });

  it('should remove child from correct parent for Sections & Primary Docs', () => {
    const pages: NotionDatabasePage[] = [
      {
        notion_page_id: 'correct-parent',
        parent_notion_page_id: null,
        child_section_and_primary_doc_ids: ['child-1'],
      } as NotionDatabasePage,
      {
        notion_page_id: 'child-1',
        parent_notion_page_id: 'correct-parent',
        child_section_and_primary_doc_ids: [],
      } as NotionDatabasePage,
    ];

    const mappings: NotionNestingBugMapping[] = [
      {
        child_notion_page_id: 'child-1',
        parent_notion_page_id: 'correct-parent',
        atlas_database_name: 'Sections & Primary Docs',
        child_label: 'Child Document',
        parent_label: 'Correct Parent',
        place_after_sibling_notion_page_id: null,
        place_after_sibling_label: null,
      },
    ];

    const result = reverseNestingOverrides(pages, mappings);

    // Child should be removed from correct parent
    expect(result[0].child_section_and_primary_doc_ids).toEqual([]);
    // Child's parent should be set to null
    expect(result[1].parent_notion_page_id).toBeNull();
  });

  it('should remove child from correct parent for Agent Scope Database', () => {
    const pages: NotionDatabasePage[] = [
      {
        notion_page_id: 'correct-parent',
        parent_notion_page_id: null,
        child_agent_scope_ids: ['child-1'],
      } as NotionDatabasePage,
      {
        notion_page_id: 'child-1',
        parent_notion_page_id: 'correct-parent',
        child_agent_scope_ids: [],
      } as NotionDatabasePage,
    ];

    const mappings: NotionNestingBugMapping[] = [
      {
        child_notion_page_id: 'child-1',
        parent_notion_page_id: 'correct-parent',
        atlas_database_name: 'Agent Scope Database',
        child_label: 'Child Document',
        parent_label: 'Correct Parent',
        place_after_sibling_notion_page_id: null,
        place_after_sibling_label: null,
      },
    ];

    const result = reverseNestingOverrides(pages, mappings);

    // Child should be removed from correct parent
    expect(result[0].child_agent_scope_ids).toEqual([]);
    // Child's parent should be set to null
    expect(result[1].parent_notion_page_id).toBeNull();
  });

  it('should handle missing child page gracefully', () => {
    const pages: NotionDatabasePage[] = [
      {
        notion_page_id: 'correct-parent',
        parent_notion_page_id: null,
        child_section_and_primary_doc_ids: [],
      } as NotionDatabasePage,
    ];

    const mappings: NotionNestingBugMapping[] = [
      {
        child_notion_page_id: 'missing-child',
        parent_notion_page_id: 'correct-parent',
        atlas_database_name: 'Sections & Primary Docs',
        child_label: 'Missing Child',
        parent_label: 'Correct Parent',
        place_after_sibling_notion_page_id: null,
        place_after_sibling_label: null,
      },
    ];

    // Should not throw error
    const result = reverseNestingOverrides(pages, mappings);
    expect(result).toEqual(pages);
  });

  it('should handle missing parent page gracefully', () => {
    const pages: NotionDatabasePage[] = [
      {
        notion_page_id: 'child-1',
        parent_notion_page_id: 'some-parent',
        child_section_and_primary_doc_ids: [],
      } as NotionDatabasePage,
    ];

    const mappings: NotionNestingBugMapping[] = [
      {
        child_notion_page_id: 'child-1',
        parent_notion_page_id: 'missing-parent',
        atlas_database_name: 'Sections & Primary Docs',
        child_label: 'Child Document',
        parent_label: 'Missing Parent',
        place_after_sibling_notion_page_id: null,
        place_after_sibling_label: null,
      },
    ];

    // Should not throw error
    const result = reverseNestingOverrides(pages, mappings);
    expect(result).toEqual(pages);
  });

  it('should skip databases that do not support internal nesting', () => {
    const pages: NotionDatabasePage[] = [
      {
        notion_page_id: 'parent-1',
        parent_notion_page_id: null,
      } as NotionDatabasePage,
      {
        notion_page_id: 'child-1',
        parent_notion_page_id: 'parent-1',
      } as NotionDatabasePage,
    ];

    const mappings: NotionNestingBugMapping[] = [
      {
        child_notion_page_id: 'child-1',
        parent_notion_page_id: 'parent-1',
        atlas_database_name: 'Articles', // Does not support internal nesting
        child_label: 'Child',
        parent_label: 'Parent',
        place_after_sibling_notion_page_id: null,
        place_after_sibling_label: null,
      },
    ];

    // Should not modify pages
    const result = reverseNestingOverrides(pages, mappings);
    expect(result).toEqual(pages);
  });

  it('should process multiple mappings', () => {
    const pages: NotionDatabasePage[] = [
      {
        notion_page_id: 'parent-1',
        parent_notion_page_id: null,
        child_section_and_primary_doc_ids: ['child-1', 'child-2'],
      } as NotionDatabasePage,
      {
        notion_page_id: 'child-1',
        parent_notion_page_id: 'parent-1',
        child_section_and_primary_doc_ids: [],
      } as NotionDatabasePage,
      {
        notion_page_id: 'child-2',
        parent_notion_page_id: 'parent-1',
        child_section_and_primary_doc_ids: [],
      } as NotionDatabasePage,
    ];

    const mappings: NotionNestingBugMapping[] = [
      {
        child_notion_page_id: 'child-1',
        parent_notion_page_id: 'parent-1',
        atlas_database_name: 'Sections & Primary Docs',
        child_label: 'Child 1',
        parent_label: 'Parent',
        place_after_sibling_notion_page_id: null,
        place_after_sibling_label: null,
      },
      {
        child_notion_page_id: 'child-2',
        parent_notion_page_id: 'parent-1',
        atlas_database_name: 'Sections & Primary Docs',
        child_label: 'Child 2',
        parent_label: 'Parent',
        place_after_sibling_notion_page_id: null,
        place_after_sibling_label: null,
      },
    ];

    const result = reverseNestingOverrides(pages, mappings);

    // Both children should be removed from parent
    expect(result[0].child_section_and_primary_doc_ids).toEqual([]);
    // Both children should have null parent
    expect(result[1].parent_notion_page_id).toBeNull();
    expect(result[2].parent_notion_page_id).toBeNull();
  });
});
