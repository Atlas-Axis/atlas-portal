// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/atlas/constants';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { buildAtlasTree } from '../atlas-tree-builder';
import { findNodeByDocumentID, getNodeCount, preOrderTraversal } from '../atlas-tree-traversal';
import { UuidMappings } from '../load-uuid-mapping';

// Mock the nesting fix mappings loader
vi.mock('@/app/server/services/supabase/notion-nesting-bug-mappings', () => ({
  loadNotionNestingFixMappings: vi.fn().mockResolvedValue([]),
}));

/**
 * See Atlas document number generation rules in `docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`
 */

/**
 * Test helper to create a base NotionDatabasePage with default values
 */
function makeBasePage(
  documentType: AtlasDocumentType,
  overrides: Partial<NotionDatabasePage> = {},
): NotionDatabasePage {
  return {
    notion_page_id: 'test-id',
    canonical_document_title: null,
    atlas_document_type: documentType,
    atlas_document_number: '',
    atlas_document_number_sortable: '',
    atlas_database_name: 'Sections & Primary Docs',
    has_children: false,
    archived: false,
    in_trash: false,
    json_name: {},
    json_content: {},
    parent_notion_page_id: null,
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: [],
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
    ...overrides,
  };
}

/**
 * Helper function to create mock UUID mappings for tests
 */
function createMockUuidMappings(): UuidMappings {
  return {
    notionPageIDsToAtlasUUIDs: new Map(),
    atlasUUIDsToNotionPageIds: new Map(),
  };
}

describe('Atlas Tree Builder', () => {
  let pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>;

  beforeEach(() => {
    pagesByDatabase = {};
  });

  describe('buildAtlasTree', () => {
    it('should build a simple scope tree', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      expect(result.scopeTrees).toHaveLength(1);
      expect(result.scopeTrees[0].notion_page_id).toBe('scope-1');
      expect(result.scopeTrees[0].plain_text_name).toBe('Test Scope');
      expect(result.orphanedNodes).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should build a scope with articles', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1', 'article-2'],
      });

      const article1 = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
      });

      const article2 = makeBasePage('Article', {
        notion_page_id: 'article-2',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article1, article2],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      expect(result.scopeTrees).toHaveLength(1);
      expect(result.scopeTrees[0].articles).toHaveLength(2);
      expect(result.scopeTrees[0].articles[0].notion_page_id).toBe('article-1');
      expect(result.scopeTrees[0].articles[1].notion_page_id).toBe('article-2');
    });

    it('should handle multiple root scopes', async () => {
      const scope1 = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Scope 1',
      });

      const scope2 = makeBasePage('Scope', {
        notion_page_id: 'scope-2',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Scope 2',
      });

      pagesByDatabase = {
        Scopes: [scope1, scope2],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      expect(result.scopeTrees).toHaveLength(2);
      expect(result.scopeTrees[0].notion_page_id).toBe('scope-1');
      expect(result.scopeTrees[1].notion_page_id).toBe('scope-2');
    });

    it('should detect orphaned nodes', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
      });

      const orphanedArticle = makeBasePage('Article', {
        notion_page_id: 'orphaned-article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Orphaned Article',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [orphanedArticle],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      expect(result.scopeTrees).toHaveLength(1);
      expect(result.orphanedNodes).toHaveLength(1);
      expect(result.orphanedNodes[0].notion_page_id).toBe('orphaned-article');
    });

    it('should throw error for circular references', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_scope_ids: ['scope-1'], // Circular reference!
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      await expect(buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() })).rejects.toThrow(
        'Circular reference detected',
      );
    });

    it('should handle missing child documents gracefully', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['missing-article'],
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      // Should not throw, but should log error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await buildAtlasTree(pagesByDatabase, {
        uuidMappings: createMockUuidMappings(),
        reportMissingChildNodes: true,
      });

      expect(result.scopeTrees).toHaveLength(1);
      expect(result.scopeTrees[0].articles).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('Missing child document referenced in articles:', 'missing-article');

      consoleSpy.mockRestore();
    });

    it('should assign document numbers when requested', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      expect(result.scopeTrees[0].generatedDocID).toBe('A.0');
      expect(result.scopeTrees[0].articles[0].generatedDocID).toBe('A.0.1');
    });
  });

  describe('Tree Structure Validation', () => {
    it('should create proper tree structure with all child types', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
        child_annotation_ids: ['annotation-1'],
        child_tenet_ids: ['tenet-1'],
        child_scenario_ids: ['scenario-1'],
        child_scenario_variation_ids: ['variation-1'],
        child_active_data_ids: ['active-data-1'],
        child_agent_scope_ids: ['agent-1'],
        child_needed_research_ids: ['research-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
      });

      const annotation = makeBasePage('Annotation', {
        notion_page_id: 'annotation-1',
        atlas_database_name: 'Annotations',
        plain_text_name: 'Annotation 1',
      });

      const tenet = makeBasePage('Action Tenet', {
        notion_page_id: 'tenet-1',
        atlas_database_name: 'Tenets',
        plain_text_name: 'Tenet 1',
      });

      const scenario = makeBasePage('Scenario', {
        notion_page_id: 'scenario-1',
        atlas_database_name: 'Scenarios',
        plain_text_name: 'Scenario 1',
      });

      const variation = makeBasePage('Scenario Variation', {
        notion_page_id: 'variation-1',
        atlas_database_name: 'Scenario Variations',
        plain_text_name: 'Variation 1',
      });

      const activeData = makeBasePage('Active Data', {
        notion_page_id: 'active-data-1',
        atlas_database_name: 'Active Data',
        plain_text_name: 'Active Data 1',
      });

      const agent = makeBasePage('Core', {
        notion_page_id: 'agent-1',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent 1',
      });

      const research = makeBasePage('Needed Research', {
        notion_page_id: 'research-1',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 1',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [],
        Annotations: [annotation],
        Tenets: [tenet],
        Scenarios: [scenario],
        'Scenario Variations': [variation],
        'Active Data': [activeData],
        'Agent Scope Database': [agent],
        'Needed Research': [research],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      expect(result.scopeTrees[0].articles).toHaveLength(1);
      expect(result.scopeTrees[0].annotations).toHaveLength(1);
      expect(result.scopeTrees[0].tenets).toHaveLength(1);
      expect(result.scopeTrees[0].scenarios).toHaveLength(1);
      expect(result.scopeTrees[0].scenarioVariations).toHaveLength(1);
      expect(result.scopeTrees[0].activeData).toHaveLength(1);
      expect(result.scopeTrees[0].agentScopeDocs).toHaveLength(1);
      expect(result.scopeTrees[0].neededResearch).toHaveLength(1);
    });
  });
});

