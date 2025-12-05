// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { NotionNestingBugMapping, buildNestingBugAffectedUuidsSet } from '../notion-nesting-bug-mappings';

describe('notion-nesting-bug-mappings', () => {
  describe('buildNestingBugAffectedUuidsSet', () => {
    it('returns empty set when no mappings exist', () => {
      const mappings: NotionNestingBugMapping[] = [];
      const uuidMappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map(),
        atlasUUIDsToNotionPageIds: new Map(),
      };

      const result = buildNestingBugAffectedUuidsSet(mappings, uuidMappings);

      expect(result.size).toBe(0);
    });

    it('converts Notion page IDs to Atlas UUIDs', () => {
      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: 'notion-page-1',
          parent_notion_page_id: 'notion-parent-1',
          atlas_database_name: 'Sections & Primary Docs',
        },
        {
          child_notion_page_id: 'notion-page-2',
          parent_notion_page_id: 'notion-parent-2',
          atlas_database_name: 'Agent Scope Database',
        },
      ];

      const uuidMappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map([
          ['notion-page-1', 'atlas-uuid-1'],
          ['notion-page-2', 'atlas-uuid-2'],
        ]),
        atlasUUIDsToNotionPageIds: new Map([
          ['atlas-uuid-1', 'notion-page-1'],
          ['atlas-uuid-2', 'notion-page-2'],
        ]),
      };

      const result = buildNestingBugAffectedUuidsSet(mappings, uuidMappings);

      expect(result.size).toBe(2);
      expect(result.has('atlas-uuid-1')).toBe(true);
      expect(result.has('atlas-uuid-2')).toBe(true);
    });

    it('throws error when Notion page ID has no Atlas UUID mapping', () => {
      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: 'notion-page-without-mapping',
          parent_notion_page_id: 'notion-parent-1',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const uuidMappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map(),
        atlasUUIDsToNotionPageIds: new Map(),
      };

      expect(() => buildNestingBugAffectedUuidsSet(mappings, uuidMappings)).toThrow(
        'No Atlas UUID found for child Notion page ID: notion-page-without-mapping',
      );
    });

    it('allows O(1) lookup for affected UUIDs', () => {
      const mappings: NotionNestingBugMapping[] = [
        {
          child_notion_page_id: 'notion-page-1',
          parent_notion_page_id: 'notion-parent-1',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const uuidMappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map([['notion-page-1', 'atlas-uuid-1']]),
        atlasUUIDsToNotionPageIds: new Map([['atlas-uuid-1', 'notion-page-1']]),
      };

      const result = buildNestingBugAffectedUuidsSet(mappings, uuidMappings);

      // O(1) lookup
      expect(result.has('atlas-uuid-1')).toBe(true);
      expect(result.has('atlas-uuid-not-affected')).toBe(false);
    });
  });
});
