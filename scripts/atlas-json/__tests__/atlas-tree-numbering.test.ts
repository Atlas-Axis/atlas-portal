// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { NotionDatabasePage } from '../../../app/server/database/notion-database-page';
import { AtlasDatabaseName } from '../../../app/server/services/atlas/constants';
import { buildAtlasTree } from '../atlas-tree-builder';
import { assignDocumentNumbersToTreesRecursively } from '../atlas-tree-numbering';
import { AtlasTreeNode } from '../atlas-tree-types';

/**
 * Unit tests for Atlas Document Numbering System
 *
 * Tests the document number generation rules defined in docs/ATLAS_DOCUMENT_NUMBERING_RULES.md
 *
 * The Atlas uses hierarchical document numbering where each document's number inherits from
 * its parent document with additional segments appended. This test suite validates:
 *
 * - Sequential numbering for each document type
 * - Special directory numbers for supporting documents (.0.3, .0.4, .0.6)
 * - Global numbering for Needed Research (NR-X)
 * - Mixed document type scenarios with proper ordering
 * - Sort order handling and document type priority fallbacks
 */

/**
 * Test helper to create a base NotionDatabasePage with default values
 */
function makeBasePage(overrides: Partial<NotionDatabasePage>): NotionDatabasePage {
  return {
    notion_page_id: 'test-id',
    canonical_document_title: null,
    atlas_document_type: 'Placeholder',
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
 * Helper function to build tree and assign document numbers
 */
function buildTreeWithNumbering(pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>): {
  scopeTrees: AtlasTreeNode[];
  docNumbers: Map<string, string>;
} {
  const result = buildAtlasTree(pagesByDatabase, { assignDocumentNumbers: false });
  const docNumbers = assignDocumentNumbersToTreesRecursively(result.scopeTrees);
  return { scopeTrees: result.scopeTrees, docNumbers };
}

describe('Atlas Document Numbering System', () => {
  let pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>;

  beforeEach(() => {
    pagesByDatabase = {};
  });

  describe('Basic Document Type Numbering', () => {
    it('should number Scope documents sequentially starting at A.0', () => {
      const scope1 = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'First Scope',
        atlas_document_number: 'A.0',
      });

      const scope2 = makeBasePage({
        notion_page_id: 'scope-2',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Second Scope',
        atlas_document_number: 'A.1',
      });

      const scope3 = makeBasePage({
        notion_page_id: 'scope-3',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Third Scope',
        atlas_document_number: 'A.2',
      });

      pagesByDatabase = {
        Scopes: [scope3, scope1, scope2], // Intentionally out of order to test sorting
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

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('scope-1')).toBe('A.0');
      expect(docNumbers.get('scope-2')).toBe('A.1');
      expect(docNumbers.get('scope-3')).toBe('A.2');
    });

    it('should number Article documents under Scope starting at 1', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1', 'article-2', 'article-3'],
      });

      const article1 = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
      });

      const article2 = makeBasePage({
        notion_page_id: 'article-2',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 2',
      });

      const article3 = makeBasePage({
        notion_page_id: 'article-3',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 3',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article1, article2, article3],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('scope-1')).toBe('A.0');
      expect(docNumbers.get('article-1')).toBe('A.0.1');
      expect(docNumbers.get('article-2')).toBe('A.0.2');
      expect(docNumbers.get('article-3')).toBe('A.0.3');
    });

    it('should number Section documents under Article starting at 1', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1', 'section-2'],
      });

      const section1 = makeBasePage({
        notion_page_id: 'section-1',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
      });

      const section2 = makeBasePage({
        notion_page_id: 'section-2',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section1, section2],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('section-1')).toBe('A.0.1.1');
      expect(docNumbers.get('section-2')).toBe('A.0.1.2');
    });

    it('should number Primary documents under Section sequentially (Core, Active Data Controller, Type Specification)', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage({
        notion_page_id: 'section-1',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        child_section_and_primary_doc_ids: ['core-1', 'adc-1', 'typespec-1'],
      });

      const core = makeBasePage({
        notion_page_id: 'core-1',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 1',
        parent_notion_page_id: null, // Direct child
      });

      const adc = makeBasePage({
        notion_page_id: 'adc-1',
        atlas_document_type: 'Active Data Controller',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'ADC 1',
        parent_notion_page_id: null, // Direct child
      });

      const typespec = makeBasePage({
        notion_page_id: 'typespec-1',
        atlas_document_type: 'Type Specification',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'TypeSpec 1',
        parent_notion_page_id: null, // Direct child
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section, core, adc, typespec],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('core-1')).toBe('A.0.1.1.1');
      expect(docNumbers.get('adc-1')).toBe('A.0.1.1.2');
      expect(docNumbers.get('typespec-1')).toBe('A.0.1.1.3');
    });
  });

  describe('Supporting Document Numbering', () => {
    it('should number Annotations with .0.3 segment', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage({
        notion_page_id: 'section-1',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        child_annotation_ids: ['annotation-1', 'annotation-2'],
      });

      const annotation1 = makeBasePage({
        notion_page_id: 'annotation-1',
        atlas_document_type: 'Annotation',
        atlas_database_name: 'Annotations',
        plain_text_name: 'Annotation 1',
      });

      const annotation2 = makeBasePage({
        notion_page_id: 'annotation-2',
        atlas_document_type: 'Annotation',
        atlas_database_name: 'Annotations',
        plain_text_name: 'Annotation 2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section],
        Annotations: [annotation1, annotation2],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('annotation-1')).toBe('A.0.1.1.0.3.1');
      expect(docNumbers.get('annotation-2')).toBe('A.0.1.1.0.3.2');
    });

    it('should number Tenets with .0.4 segment', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage({
        notion_page_id: 'section-1',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        child_tenet_ids: ['tenet-1', 'tenet-2'],
      });

      const tenet1 = makeBasePage({
        notion_page_id: 'tenet-1',
        atlas_document_type: 'Action Tenet',
        atlas_database_name: 'Tenets',
        plain_text_name: 'Tenet 1',
      });

      const tenet2 = makeBasePage({
        notion_page_id: 'tenet-2',
        atlas_document_type: 'Action Tenet',
        atlas_database_name: 'Tenets',
        plain_text_name: 'Tenet 2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section],
        Annotations: [],
        Tenets: [tenet1, tenet2],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('tenet-1')).toBe('A.0.1.1.0.4.1');
      expect(docNumbers.get('tenet-2')).toBe('A.0.1.1.0.4.2');
    });

    it('should number Scenarios under Tenets with .1.X suffix', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_tenet_ids: ['tenet-1'],
      });

      const tenet = makeBasePage({
        notion_page_id: 'tenet-1',
        atlas_document_type: 'Action Tenet',
        atlas_database_name: 'Tenets',
        plain_text_name: 'Tenet 1',
        child_scenario_ids: ['scenario-1', 'scenario-2'],
      });

      const scenario1 = makeBasePage({
        notion_page_id: 'scenario-1',
        atlas_document_type: 'Scenario',
        atlas_database_name: 'Scenarios',
        plain_text_name: 'Scenario 1',
      });

      const scenario2 = makeBasePage({
        notion_page_id: 'scenario-2',
        atlas_document_type: 'Scenario',
        atlas_database_name: 'Scenarios',
        plain_text_name: 'Scenario 2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [tenet],
        Scenarios: [scenario1, scenario2],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('tenet-1')).toBe('A.0.0.4.1');
      expect(docNumbers.get('scenario-1')).toBe('A.0.0.4.1.1.1');
      expect(docNumbers.get('scenario-2')).toBe('A.0.0.4.1.1.2');
    });

    it('should number Scenario Variations with .varX suffix', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_scenario_ids: ['scenario-1'],
      });

      const scenario = makeBasePage({
        notion_page_id: 'scenario-1',
        atlas_document_type: 'Scenario',
        atlas_database_name: 'Scenarios',
        plain_text_name: 'Scenario 1',
        child_scenario_variation_ids: ['variation-1', 'variation-2'],
      });

      const variation1 = makeBasePage({
        notion_page_id: 'variation-1',
        atlas_document_type: 'Scenario Variation',
        atlas_database_name: 'Scenario Variations',
        plain_text_name: 'Variation 1',
      });

      const variation2 = makeBasePage({
        notion_page_id: 'variation-2',
        atlas_document_type: 'Scenario Variation',
        atlas_database_name: 'Scenario Variations',
        plain_text_name: 'Variation 2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [],
        'Sections & Primary Docs': [],
        Annotations: [],
        Tenets: [],
        Scenarios: [scenario],
        'Scenario Variations': [variation1, variation2],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('scenario-1')).toBe('A.0.1.1');
      expect(docNumbers.get('variation-1')).toBe('A.0.1.1.var1');
      expect(docNumbers.get('variation-2')).toBe('A.0.1.1.var2');
    });

    it('should number Active Data with .0.6 segment', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['adc-1'],
      });

      const adc = makeBasePage({
        notion_page_id: 'adc-1',
        atlas_document_type: 'Active Data Controller',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'ADC 1',
        child_active_data_ids: ['active-data-1', 'active-data-2'],
      });

      const activeData1 = makeBasePage({
        notion_page_id: 'active-data-1',
        atlas_document_type: 'Active Data',
        atlas_database_name: 'Active Data',
        plain_text_name: 'Active Data 1',
      });

      const activeData2 = makeBasePage({
        notion_page_id: 'active-data-2',
        atlas_document_type: 'Active Data',
        atlas_database_name: 'Active Data',
        plain_text_name: 'Active Data 2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [adc],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [activeData1, activeData2],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('adc-1')).toBe('A.0.1.1');
      expect(docNumbers.get('active-data-1')).toBe('A.0.1.1.0.6.1');
      expect(docNumbers.get('active-data-2')).toBe('A.0.1.1.0.6.2');
    });
  });

  describe('Global and Special Numbering', () => {
    it('should number Needed Research with global numbering (NR-1, NR-2)', () => {
      const scope1 = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Scope 1',
        child_needed_research_ids: ['research-1'],
      });

      const scope2 = makeBasePage({
        notion_page_id: 'scope-2',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Scope 2',
        child_needed_research_ids: ['research-2', 'research-3'],
      });

      const research1 = makeBasePage({
        notion_page_id: 'research-1',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 1',
      });

      const research2 = makeBasePage({
        notion_page_id: 'research-2',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 2',
      });

      const research3 = makeBasePage({
        notion_page_id: 'research-3',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 3',
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
        'Needed Research': [research1, research2, research3],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('research-1')).toBe('NR-1');
      expect(docNumbers.get('research-2')).toBe('NR-2');
      expect(docNumbers.get('research-3')).toBe('NR-3');
    });

    it('should maintain global Needed Research counter across multiple scopes', () => {
      const scope1 = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Scope 1',
        child_needed_research_ids: ['research-1', 'research-2'],
      });

      const scope2 = makeBasePage({
        notion_page_id: 'scope-2',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Scope 2',
        child_needed_research_ids: ['research-3', 'research-4'],
      });

      const research1 = makeBasePage({
        notion_page_id: 'research-1',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 1',
      });

      const research2 = makeBasePage({
        notion_page_id: 'research-2',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 2',
      });

      const research3 = makeBasePage({
        notion_page_id: 'research-3',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 3',
      });

      const research4 = makeBasePage({
        notion_page_id: 'research-4',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 4',
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
        'Needed Research': [research1, research2, research3, research4],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      // Should increment globally across all scopes
      expect(docNumbers.get('research-1')).toBe('NR-1');
      expect(docNumbers.get('research-2')).toBe('NR-2');
      expect(docNumbers.get('research-3')).toBe('NR-3');
      expect(docNumbers.get('research-4')).toBe('NR-4');
    });
  });

  describe('Mixed Document Type Scenarios', () => {
    it('should handle Agent Scope Database mixed Core + Active Data Controller types', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_agent_scope_ids: ['agent-core-1', 'agent-adc-1', 'agent-core-2'],
      });

      const agentCore1 = makeBasePage({
        notion_page_id: 'agent-core-1',
        atlas_document_type: 'Core',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Core 1',
        parent_notion_page_id: null,
      });

      const agentAdc = makeBasePage({
        notion_page_id: 'agent-adc-1',
        atlas_document_type: 'Active Data Controller',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent ADC 1',
        parent_notion_page_id: null,
      });

      const agentCore2 = makeBasePage({
        notion_page_id: 'agent-core-2',
        atlas_document_type: 'Core',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Core 2',
        parent_notion_page_id: null,
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
        'Agent Scope Database': [agentCore1, agentAdc, agentCore2],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('agent-core-1')).toBe('A.0.1');
      expect(docNumbers.get('agent-adc-1')).toBe('A.0.2');
      expect(docNumbers.get('agent-core-2')).toBe('A.0.3');
    });

    it('should handle complex multiple sections with different document type combinations', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1', 'section-2'],
      });

      // Section 1 has Core + ADC
      const section1 = makeBasePage({
        notion_page_id: 'section-1',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        child_section_and_primary_doc_ids: ['core-1', 'adc-1'],
      });

      // Section 2 has TypeSpec + Core
      const section2 = makeBasePage({
        notion_page_id: 'section-2',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 2',
        child_section_and_primary_doc_ids: ['typespec-1', 'core-2'],
      });

      const core1 = makeBasePage({
        notion_page_id: 'core-1',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 1',
        parent_notion_page_id: null,
      });

      const adc1 = makeBasePage({
        notion_page_id: 'adc-1',
        atlas_document_type: 'Active Data Controller',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'ADC 1',
        parent_notion_page_id: null,
      });

      const typespec1 = makeBasePage({
        notion_page_id: 'typespec-1',
        atlas_document_type: 'Type Specification',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'TypeSpec 1',
        parent_notion_page_id: null,
      });

      const core2 = makeBasePage({
        notion_page_id: 'core-2',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 2',
        parent_notion_page_id: null,
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section1, section2, core1, adc1, typespec1, core2],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      // Section numbering
      expect(docNumbers.get('section-1')).toBe('A.0.1.1');
      expect(docNumbers.get('section-2')).toBe('A.0.1.2');

      // Mixed types under section 1 (Core=1, ADC=2 by type priority)
      expect(docNumbers.get('core-1')).toBe('A.0.1.1.1');
      expect(docNumbers.get('adc-1')).toBe('A.0.1.1.2');

      // Mixed types under section 2 - Current implementation orders by child array position
      expect(docNumbers.get('typespec-1')).toBe('A.0.1.2.1'); // First in child array
      expect(docNumbers.get('core-2')).toBe('A.0.1.2.2'); // Second in child array
    });
  });

  describe('Complete Hierarchy Integration Tests', () => {
    it('should handle complete Atlas hierarchy with all document types', () => {
      // Build a comprehensive hierarchy
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
        child_agent_scope_ids: ['agent-core-1'],
        child_needed_research_ids: ['research-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage({
        notion_page_id: 'section-1',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        child_section_and_primary_doc_ids: ['core-1', 'adc-1'],
        child_annotation_ids: ['annotation-1'],
        child_tenet_ids: ['tenet-1'],
      });

      const core = makeBasePage({
        notion_page_id: 'core-1',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Core 1',
        parent_notion_page_id: null,
      });

      const adc = makeBasePage({
        notion_page_id: 'adc-1',
        atlas_document_type: 'Active Data Controller',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'ADC 1',
        parent_notion_page_id: null,
        child_active_data_ids: ['active-data-1'],
      });

      const annotation = makeBasePage({
        notion_page_id: 'annotation-1',
        atlas_document_type: 'Annotation',
        atlas_database_name: 'Annotations',
        plain_text_name: 'Annotation 1',
      });

      const tenet = makeBasePage({
        notion_page_id: 'tenet-1',
        atlas_document_type: 'Action Tenet',
        atlas_database_name: 'Tenets',
        plain_text_name: 'Tenet 1',
        child_scenario_ids: ['scenario-1'],
      });

      const scenario = makeBasePage({
        notion_page_id: 'scenario-1',
        atlas_document_type: 'Scenario',
        atlas_database_name: 'Scenarios',
        plain_text_name: 'Scenario 1',
        child_scenario_variation_ids: ['variation-1'],
      });

      const variation = makeBasePage({
        notion_page_id: 'variation-1',
        atlas_document_type: 'Scenario Variation',
        atlas_database_name: 'Scenario Variations',
        plain_text_name: 'Variation 1',
      });

      const activeData = makeBasePage({
        notion_page_id: 'active-data-1',
        atlas_document_type: 'Active Data',
        atlas_database_name: 'Active Data',
        plain_text_name: 'Active Data 1',
      });

      const agentCore = makeBasePage({
        notion_page_id: 'agent-core-1',
        atlas_document_type: 'Core',
        atlas_database_name: 'Agent Scope Database',
        plain_text_name: 'Agent Core 1',
        parent_notion_page_id: null,
      });

      const research = makeBasePage({
        notion_page_id: 'research-1',
        atlas_document_type: 'Needed Research',
        atlas_database_name: 'Needed Research',
        plain_text_name: 'Research 1',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section, core, adc],
        Annotations: [annotation],
        Tenets: [tenet],
        Scenarios: [scenario],
        'Scenario Variations': [variation],
        'Active Data': [activeData],
        'Agent Scope Database': [agentCore],
        'Needed Research': [research],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      // Verify the complete hierarchy
      expect(docNumbers.get('scope-1')).toBe('A.0');
      expect(docNumbers.get('article-1')).toBe('A.0.1');
      expect(docNumbers.get('section-1')).toBe('A.0.1.1');
      expect(docNumbers.get('core-1')).toBe('A.0.1.1.1');
      expect(docNumbers.get('adc-1')).toBe('A.0.1.1.2');
      expect(docNumbers.get('annotation-1')).toBe('A.0.1.1.0.3.1');
      expect(docNumbers.get('tenet-1')).toBe('A.0.1.1.0.4.1');
      expect(docNumbers.get('scenario-1')).toBe('A.0.1.1.0.4.1.1.1');
      expect(docNumbers.get('variation-1')).toBe('A.0.1.1.0.4.1.1.1.var1');
      expect(docNumbers.get('active-data-1')).toBe('A.0.1.1.2.0.6.1');
      expect(docNumbers.get('agent-core-1')).toBe('A.0.1');
      expect(docNumbers.get('research-1')).toBe('NR-1');
    });
  });

  describe('Nested Core Document Numbering', () => {
    it('should handle nested Core documents correctly', () => {
      const scope = makeBasePage({
        notion_page_id: 'scope-1',
        atlas_document_type: 'Scope',
        atlas_database_name: 'Scopes',
        plain_text_name: 'Test Scope',
        child_article_ids: ['article-1'],
      });

      const article = makeBasePage({
        notion_page_id: 'article-1',
        atlas_document_type: 'Article',
        atlas_database_name: 'Articles',
        plain_text_name: 'Article 1',
        child_section_and_primary_doc_ids: ['section-1'],
      });

      const section = makeBasePage({
        notion_page_id: 'section-1',
        atlas_document_type: 'Section',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Section 1',
        child_section_and_primary_doc_ids: ['core-1'],
      });

      const parentCore = makeBasePage({
        notion_page_id: 'core-1',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Parent Core',
        parent_notion_page_id: null,
        child_section_and_primary_doc_ids: ['core-2', 'core-3'],
      });

      const childCore1 = makeBasePage({
        notion_page_id: 'core-2',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Child Core 1',
        parent_notion_page_id: 'core-1',
        child_section_and_primary_doc_ids: ['core-4'],
      });

      const childCore2 = makeBasePage({
        notion_page_id: 'core-3',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Child Core 2',
        parent_notion_page_id: 'core-1',
      });

      const grandchildCore = makeBasePage({
        notion_page_id: 'core-4',
        atlas_document_type: 'Core',
        atlas_database_name: 'Sections & Primary Docs',
        plain_text_name: 'Grandchild Core',
        parent_notion_page_id: 'core-2',
      });

      pagesByDatabase = {
        Scopes: [scope],
        Articles: [article],
        'Sections & Primary Docs': [section, parentCore, childCore1, childCore2, grandchildCore],
        Annotations: [],
        Tenets: [],
        Scenarios: [],
        'Scenario Variations': [],
        'Active Data': [],
        'Agent Scope Database': [],
        'Needed Research': [],
      };

      const { docNumbers } = buildTreeWithNumbering(pagesByDatabase);

      expect(docNumbers.get('core-1')).toBe('A.0.1.1.1');
      expect(docNumbers.get('core-2')).toBe('A.0.1.1.1.1');
      expect(docNumbers.get('core-3')).toBe('A.0.1.1.1.2');
      expect(docNumbers.get('core-4')).toBe('A.0.1.1.1.1.1');
    });
  });
});