describe('filterDirectChildren', () => {
  // We need to test the internal filterDirectChildren function
  // Since it's not exported, we'll test it indirectly through buildAtlasTree behavior

  describe('Core document internal hierarchy filtering', () => {
    it('should filter out nested Core documents from Section parent', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        // Contains both direct Core children and nested Core descendants
        child_section_and_primary_doc_ids: ['core-1', 'core-2', 'nested-core-1', 'nested-core-2'],
      });

      // Direct Core children of Section
      const core1 = makeBasePage('Core', {
        notion_page_id: 'core-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 1',
        parent_notion_page_id: 'section-1', // Direct child of section
      });

      const core2 = makeBasePage('Core', {
        notion_page_id: 'core-2',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 2',
        parent_notion_page_id: 'section-1', // Direct child of section
      });

      // Nested Core documents (should be filtered out from section's children)
      const nestedCore1 = makeBasePage('Core', {
        notion_page_id: 'nested-core-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Nested Core 1',
        parent_notion_page_id: 'core-1', // Nested under core-1
      });

      const nestedCore2 = makeBasePage('Core', {
        notion_page_id: 'nested-core-2',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Nested Core 2',
        parent_notion_page_id: 'core-2', // Nested under core-2
      });

      const pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section, core1, core2, nestedCore1, nestedCore2],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Section should only have 2 direct Core children, not 4
      expect(result.scopeTrees[0].articles[0].sectionsAndPrimaryDocs[0].sectionsAndPrimaryDocs).toHaveLength(2);

      const sectionNode = result.scopeTrees[0].articles[0].sectionsAndPrimaryDocs[0];
      const coreChildren = sectionNode.sectionsAndPrimaryDocs;

      // Should only contain direct children (core-1 and core-2)
      expect(coreChildren.map((c) => c.notion_page_id).sort()).toEqual(['core-1', 'core-2']);

      // Nested cores should not appear as direct children of section
      expect(coreChildren.some((c) => c.notion_page_id === 'nested-core-1')).toBe(false);
      expect(coreChildren.some((c) => c.notion_page_id === 'nested-core-2')).toBe(false);
    });

    it('should correctly handle Core document filtering its own children', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['parent-core'],
      });

      // Parent Core document that has its own nested Core children
      const parentCore = makeBasePage('Core', {
        notion_page_id: 'parent-core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Parent Core',
        parent_notion_page_id: null, // Direct child of article (via child array)
        // Contains both direct children and nested descendants
        child_section_and_primary_doc_ids: ['child-core-1', 'child-core-2', 'grandchild-core'],
      });

      // Direct children of Parent Core
      const childCore1 = makeBasePage('Core', {
        notion_page_id: 'child-core-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Child Core 1',
        parent_notion_page_id: 'parent-core', // Direct child of parent-core
        child_section_and_primary_doc_ids: ['grandchild-core'], // Has its own child
      });

      const childCore2 = makeBasePage('Core', {
        notion_page_id: 'child-core-2',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Child Core 2',
        parent_notion_page_id: 'parent-core', // Direct child of parent-core
        child_section_and_primary_doc_ids: [], // No children
      });

      // Grandchild (nested under child-core-1, should be filtered out from parent-core's direct children)
      const grandchildCore = makeBasePage('Core', {
        notion_page_id: 'grandchild-core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Grandchild Core',
        parent_notion_page_id: 'child-core-1', // Nested under child-core-1
        child_section_and_primary_doc_ids: [], // No children
      });

      const pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [parentCore, childCore1, childCore2, grandchildCore],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Parent Core should only have 2 direct children (not 3)
      const parentCoreNode = result.scopeTrees[0].articles[0].sectionsAndPrimaryDocs[0];
      expect(parentCoreNode.sectionsAndPrimaryDocs).toHaveLength(2);

      const directChildren = parentCoreNode.sectionsAndPrimaryDocs;

      // Should contain only direct children (child-core-1 and child-core-2)
      expect(directChildren.map((c) => c.notion_page_id).sort()).toEqual(['child-core-1', 'child-core-2']);

      // Grandchild should not appear as direct child of parent-core
      expect(directChildren.some((c) => c.notion_page_id === 'grandchild-core')).toBe(false);

      // But grandchild should appear under child-core-1
      const childCore1Node = directChildren.find((c) => c.notion_page_id === 'child-core-1');
      expect(childCore1Node?.sectionsAndPrimaryDocs).toHaveLength(1);
      expect(childCore1Node?.sectionsAndPrimaryDocs[0].notion_page_id).toBe('grandchild-core');
    });

    it('should handle 4-level deep Core document nesting correctly', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['level1-core'],
      });

      // Level 1: Root Core (direct child of Article -> cross-db => parent must be null)
      const level1Core = makeBasePage('Core', {
        notion_page_id: 'level1-core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Level 1 Core',
        parent_notion_page_id: null,
        // Contains all descendants in flattened array (simulating real Notion behavior)
        child_section_and_primary_doc_ids: ['level2-core', 'level3-core', 'level4-core'],
      });

      // Level 2: Child of Level 1
      const level2Core = makeBasePage('Core', {
        notion_page_id: 'level2-core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Level 2 Core',
        parent_notion_page_id: 'level1-core',
        // Contains descendants
        child_section_and_primary_doc_ids: ['level3-core', 'level4-core'],
      });

      // Level 3: Child of Level 2
      const level3Core = makeBasePage('Core', {
        notion_page_id: 'level3-core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Level 3 Core',
        parent_notion_page_id: 'level2-core',
        child_section_and_primary_doc_ids: ['level4-core'],
      });

      // Level 4: Child of Level 3
      const level4Core = makeBasePage('Core', {
        notion_page_id: 'level4-core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Level 4 Core',
        parent_notion_page_id: 'level3-core',
        child_section_and_primary_doc_ids: [],
      });

      const pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [level1Core, level2Core, level3Core, level4Core],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Navigate through the tree to verify correct filtering at each level
      const level1Node = result.scopeTrees[0].articles[0].sectionsAndPrimaryDocs[0];
      expect(level1Node.notion_page_id).toBe('level1-core');
      expect(level1Node.sectionsAndPrimaryDocs).toHaveLength(1); // Only direct child (level2)
      expect(level1Node.sectionsAndPrimaryDocs[0].notion_page_id).toBe('level2-core');

      const level2Node = level1Node.sectionsAndPrimaryDocs[0];
      expect(level2Node.sectionsAndPrimaryDocs).toHaveLength(1); // Only direct child (level3)
      expect(level2Node.sectionsAndPrimaryDocs[0].notion_page_id).toBe('level3-core');

      const level3Node = level2Node.sectionsAndPrimaryDocs[0];
      expect(level3Node.sectionsAndPrimaryDocs).toHaveLength(1); // Only direct child (level4)
      expect(level3Node.sectionsAndPrimaryDocs[0].notion_page_id).toBe('level4-core');

      const level4Node = level3Node.sectionsAndPrimaryDocs[0];
      expect(level4Node.sectionsAndPrimaryDocs).toHaveLength(0); // No children
    });

    it('should handle complex mixed hierarchy with Agent Scope Database filtering', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_agent_scope_ids: ['agent-root'],
      });

      // Agent Scope root document
      const agentRoot = makeBasePage('Core', {
        notion_page_id: 'agent-root',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Root',
        parent_notion_page_id: null,
        // Flattened array with all descendants
        child_agent_scope_ids: ['agent-child-1', 'agent-child-2', 'agent-grandchild'],
      });

      // Direct children
      const agentChild1 = makeBasePage('Core', {
        notion_page_id: 'agent-child-1',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Child 1',
        parent_notion_page_id: 'agent-root',
        child_agent_scope_ids: ['agent-grandchild'],
      });

      const agentChild2 = makeBasePage('Active Data Controller', {
        notion_page_id: 'agent-child-2',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Child 2',
        parent_notion_page_id: 'agent-root',
        child_agent_scope_ids: [],
      });

      // Grandchild (should be filtered from root's direct children)
      const agentGrandchild = makeBasePage('Core', {
        notion_page_id: 'agent-grandchild',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Grandchild',
        parent_notion_page_id: 'agent-child-1',
        child_agent_scope_ids: [],
      });

      const pagesByDatabase = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [agentRoot, agentChild1, agentChild2, agentGrandchild],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Agent root should only have 2 direct children
      const agentRootNode = result.scopeTrees[0].agentScopeDocs[0];
      expect(agentRootNode.agentScopeDocs).toHaveLength(2);

      const directChildren = agentRootNode.agentScopeDocs;
      expect(directChildren.map((c) => c.notion_page_id).sort()).toEqual(['agent-child-1', 'agent-child-2']);

      // Grandchild should not be direct child of root
      expect(directChildren.some((c) => c.notion_page_id === 'agent-grandchild')).toBe(false);

      // But grandchild should be under agent-child-1
      const child1Node = directChildren.find((c) => c.notion_page_id === 'agent-child-1');
      expect(child1Node?.agentScopeDocs).toHaveLength(1);
      expect(child1Node?.agentScopeDocs[0].notion_page_id).toBe('agent-grandchild');
    });

    it('should handle circular reference protection in deep nesting', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['core-a'],
      });

      // Create a potential circular reference scenario in ancestry checking
      const coreA = makeBasePage('Core', {
        notion_page_id: 'core-a',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core A',
        parent_notion_page_id: null,
        child_section_and_primary_doc_ids: ['core-b', 'core-c'],
      });

      const coreB = makeBasePage('Core', {
        notion_page_id: 'core-b',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core B',
        parent_notion_page_id: 'core-a',
        child_section_and_primary_doc_ids: ['core-c'],
      });

      // This could create a circular ancestry if not handled properly
      const coreC = makeBasePage('Core', {
        notion_page_id: 'core-c',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core C',
        parent_notion_page_id: 'core-b', // Child of B, but also in A's child array
        child_section_and_primary_doc_ids: [],
      });

      const pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [coreA, coreB, coreC],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      // Should not throw error due to circular reference protection
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Verify tree structure is correct despite complex ancestry
      const coreANode = result.scopeTrees[0].articles[0].sectionsAndPrimaryDocs[0];
      expect(coreANode.sectionsAndPrimaryDocs).toHaveLength(1); // Only core-b is direct child
      expect(coreANode.sectionsAndPrimaryDocs[0].notion_page_id).toBe('core-b');

      const coreBNode = coreANode.sectionsAndPrimaryDocs[0];
      expect(coreBNode.sectionsAndPrimaryDocs).toHaveLength(1); // Only core-c is direct child
      expect(coreBNode.sectionsAndPrimaryDocs[0].notion_page_id).toBe('core-c');

      consoleSpy.mockRestore();
    });

    it('should handle extremely deep nesting (8 levels) with complex hierarchy', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        // Flattened array with all 8 levels of Core descendants
        child_section_and_primary_doc_ids: [
          'core-l1',
          'core-l2',
          'core-l3',
          'core-l4',
          'core-l5',
          'core-l6',
          'core-l7',
          'core-l8',
        ],
      });

      // Create 8 levels of Core documents, each nested under the previous
      const coreDocuments = [];
      for (let i = 1; i <= 8; i++) {
        const parentId = i === 1 ? 'section-1' : `core-l${i - 1}`;
        const children =
          i < 8
            ? [
                `core-l${i + 1}`,
                `core-l${i + 2}`,
                `core-l${i + 3}`,
                `core-l${i + 4}`,
                `core-l${i + 5}`,
                `core-l${i + 6}`,
                `core-l${i + 7}`,
                `core-l${i + 8}`,
              ].filter((id) => id.match(/core-l[1-8]$/) && parseInt(id.split('l')[1]) > i)
            : [];

        coreDocuments.push(
          makeBasePage('Core', {
            notion_page_id: `core-l${i}`,
            atlas_database_name: 'Sections & Primary Docs',
            plain_text_name: `Core Level ${i}`,
            parent_notion_page_id: parentId,
            child_section_and_primary_doc_ids: children,
          }),
        );
      }

      const pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section, ...coreDocuments],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Verify the section only has one direct child (core-l1)
      const sectionNode = result.scopeTrees[0].articles[0].sectionsAndPrimaryDocs[0];
      expect(sectionNode.sectionsAndPrimaryDocs).toHaveLength(1);
      expect(sectionNode.sectionsAndPrimaryDocs[0].notion_page_id).toBe('core-l1');

      // Walk down the 8-level hierarchy to ensure proper nesting
      let currentNode = sectionNode.sectionsAndPrimaryDocs[0];
      for (let i = 1; i < 8; i++) {
        expect(currentNode.notion_page_id).toBe(`core-l${i}`);
        expect(currentNode.sectionsAndPrimaryDocs).toHaveLength(1);
        currentNode = currentNode.sectionsAndPrimaryDocs[0];
      }

      // Final level should have no children
      expect(currentNode.notion_page_id).toBe('core-l8');
      expect(currentNode.sectionsAndPrimaryDocs).toHaveLength(0);
    });

    it('should handle mixed document types with Core nesting in Sections & Primary Docs', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        // Mix of document types with nested Core documents
        child_section_and_primary_doc_ids: ['core-1', 'adc-1', 'type-spec-1', 'nested-core-1', 'nested-core-2'],
      });

      // Direct children (different types)
      const core1 = makeBasePage('Core', {
        notion_page_id: 'core-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 1',
        parent_notion_page_id: 'section-1', // Direct child
        child_section_and_primary_doc_ids: ['nested-core-1', 'nested-core-2'],
      });

      const adc1 = makeBasePage('Active Data Controller', {
        notion_page_id: 'adc-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'ADC 1',
        parent_notion_page_id: 'section-1', // Direct child
        child_section_and_primary_doc_ids: [],
      });

      const typeSpec1 = makeBasePage('Type Specification', {
        notion_page_id: 'type-spec-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Type Spec 1',
        parent_notion_page_id: 'section-1', // Direct child
        child_section_and_primary_doc_ids: [],
      });

      // Nested Core documents (should be filtered from section's direct children)
      const nestedCore1 = makeBasePage('Core', {
        notion_page_id: 'nested-core-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Nested Core 1',
        parent_notion_page_id: 'core-1', // Nested under core-1
        child_section_and_primary_doc_ids: [],
      });

      const nestedCore2 = makeBasePage('Core', {
        notion_page_id: 'nested-core-2',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Nested Core 2',
        parent_notion_page_id: 'core-1', // Nested under core-1
        child_section_and_primary_doc_ids: [],
      });

      const pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section, core1, adc1, typeSpec1, nestedCore1, nestedCore2],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Section should only have 3 direct children of mixed types
      const sectionNode = result.scopeTrees[0].articles[0].sectionsAndPrimaryDocs[0];
      expect(sectionNode.sectionsAndPrimaryDocs).toHaveLength(3);

      const directChildren = sectionNode.sectionsAndPrimaryDocs;
      const childIds = directChildren.map((c) => c.notion_page_id).sort();
      expect(childIds).toEqual(['adc-1', 'core-1', 'type-spec-1']);

      // Verify nested cores are under core-1
      const core1Node = directChildren.find((c) => c.notion_page_id === 'core-1');
      expect(core1Node?.sectionsAndPrimaryDocs).toHaveLength(2);
      expect(core1Node?.sectionsAndPrimaryDocs.map((c) => c.notion_page_id).sort()).toEqual([
        'nested-core-1',
        'nested-core-2',
      ]);
    });
  });
});

