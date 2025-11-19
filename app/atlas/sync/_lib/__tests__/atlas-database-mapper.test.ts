import { describe, expect, it } from 'vitest';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import {
  databaseSupportsInternalNesting,
  getDatabaseNameFromDocument,
  getInternalParentPageIdFromAncestry,
} from '../atlas-database-mapper';

describe('atlas-database-mapper', () => {
  describe('getDatabaseNameFromDocument', () => {
    const mockDatabaseMap = new Map<string, AtlasDatabaseName>();

    describe('direct mappings (no database tracking needed)', () => {
      it('maps Scope to Scopes', () => {
        expect(getDatabaseNameFromDocument('Scope', 'uuid-1', mockDatabaseMap)).toBe('Scopes');
      });

      it('maps Article to Articles', () => {
        expect(getDatabaseNameFromDocument('Article', 'uuid-1', mockDatabaseMap)).toBe('Articles');
      });

      it('maps Section to Sections & Primary Docs', () => {
        expect(getDatabaseNameFromDocument('Section', 'uuid-1', mockDatabaseMap)).toBe('Sections & Primary Docs');
      });

      it('maps Type Specification to Sections & Primary Docs', () => {
        expect(getDatabaseNameFromDocument('Type Specification', 'uuid-1', mockDatabaseMap)).toBe(
          'Sections & Primary Docs',
        );
      });

      it('maps Annotation to Annotations', () => {
        expect(getDatabaseNameFromDocument('Annotation', 'uuid-1', mockDatabaseMap)).toBe('Annotations');
      });

      it('maps Action Tenet to Tenets', () => {
        expect(getDatabaseNameFromDocument('Action Tenet', 'uuid-1', mockDatabaseMap)).toBe('Tenets');
      });

      it('maps Scenario to Scenarios', () => {
        expect(getDatabaseNameFromDocument('Scenario', 'uuid-1', mockDatabaseMap)).toBe('Scenarios');
      });

      it('maps Scenario Variation to Scenario Variations', () => {
        expect(getDatabaseNameFromDocument('Scenario Variation', 'uuid-1', mockDatabaseMap)).toBe(
          'Scenario Variations',
        );
      });

      it('maps Active Data to Active Data', () => {
        expect(getDatabaseNameFromDocument('Active Data', 'uuid-1', mockDatabaseMap)).toBe('Active Data');
      });

      it('maps Needed Research to Needed Research', () => {
        expect(getDatabaseNameFromDocument('Needed Research', 'uuid-1', mockDatabaseMap)).toBe('Needed Research');
      });
    });

    describe('Core type disambiguation via database tracking', () => {
      it('maps Core to Sections & Primary Docs when tracked in database map', () => {
        const databaseMap = new Map<string, AtlasDatabaseName>();
        databaseMap.set('core-uuid-1', 'Sections & Primary Docs');

        expect(getDatabaseNameFromDocument('Core', 'core-uuid-1', databaseMap)).toBe('Sections & Primary Docs');
      });

      it('maps Core to Agent Scope Database when tracked in database map', () => {
        const databaseMap = new Map<string, AtlasDatabaseName>();
        databaseMap.set('core-uuid-1', 'Agent Scope Database');

        expect(getDatabaseNameFromDocument('Core', 'core-uuid-1', databaseMap)).toBe('Agent Scope Database');
      });
    });

    describe('Active Data Controller type disambiguation via database tracking', () => {
      it('maps Active Data Controller to Sections & Primary Docs when tracked in database map', () => {
        const databaseMap = new Map<string, AtlasDatabaseName>();
        databaseMap.set('adc-uuid-1', 'Sections & Primary Docs');

        expect(getDatabaseNameFromDocument('Active Data Controller', 'adc-uuid-1', databaseMap)).toBe(
          'Sections & Primary Docs',
        );
      });

      it('maps Active Data Controller to Agent Scope Database when tracked in database map', () => {
        const databaseMap = new Map<string, AtlasDatabaseName>();
        databaseMap.set('adc-uuid-1', 'Agent Scope Database');

        expect(getDatabaseNameFromDocument('Active Data Controller', 'adc-uuid-1', databaseMap)).toBe(
          'Agent Scope Database',
        );
      });
    });

    describe('error handling', () => {
      it('throws error for unmapped document type', () => {
        const databaseMap = new Map<string, AtlasDatabaseName>();
        // @ts-expect-error Testing invalid type
        expect(() => getDatabaseNameFromDocument('InvalidType', 'uuid-1', databaseMap)).toThrow(
          'No database mapping found for document type: InvalidType',
        );
      });
    });
  });

  describe('databaseSupportsInternalNesting', () => {
    it('returns true for Sections & Primary Docs', () => {
      expect(databaseSupportsInternalNesting('Sections & Primary Docs')).toBe(true);
    });

    it('returns true for Agent Scope Database', () => {
      expect(databaseSupportsInternalNesting('Agent Scope Database')).toBe(true);
    });

    it('returns false for Scopes', () => {
      expect(databaseSupportsInternalNesting('Scopes')).toBe(false);
    });

    it('returns false for Articles', () => {
      expect(databaseSupportsInternalNesting('Articles')).toBe(false);
    });

    it('returns false for Annotations', () => {
      expect(databaseSupportsInternalNesting('Annotations')).toBe(false);
    });

    it('returns false for Tenets', () => {
      expect(databaseSupportsInternalNesting('Tenets')).toBe(false);
    });

    it('returns false for Scenarios', () => {
      expect(databaseSupportsInternalNesting('Scenarios')).toBe(false);
    });

    it('returns false for Scenario Variations', () => {
      expect(databaseSupportsInternalNesting('Scenario Variations')).toBe(false);
    });

    it('returns false for Active Data', () => {
      expect(databaseSupportsInternalNesting('Active Data')).toBe(false);
    });

    it('returns false for Needed Research', () => {
      expect(databaseSupportsInternalNesting('Needed Research')).toBe(false);
    });
  });

  describe('getInternalParentPageIdFromAncestry', () => {
    describe('returns null cases', () => {
      it('returns null when ancestry is undefined', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>();
        const result = getInternalParentPageIdFromAncestry(undefined, 'Sections & Primary Docs', uuidToDatabase);
        expect(result).toBeNull();
      });

      it('returns null when ancestry is empty array', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>();
        const result = getInternalParentPageIdFromAncestry([], 'Sections & Primary Docs', uuidToDatabase);
        expect(result).toBeNull();
      });

      it('returns null when parent is in different database (cross-database relationship)', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([['article-uuid', 'Articles']]);

        // Section whose parent is an Article (cross-database)
        const result = getInternalParentPageIdFromAncestry(['article-uuid'], 'Sections & Primary Docs', uuidToDatabase);
        expect(result).toBeNull();
      });
    });

    describe('same-database parent cases', () => {
      it('returns parent ID when Section parent of Core in Sections & Primary Docs', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([['section-uuid', 'Sections & Primary Docs']]);

        const result = getInternalParentPageIdFromAncestry(['section-uuid'], 'Sections & Primary Docs', uuidToDatabase);
        expect(result).toBe('section-uuid');
      });

      it('returns parent ID when Core parent of nested Core in Sections & Primary Docs', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([
          ['article-uuid', 'Articles'],
          ['section-uuid', 'Sections & Primary Docs'],
          ['core-parent-uuid', 'Sections & Primary Docs'],
        ]);

        // Core → Core → Core (nested within same database)
        // The immediate parent is 'core-parent-uuid', which is in 'Sections & Primary Docs'
        const result = getInternalParentPageIdFromAncestry(
          ['article-uuid', 'section-uuid', 'core-parent-uuid'],
          'Sections & Primary Docs',
          uuidToDatabase,
        );
        expect(result).toBe('core-parent-uuid');
      });

      it('returns parent ID when Core parent of Active Data Controller in Sections & Primary Docs', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([
          ['section-uuid', 'Sections & Primary Docs'],
          ['core-uuid', 'Sections & Primary Docs'],
        ]);

        const result = getInternalParentPageIdFromAncestry(
          ['section-uuid', 'core-uuid'],
          'Sections & Primary Docs',
          uuidToDatabase,
        );
        expect(result).toBe('core-uuid');
      });

      it('returns parent ID when Core parent of Core in Agent Scope Database', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([
          ['agent-section-uuid', 'Sections & Primary Docs'],
          ['agent-core-uuid', 'Agent Scope Database'],
        ]);

        // Core with agent ancestry - should be in Agent Scope Database
        const result = getInternalParentPageIdFromAncestry(
          ['agent-section-uuid', 'agent-core-uuid'],
          'Agent Scope Database',
          uuidToDatabase,
        );
        expect(result).toBe('agent-core-uuid');
      });

      it('returns parent ID when Active Data Controller parent of Core in Agent Scope Database', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([
          ['agent-section-uuid', 'Sections & Primary Docs'],
          ['adc-uuid', 'Agent Scope Database'],
        ]);

        const result = getInternalParentPageIdFromAncestry(
          ['agent-section-uuid', 'adc-uuid'],
          'Agent Scope Database',
          uuidToDatabase,
        );
        expect(result).toBe('adc-uuid');
      });
    });

    describe('filters cross-database parents correctly', () => {
      it('filters out Article parent when checking Section', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([['article-uuid', 'Articles']]);

        // Section under Article - Article is in different database
        const result = getInternalParentPageIdFromAncestry(['article-uuid'], 'Sections & Primary Docs', uuidToDatabase);
        expect(result).toBeNull();
      });

      it('filters out Section parent when checking Annotation', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([['section-uuid', 'Sections & Primary Docs']]);

        // Annotation under Section - Section is in different database
        const result = getInternalParentPageIdFromAncestry(['section-uuid'], 'Annotations', uuidToDatabase);
        expect(result).toBeNull();
      });

      it('filters out Core (Agent) parent when checking Core (non-Agent)', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([
          ['agent-section-uuid', 'Sections & Primary Docs'],
          ['agent-core-uuid', 'Agent Scope Database'],
        ]);

        // Trying to create non-agent Core under agent Core - different databases
        const result = getInternalParentPageIdFromAncestry(
          ['agent-section-uuid', 'agent-core-uuid'],
          'Sections & Primary Docs', // Child is non-agent
          uuidToDatabase,
        );
        expect(result).toBeNull();
      });
    });

    describe('handles deep ancestry chains', () => {
      it('correctly identifies same-database parent in deep chain', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([
          ['scope-uuid', 'Scopes'],
          ['article-uuid', 'Articles'],
          ['section-uuid', 'Sections & Primary Docs'],
          ['core-uuid', 'Sections & Primary Docs'],
        ]);

        // Deep chain: Scope → Article → Section → Core → Core (nested)
        // Only the last Core is the same-database parent
        const result = getInternalParentPageIdFromAncestry(
          ['scope-uuid', 'article-uuid', 'section-uuid', 'core-uuid'],
          'Sections & Primary Docs',
          uuidToDatabase,
        );
        expect(result).toBe('core-uuid');
      });

      it('ignores distant same-type ancestors and only checks immediate parent', () => {
        const uuidToDatabase = new Map<string, AtlasDatabaseName>([
          ['section-uuid-1', 'Sections & Primary Docs'],
          ['core-uuid-1', 'Sections & Primary Docs'],
        ]);

        // Ancestry includes Section, but immediate parent is Core
        // Should return Core as the same-database parent
        const result = getInternalParentPageIdFromAncestry(
          ['section-uuid-1', 'core-uuid-1'],
          'Sections & Primary Docs',
          uuidToDatabase,
        );
        expect(result).toBe('core-uuid-1');
      });
    });
  });
});