describe('Tree Traversal', () => {
  let scopeTree: Awaited<ReturnType<typeof buildAtlasTree>>['scopeTrees'][0];

  beforeEach(async () => {
    const scope = makeBasePage('Scope', {
      notion_page_id: 'scope-1',
      atlas_database_name: 'Scopes',
      plain_text_name: 'Test Scope',
      child_article_ids: ['article-1'],
    });

    const article = makeBasePage('Article', {
      notion_page_id: 'article-1',
      atlas_database_name: 'Articles',
      plain_text_name: 'Article 1',
      child_section_and_primary_doc_ids: ['section-1'],
    });

    const section = makeBasePage('Section', {
      notion_page_id: 'section-1',
      atlas_database_name: 'Sections & Primary Docs',
      plain_text_name: 'Section 1',
    });

    const pagesByDatabase = {
      Scopes: [scope],
      Articles: [article],
      'Sections & Primary Docs': [section],
      Annotations: [],
      Tenets: [],
      Scenarios: [],
      'Scenario Variations': [],
      'Active Data': [],
      'Agent Scope Database': [],
      'Needed Research': [],
    };

    const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });
    scopeTree = result.scopeTrees[0];
  });

  it('should traverse tree in pre-order', async () => {
    const visited: string[] = [];

    preOrderTraversal(scopeTree, (node) => {
      visited.push(node.notion_page_id);
      return true;
    });

    expect(visited).toEqual(['scope-1', 'article-1', 'section-1']);
  });

  it('should find node by document ID', async () => {
    // Create a fresh test with proper NotionDatabasePage objects
    const scope = makeBasePage('Scope', {
      notion_page_id: 'scope-1',
      atlas_database_name: 'Scopes',
      plain_text_name: 'Test Scope',
      child_article_ids: ['article-1'],
    });

    const article = makeBasePage('Article', {
      notion_page_id: 'article-1',
      atlas_database_name: 'Articles',
      plain_text_name: 'Article 1',
    });

    const result = await buildAtlasTree(
      {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      },
      { uuidMappings: createMockUuidMappings() },
    );

    const foundNode = findNodeByDocumentID(result.scopeTrees[0], 'A.0.1');
    expect(foundNode).toBeDefined();
    expect(foundNode?.notion_page_id).toBe('article-1');
  });

  it('should count nodes correctly', async () => {
    const count = getNodeCount(scopeTree);
    expect(count).toBe(3); // scope + article + section
  });
});

describe('Document Numbering', () => {
  it('should assign document numbers correctly', async () => {
    const scope = makeBasePage('Scope', {
      notion_page_id: 'scope-1',
      atlas_database_name: 'Scopes',
      plain_text_name: 'Test Scope',
      child_article_ids: ['article-1'],
    });

    const article = makeBasePage('Article', {
      notion_page_id: 'article-1',
      atlas_database_name: 'Articles',
      plain_text_name: 'Article 1',
    });

    const pagesByDatabase = {
      Scopes: [scope],
      Articles: [article],
      'Sections & Primary Docs': [],
      Annotations: [],
      Tenets: [],
      Scenarios: [],
      'Scenario Variations': [],
      'Active Data': [],
      'Agent Scope Database': [],
      'Needed Research': [],
    };

    const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

    expect(result.scopeTrees[0].generatedDocID).toBe('A.0');
    expect(result.scopeTrees[0].articles[0].generatedDocID).toBe('A.0.1');
  });

  it('should handle multiple scopes with correct numbering', async () => {
    const scope1 = makeBasePage('Scope', {
      notion_page_id: 'scope-1',
      atlas_database_name: 'Scopes',
      plain_text_name: 'Scope 1',
    });

    const scope2 = makeBasePage('Scope', {
      notion_page_id: 'scope-2',
      atlas_database_name: 'Scopes',
      plain_text_name: 'Scope 2',
    });

    const pagesByDatabase = {
      Scopes: [scope1, scope2],
      Articles: [],
      'Sections & Primary Docs': [],
      Annotations: [],
      Tenets: [],
      Scenarios: [],
      'Scenario Variations': [],
      'Active Data': [],
      'Agent Scope Database': [],
      'Needed Research': [],
    };

    const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

    expect(result.scopeTrees[0].generatedDocID).toBe('A.0');
    expect(result.scopeTrees[1].generatedDocID).toBe('A.1');
  });

  describe('duplicated nodes tracking', () => {
    it('should track nodes that appear in multiple parent contexts', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        atlas_document_number: 'A.1',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        atlas_document_number: 'A.1.1',
        plain_text_name: 'Test Article',
        child_section_and_primary_doc_ids: ['section-1', 'section-2'],
      });

      const section1 = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        atlas_document_number: 'A.1.1.1',
        plain_text_name: 'Section 1',
        child_needed_research_ids: ['research-1'], // research-1 appears here
      });

      const section2 = makeBasePage('Section', {
        notion_page_id: 'section-2',
        atlas_database_name: 'Sections & Primary Docs',
        atlas_document_number: 'A.1.1.2',
        plain_text_name: 'Section 2',
        child_needed_research_ids: ['research-1'], // research-1 appears here too (duplication!)
      });

      // This research document appears under both section-1 and section-2
      const research1 = makeBasePage('Needed Research', {
        notion_page_id: 'research-1',
        atlas_database_name: 'Needed Research',
        atlas_document_number: 'NR-1',
        plain_text_name: 'Shared Research Item',
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section1, section2],
        'Needed Research': [research1],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings(), verbose: false });

      // Should detect the duplication - tracks ALL parent relationships (2 parents = 2 entries)
      expect(result.duplicatedNodes).toHaveLength(2);
      expect(result.duplicatedNodes[0].node.notion_page_id).toBe('research-1');
      expect(result.duplicatedNodes[0].node.plain_text_name).toBe('Shared Research Item');
      expect(result.duplicatedNodes[1].node.notion_page_id).toBe('research-1');
      expect(result.duplicatedNodes[1].node.plain_text_name).toBe('Shared Research Item');
      // Verify both parent relationships are tracked
      const parentIds = result.duplicatedNodes.map((d) => d.parentId).sort();
      expect(parentIds).toEqual(['section-1', 'section-2']);

      // The research item should appear in both sections in the tree structure
      const scope1 = result.scopeTrees[0];
      const article1 = scope1.articles[0];
      const section1Node = article1.sectionsAndPrimaryDocs.find((s) => s.notion_page_id === 'section-1');
      const section2Node = article1.sectionsAndPrimaryDocs.find((s) => s.notion_page_id === 'section-2');

      expect(section1Node?.neededResearch).toHaveLength(1);
      expect(section1Node?.neededResearch[0].notion_page_id).toBe('research-1');
      expect(section2Node?.neededResearch).toHaveLength(1);
      expect(section2Node?.neededResearch[0].notion_page_id).toBe('research-1');
    });

    it('should track multiple duplications of the same node', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        atlas_document_number: 'A.1',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        atlas_document_number: 'A.1.1',
        child_section_and_primary_doc_ids: ['section-1', 'section-2', 'section-3'],
      });

      const section1 = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        child_needed_research_ids: ['research-1'],
      });

      const section2 = makeBasePage('Section', {
        notion_page_id: 'section-2',
        atlas_database_name: 'Sections & Primary Docs',
        child_needed_research_ids: ['research-1'], // First duplication
      });

      const section3 = makeBasePage('Section', {
        notion_page_id: 'section-3',
        atlas_database_name: 'Sections & Primary Docs',
        child_needed_research_ids: ['research-1'], // Second duplication
      });

      const research1 = makeBasePage('Needed Research', {
        notion_page_id: 'research-1',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Triple Shared Research',
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section1, section2, section3],
        'Needed Research': [research1],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
      };

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings(), verbose: false });

      // Should detect all duplications - tracks ALL parent relationships (3 parents = 3 entries)
      expect(result.duplicatedNodes).toHaveLength(3);
      expect(result.duplicatedNodes[0].node.notion_page_id).toBe('research-1');
      expect(result.duplicatedNodes[1].node.notion_page_id).toBe('research-1');
      expect(result.duplicatedNodes[2].node.notion_page_id).toBe('research-1');
      // Verify all three parent relationships are tracked
      const parentIds = result.duplicatedNodes.map((d) => d.parentId).sort();
      expect(parentIds).toEqual(['section-1', 'section-2', 'section-3']);
    });
  });

  describe('Atlas UUID Maps', () => {
    it('should generate atlasUUIDsToDocNames map correctly', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage('Article', {
        notion_page_id: 'article-1',
        atlas_database_name: 'Articles',
        plain_text_name: 'Test Article',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Test Section',
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      // Set up UUID mappings
      const uuidMappings = createMockUuidMappings();
      uuidMappings.notionPageIDsToAtlasUUIDs.set('scope-1', 'atlas-uuid-scope-1');
      uuidMappings.notionPageIDsToAtlasUUIDs.set('article-1', 'atlas-uuid-article-1');
      uuidMappings.notionPageIDsToAtlasUUIDs.set('section-1', 'atlas-uuid-section-1');

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings });

      // Verify atlasUUIDsToGeneratedDocNumbers map is populated
      // Note: Scope numbering starts at 0, so first scope is A.0
      expect(result.atlasUUIDsToGeneratedDocNumbers.get('atlas-uuid-scope-1')).toBe('A.0');
      expect(result.atlasUUIDsToGeneratedDocNumbers.get('atlas-uuid-article-1')).toBe('A.0.1');
      expect(result.atlasUUIDsToGeneratedDocNumbers.get('atlas-uuid-section-1')).toBe('A.0.1.1');

      // Verify atlasUUIDsToDocNames map is populated
      // Note: Document names are from plain_text_name, not normalized
      expect(result.atlasUUIDsToDocNames.get('atlas-uuid-scope-1')).toBe('Test Scope');
      expect(result.atlasUUIDsToDocNames.get('atlas-uuid-article-1')).toBe('Test Article');
      expect(result.atlasUUIDsToDocNames.get('atlas-uuid-section-1')).toBe('Test Section');
    });

    it('should handle orphaned nodes in UUID maps', async () => {
      // Create a scope and an orphaned section (section not referenced by any parent)
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
      });

      const orphanedSection = makeBasePage('Section', {
        notion_page_id: 'orphaned-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Orphaned Section',
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [orphanedSection],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      // Set up UUID mappings
      const uuidMappings = createMockUuidMappings();
      uuidMappings.notionPageIDsToAtlasUUIDs.set('scope-1', 'atlas-uuid-scope-1');
      uuidMappings.notionPageIDsToAtlasUUIDs.set('orphaned-1', 'atlas-uuid-orphaned-1');

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings });

      // Verify scope is in the tree
      expect(result.scopeTrees).toHaveLength(1);
      expect(result.atlasUUIDsToGeneratedDocNumbers.get('atlas-uuid-scope-1')).toBe('A.0');
      expect(result.atlasUUIDsToDocNames.get('atlas-uuid-scope-1')).toBe('Test Scope');

      // Verify orphaned node is tracked separately
      expect(result.orphanedNodesAsTreeNodes).toHaveLength(1);

      // Orphaned nodes don't get document numbers assigned (generatedDocID is undefined)
      // but they still get document names (generatedDocName is set during name generation)
      expect(result.atlasUUIDsToGeneratedDocNumbers.has('atlas-uuid-orphaned-1')).toBe(false);
      expect(result.atlasUUIDsToDocNames.get('atlas-uuid-orphaned-1')).toBe('Orphaned Section');
    });

    it('should not include nodes without UUID mappings', async () => {
      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      // Empty UUID mappings - no mapping for scope-1
      const uuidMappings = createMockUuidMappings();

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings });

      // Maps should be empty since there's no UUID mapping
      expect(result.atlasUUIDsToGeneratedDocNumbers.size).toBe(0);
      expect(result.atlasUUIDsToDocNames.size).toBe(0);
    });
  });

  describe('Nesting Override Integration', () => {
    beforeEach(async () => {
      // Reset mock before each test
      const { loadNotionNestingFixMappings } = await import(
        '@/app/server/services/supabase/notion-nesting-bug-mappings'
      );
      vi.mocked(loadNotionNestingFixMappings).mockResolvedValue([]);
    });

    it('should apply nesting overrides during tree building', async () => {
      const { loadNotionNestingFixMappings } = await import(
        '@/app/server/services/supabase/notion-nesting-bug-mappings'
      );

      // Create test data: parent section with two cores, but child-2 should move to child-1
      const parentSection = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Parent Section',
        child_section_and_primary_doc_ids: ['core-1', 'core-2'],
      });

      const coreChild1 = makeBasePage('Core', {
        notion_page_id: 'core-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 1',
        parent_notion_page_id: 'section-1',
        child_section_and_primary_doc_ids: [],
      });

      const coreChild2 = makeBasePage('Core', {
        notion_page_id: 'core-2',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 2',
        parent_notion_page_id: 'section-1',
        child_section_and_primary_doc_ids: [],
      });

      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        'Sections & Primary Docs': [parentSection, coreChild1, coreChild2],
        Articles: [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      // Mock nesting mappings: move core-2 from section-1 to core-1
      vi.mocked(loadNotionNestingFixMappings).mockResolvedValue([
        {
          child_notion_page_id: 'core-2',
          parent_notion_page_id: 'core-1',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ]);

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Verify the override was applied
      expect(result.scopeTrees).toHaveLength(1);
      const builtScope = result.scopeTrees[0];

      // Navigate to parent section
      expect(builtScope.sectionsAndPrimaryDocs).toHaveLength(1);
      const builtSection = builtScope.sectionsAndPrimaryDocs[0];

      // Section should now only have core-1 as direct child
      expect(builtSection.sectionsAndPrimaryDocs).toHaveLength(1);
      expect(builtSection.sectionsAndPrimaryDocs[0].notion_page_id).toBe('core-1');

      // Core-1 should have core-2 as its child
      const builtCore1 = builtSection.sectionsAndPrimaryDocs[0];
      expect(builtCore1.sectionsAndPrimaryDocs).toHaveLength(1);
      expect(builtCore1.sectionsAndPrimaryDocs[0].notion_page_id).toBe('core-2');
    });

    it('should handle empty nesting mappings', async () => {
      const { loadNotionNestingFixMappings } = await import(
        '@/app/server/services/supabase/notion-nesting-bug-mappings'
      );

      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      // No mappings
      vi.mocked(loadNotionNestingFixMappings).mockResolvedValue([]);

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      expect(result.scopeTrees).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should apply overrides for Agent Scope Database', async () => {
      const { loadNotionNestingFixMappings } = await import(
        '@/app/server/services/supabase/notion-nesting-bug-mappings'
      );

      const parentCore = makeBasePage('Core', {
        notion_page_id: 'agent-core-1',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Core 1',
        child_agent_scope_ids: ['agent-core-2', 'agent-core-3'],
      });

      const childCore2 = makeBasePage('Core', {
        notion_page_id: 'agent-core-2',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Core 2',
        parent_notion_page_id: 'agent-core-1',
        child_agent_scope_ids: [],
      });

      const childCore3 = makeBasePage('Core', {
        notion_page_id: 'agent-core-3',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Core 3',
        parent_notion_page_id: 'agent-core-1',
        child_agent_scope_ids: [],
      });

      const section = makeBasePage('Section', {
        notion_page_id: 'section-1',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Parent Section',
        child_agent_scope_ids: ['agent-core-1'],
      });

      const scope = makeBasePage('Scope', {
        notion_page_id: 'scope-1',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {
        Scopes: [scope],
        'Sections & Primary Docs': [section],
        'Agent Scope Database': [parentCore, childCore2, childCore3],
        Articles: [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Needed Research': [],
      };

      // Mock nesting mappings: move agent-core-3 from agent-core-1 to agent-core-2
      vi.mocked(loadNotionNestingFixMappings).mockResolvedValue([
        {
          child_notion_page_id: 'agent-core-3',
          parent_notion_page_id: 'agent-core-2',
          atlas_database_name: 'Agent Scope Database',
        },
      ]);

      const result = await buildAtlasTree(pagesByDatabase, { uuidMappings: createMockUuidMappings() });

      // Navigate through tree to verify override
      expect(result.scopeTrees).toHaveLength(1);
      const builtScope = result.scopeTrees[0];
      const builtSection = builtScope.sectionsAndPrimaryDocs[0];
      const builtAgentCore1 = builtSection.agentScopeDocs[0];

      // agent-core-1 should only have agent-core-2 as direct child now
      expect(builtAgentCore1.agentScopeDocs).toHaveLength(1);
      expect(builtAgentCore1.agentScopeDocs[0].notion_page_id).toBe('agent-core-2');

      // agent-core-2 should have agent-core-3 as its child
      const builtAgentCore2 = builtAgentCore1.agentScopeDocs[0];
      expect(builtAgentCore2.agentScopeDocs).toHaveLength(1);
      expect(builtAgentCore2.agentScopeDocs[0].notion_page_id).toBe('agent-core-3');
    });
  });
});
