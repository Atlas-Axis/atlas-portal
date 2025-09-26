// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AtlasDatabaseName } from '@/app/server/services/atlas/constants';
import { DEBUG_LOGGING } from '../../../app/shared/utils/is-debug-logging-enabled';
import {
  buildDocumentHierarchy,
  generateActiveDataControllerNumber,
  generateActiveDataNumber,
  generateAnnotationNumber,
  generateArticleNumber,
  generateCoreNumber,
  generateDocumentNumbers,
  generateNeededResearchNumber,
  generateScenarioNumber,
  generateScenarioVariationNumber,
  generateScopeNumber,
  generateSectionNumber,
  generateTenetNumber,
  generateTypeSpecificationNumber,
} from '../document-numbering';
import { logDocumentHierarchy } from '../document-numbering';

function makeBasePage(overrides: Partial<NotionDatabasePage>): NotionDatabasePage {
  return {
    notion_page_id: 'id',
    canonical_document_title: null,
    atlas_document_type: 'Section',
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

describe('Atlas Document Numbering', () => {
  it('numbers Scopes sequentially starting at A.0', () => {
    const s1 = makeBasePage({
      notion_page_id: 's1',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const s2 = makeBasePage({
      notion_page_id: 's2',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });

    const hierarchy = buildDocumentHierarchy([s1, s2]);
    if (DEBUG_LOGGING) {
      const map = new Map<string, string>();
      map.set('s1', generateScopeNumber(s1, hierarchy));
      map.set('s2', generateScopeNumber(s2, hierarchy));
      logDocumentHierarchy(hierarchy, map);
    }
    expect(generateScopeNumber(s1, hierarchy)).toBe('A.0');
    expect(generateScopeNumber(s2, hierarchy)).toBe('A.1');
  });

  it('numbers Articles under Scope starting at 1', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const a1 = makeBasePage({
      notion_page_id: 'a1',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    const a2 = makeBasePage({
      notion_page_id: 'a2',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['a1', 'a2'];

    const pagesByDb: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = { Scopes: [scope], Articles: [a1, a2] };
    const numbers = generateDocumentNumbers(pagesByDb);
    if (DEBUG_LOGGING) {
      const all = [scope, a1, a2];
      const hierarchy = buildDocumentHierarchy(all);
      logDocumentHierarchy(hierarchy, numbers);
    }
    expect(numbers.get('scope')).toBe('A.0');
    expect(numbers.get('a1')).toBe('A.0.1');
    expect(numbers.get('a2')).toBe('A.0.2');
  });

  it('numbers Sections under Article starting at 1', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const article = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const s1 = makeBasePage({
      notion_page_id: 's1',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0,
    });
    const s2 = makeBasePage({
      notion_page_id: 's2',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1,
    });
    article.child_section_and_primary_doc_ids = ['s1', 's2'];

    const pagesByDb = { Scopes: [scope], Articles: [article], 'Sections & Primary Docs': [s1, s2] };
    const numbers = generateDocumentNumbers(pagesByDb);
    if (DEBUG_LOGGING) {
      const all = [scope, article, s1, s2];
      const hierarchy = buildDocumentHierarchy(all);
      logDocumentHierarchy(hierarchy, numbers);
    }
    expect(numbers.get('art')).toBe('A.0.1');
    expect(numbers.get('s1')).toBe('A.0.1.1');
    expect(numbers.get('s2')).toBe('A.0.1.2');
  });

  it('numbers Core/Active Data Controller/Type Specification under Section starting at 1', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    art.child_section_and_primary_doc_ids = ['sec'];
    const core1 = makeBasePage({
      notion_page_id: 'core1',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0,
    });
    const core2 = makeBasePage({
      notion_page_id: 'core2',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1,
    });
    const adc = makeBasePage({
      notion_page_id: 'adc',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const ts = makeBasePage({
      notion_page_id: 'ts',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
    });
    sec.child_section_and_primary_doc_ids = ['core1', 'core2', 'adc', 'ts'];

    const pages = { Scopes: [scope], Articles: [art], 'Sections & Primary Docs': [sec, core1, core2, adc, ts] };
    const numbers = generateDocumentNumbers(pages);
    if (DEBUG_LOGGING) {
      const all = [scope, art, sec, core1, core2, adc, ts];
      const hierarchy = buildDocumentHierarchy(all);
      logDocumentHierarchy(hierarchy, numbers);
    }
    expect(numbers.get('sec')).toBe('A.0.1.1');
    expect(numbers.get('core1')).toBe('A.0.1.1.1');
    expect(numbers.get('core2')).toBe('A.0.1.1.2');
    // Sequential numbering: Active Data Controller gets next sequential number
    expect(numbers.get('adc')).toBe('A.0.1.1.3');
    // Sequential numbering: Type Specification gets next sequential number
    expect(numbers.get('ts')).toBe('A.0.1.1.4');

    // Also verify direct generators produce matching formats when parentNumber provided
    const hierarchy = buildDocumentHierarchy(Object.values(pages).flat());
    const map = new Map<string, string>(Array.from(numbers.entries()));
    expect(generateCoreNumber(core1, hierarchy, map)).toBe('A.0.1.1.1');
    expect(generateActiveDataControllerNumber(adc, hierarchy, map)).toBe('A.0.1.1.3');
    expect(generateTypeSpecificationNumber(ts, hierarchy, map)).toBe('A.0.1.1.4');
  });

  it('numbers Annotations/Tenets under target with .0.3/.0.4 segment', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    art.child_section_and_primary_doc_ids = ['sec'];
    const ann1 = makeBasePage({
      notion_page_id: 'ann1',
      atlas_document_type: 'Annotation',
      atlas_database_name: 'Annotations',
      sort_order: 0,
    });
    const ann2 = makeBasePage({
      notion_page_id: 'ann2',
      atlas_document_type: 'Annotation',
      atlas_database_name: 'Annotations',
      sort_order: 1,
    });
    const ten1 = makeBasePage({
      notion_page_id: 'ten1',
      atlas_document_type: 'Action Tenet',
      atlas_database_name: 'Tenets',
    });
    sec.child_annotation_ids = ['ann1', 'ann2'];
    sec.child_tenet_ids = ['ten1'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec],
      Annotations: [ann1, ann2],
      Tenets: [ten1],
    };
    const numbers = generateDocumentNumbers(pages);
    if (DEBUG_LOGGING) {
      const all = [scope, art, sec, ann1, ann2, ten1];
      const hierarchy = buildDocumentHierarchy(all);
      logDocumentHierarchy(hierarchy, numbers);
    }
    expect(numbers.get('sec')).toBe('A.0.1.1');
    expect(numbers.get('ann1')).toBe('A.0.1.1.0.3.1');
    expect(numbers.get('ann2')).toBe('A.0.1.1.0.3.2');
    expect(numbers.get('ten1')).toBe('A.0.1.1.0.4.1');

    const hierarchy = buildDocumentHierarchy(Object.values(pages).flat());
    const map = new Map<string, string>(Array.from(numbers.entries()));
    expect(generateAnnotationNumber(ann1, hierarchy, map)).toBe('A.0.1.1.0.3.1');
    expect(generateTenetNumber(ten1, hierarchy, map)).toBe('A.0.1.1.0.4.1');
  });

  it('numbers Scenarios and Variations under Tenet/Scenario', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    art.child_section_and_primary_doc_ids = ['sec'];
    const ten = makeBasePage({
      notion_page_id: 'ten',
      atlas_document_type: 'Action Tenet',
      atlas_database_name: 'Tenets',
    });
    sec.child_tenet_ids = ['ten'];
    const sc = makeBasePage({
      notion_page_id: 'sc',
      atlas_document_type: 'Scenario',
      atlas_database_name: 'Scenarios',
    });
    ten.child_scenario_ids = ['sc'];
    const var1 = makeBasePage({
      notion_page_id: 'var1',
      atlas_document_type: 'Scenario Variation',
      atlas_database_name: 'Scenario Variations',
    });
    sc.child_scenario_variation_ids = ['var1'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec],
      Tenets: [ten],
      Scenarios: [sc],
      'Scenario Variations': [var1],
    };
    const numbers = generateDocumentNumbers(pages);
    if (DEBUG_LOGGING) {
      const all = [scope, art, sec, ten, sc, var1];
      const hierarchy = buildDocumentHierarchy(all);
      logDocumentHierarchy(hierarchy, numbers);
    }
    expect(numbers.get('ten')).toBe('A.0.1.1.0.4.1');
    expect(numbers.get('sc')).toBe('A.0.1.1.0.4.1.1.1');
    expect(numbers.get('var1')).toBe('A.0.1.1.0.4.1.1.1.var1');

    const hierarchy = buildDocumentHierarchy(Object.values(pages).flat());
    const map = new Map<string, string>(Array.from(numbers.entries()));
    expect(generateScenarioNumber(sc, hierarchy, map)).toBe('A.0.1.1.0.4.1.1.1');
    expect(generateScenarioVariationNumber(var1, hierarchy, map)).toBe('A.0.1.1.0.4.1.1.1.var1');
  });

  it('numbers Active Data under Controller with .0.6 segment', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    art.child_section_and_primary_doc_ids = ['sec'];
    const adc = makeBasePage({
      notion_page_id: 'adc',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
    });
    sec.child_section_and_primary_doc_ids = ['adc'];
    const ad1 = makeBasePage({
      notion_page_id: 'ad1',
      atlas_document_type: 'Active Data',
      atlas_database_name: 'Active Data',
    });
    adc.child_active_data_ids = ['ad1'];

    const pages = { Scopes: [scope], Articles: [art], 'Sections & Primary Docs': [sec, adc], 'Active Data': [ad1] };
    const numbers = generateDocumentNumbers(pages);
    if (DEBUG_LOGGING) {
      const all = [scope, art, sec, adc, ad1];
      const hierarchy = buildDocumentHierarchy(all);
      logDocumentHierarchy(hierarchy, numbers);
    }
    expect(numbers.get('adc')).toBe('A.0.1.1.1');
    expect(numbers.get('ad1')).toBe('A.0.1.1.1.0.6.1');

    const hierarchy = buildDocumentHierarchy(Object.values(pages).flat());
    const map = new Map<string, string>(Array.from(numbers.entries()));
    expect(generateActiveDataNumber(ad1, hierarchy, map)).toBe('A.0.1.1.1.0.6.1');
  });

  it('numbers Needed Research globally as NR-1, NR-2, ...', () => {
    const nr1 = makeBasePage({
      notion_page_id: 'nr1',
      atlas_document_type: 'Needed Research',
      atlas_database_name: 'Needed Research',
      sort_order: 0,
    });
    const nr2 = makeBasePage({
      notion_page_id: 'nr2',
      atlas_document_type: 'Needed Research',
      atlas_database_name: 'Needed Research',
      sort_order: 1,
    });
    const hierarchy = buildDocumentHierarchy([nr1, nr2]);
    if (DEBUG_LOGGING) {
      const map = new Map<string, string>();
      map.set('nr1', generateNeededResearchNumber(nr1, hierarchy));
      map.set('nr2', generateNeededResearchNumber(nr2, hierarchy));
      logDocumentHierarchy(hierarchy, map);
    }
    expect(generateNeededResearchNumber(nr1, hierarchy)).toBe('NR-1');
    expect(generateNeededResearchNumber(nr2, hierarchy)).toBe('NR-2');
  });

  it('generateArticleNumber assigns correct index among siblings using sort_order', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const a1 = makeBasePage({
      notion_page_id: 'a1',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
      sort_order: 0,
    });
    const a2 = makeBasePage({
      notion_page_id: 'a2',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
      sort_order: 1,
    });
    scope.child_article_ids = ['a1', 'a2'];

    const pages = { Scopes: [scope], Articles: [a1, a2] };
    const all = Object.values(pages).flat();
    const hierarchy = buildDocumentHierarchy(all);
    const map = new Map<string, string>();
    map.set('scope', generateScopeNumber(scope, hierarchy));

    expect(generateArticleNumber(a1, hierarchy, map)).toBe('A.0.1');
    expect(generateArticleNumber(a2, hierarchy, map)).toBe('A.0.2');
  });

  it('generateSectionNumber assigns correct index under same Article', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const s1 = makeBasePage({
      notion_page_id: 's1',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0,
    });
    const s2 = makeBasePage({
      notion_page_id: 's2',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1,
    });
    art.child_section_and_primary_doc_ids = ['s1', 's2'];

    const pages = { Scopes: [scope], Articles: [art], 'Sections & Primary Docs': [s1, s2] };
    const all = Object.values(pages).flat();
    const hierarchy = buildDocumentHierarchy(all);
    const map = new Map<string, string>();
    map.set('scope', generateScopeNumber(scope, hierarchy));
    map.set('art', generateArticleNumber(art, hierarchy, map));

    expect(generateSectionNumber(s1, hierarchy, map)).toBe('A.0.1.1');
    expect(generateSectionNumber(s2, hierarchy, map)).toBe('A.0.1.2');
  });

  it('Agent Scope Database mixed document types (Core + Active Data Controller)', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    art.child_section_and_primary_doc_ids = ['sec'];

    // Agent Scope Database documents
    const agentCore = makeBasePage({
      notion_page_id: 'agentCore',
      atlas_document_type: 'Core',
      atlas_database_name: 'Agent Scope Database',
    });
    const agentAdc = makeBasePage({
      notion_page_id: 'agentAdc',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Agent Scope Database',
    });
    sec.child_agent_scope_ids = ['agentCore', 'agentAdc'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec],
      'Agent Scope Database': [agentCore, agentAdc],
    };
    const numbers = generateDocumentNumbers(pages);

    // Should be ordered by their original order in the list since no sort_order is set
    expect(numbers.get('agentCore')).toBe('A.0.1.1.1');
    expect(numbers.get('agentAdc')).toBe('A.0.1.1.2');
  });

  it('mixed sort_order and document type priority scenarios', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    art.child_section_and_primary_doc_ids = ['sec'];

    // Mix of sort_order and null sort_order
    const core1 = makeBasePage({
      notion_page_id: 'core1',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0, // Explicit sort_order
    });
    const adc = makeBasePage({
      notion_page_id: 'adc',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order - should use document type priority
    });
    const core2 = makeBasePage({
      notion_page_id: 'core2',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1, // Explicit sort_order
    });
    const ts = makeBasePage({
      notion_page_id: 'ts',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order - should use document type priority
    });
    sec.child_section_and_primary_doc_ids = ['core1', 'adc', 'core2', 'ts'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec, core1, adc, core2, ts],
    };
    const numbers = generateDocumentNumbers(pages);

    // Should be ordered by sort_order first, then document type priority
    expect(numbers.get('core1')).toBe('A.0.1.1.1'); // sort_order: 0
    expect(numbers.get('core2')).toBe('A.0.1.1.2'); // sort_order: 1
    expect(numbers.get('adc')).toBe('A.0.1.1.3'); // no sort_order, Active Data Controller priority
    expect(numbers.get('ts')).toBe('A.0.1.1.4'); // no sort_order, Type Specification priority
  });

  it('complex scenario: multiple sections with different primary document type mixes', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];

    // Section 1: Only Core documents
    const sec1 = makeBasePage({
      notion_page_id: 'sec1',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const core1 = makeBasePage({
      notion_page_id: 'core1',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const core2 = makeBasePage({
      notion_page_id: 'core2',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
    });
    sec1.child_section_and_primary_doc_ids = ['core1', 'core2'];

    // Section 2: Mixed types with sort_order
    const sec2 = makeBasePage({
      notion_page_id: 'sec2',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const adc1 = makeBasePage({
      notion_page_id: 'adc1',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0,
    });
    const ts1 = makeBasePage({
      notion_page_id: 'ts1',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1,
    });
    sec2.child_section_and_primary_doc_ids = ['adc1', 'ts1'];

    // Section 3: Mixed types without sort_order
    const sec3 = makeBasePage({
      notion_page_id: 'sec3',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const ts2 = makeBasePage({
      notion_page_id: 'ts2',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const adc2 = makeBasePage({
      notion_page_id: 'adc2',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
    });
    sec3.child_section_and_primary_doc_ids = ['ts2', 'adc2'];

    art.child_section_and_primary_doc_ids = ['sec1', 'sec2', 'sec3'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec1, sec2, sec3, core1, core2, adc1, ts1, ts2, adc2],
    };
    const numbers = generateDocumentNumbers(pages);

    // Section 1: Sequential Core documents
    expect(numbers.get('core1')).toBe('A.0.1.1.1');
    expect(numbers.get('core2')).toBe('A.0.1.1.2');

    // Section 2: sort_order takes precedence
    expect(numbers.get('adc1')).toBe('A.0.1.2.1'); // sort_order: 0
    expect(numbers.get('ts1')).toBe('A.0.1.2.2'); // sort_order: 1

    // Section 3: Document type priority (Active Data Controller before Type Specification)
    expect(numbers.get('adc2')).toBe('A.0.1.3.1'); // Active Data Controller priority
    expect(numbers.get('ts2')).toBe('A.0.1.3.2'); // Type Specification priority
  });

  it('edge case: empty sort_order vs explicit sort_order conflicts', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    scope.child_article_ids = ['art'];
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    art.child_section_and_primary_doc_ids = ['sec'];

    // Documents with explicit sort_order should come first
    const core1 = makeBasePage({
      notion_page_id: 'core1',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0,
    });
    const adc1 = makeBasePage({
      notion_page_id: 'adc1',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1,
    });

    // Documents without sort_order should come after, ordered by document type priority
    const ts = makeBasePage({
      notion_page_id: 'ts',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order
    });
    const adc2 = makeBasePage({
      notion_page_id: 'adc2',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order
    });
    const core2 = makeBasePage({
      notion_page_id: 'core2',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order
    });

    sec.child_section_and_primary_doc_ids = ['core1', 'adc1', 'ts', 'adc2', 'core2'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec, core1, adc1, ts, adc2, core2],
    };
    const numbers = generateDocumentNumbers(pages);

    // Explicit sort_order first, then document type priority
    expect(numbers.get('core1')).toBe('A.0.1.1.1'); // sort_order: 0
    expect(numbers.get('adc1')).toBe('A.0.1.1.2'); // sort_order: 1
    expect(numbers.get('core2')).toBe('A.0.1.1.3'); // no sort_order, Core priority
    expect(numbers.get('adc2')).toBe('A.0.1.1.4'); // no sort_order, Active Data Controller priority
    expect(numbers.get('ts')).toBe('A.0.1.1.5'); // no sort_order, Type Specification priority
  });

  it('Sections & Primary Docs: all document types as siblings with mixed sort_order', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });

    // Create all 4 document types as siblings under the section
    const core = makeBasePage({
      notion_page_id: 'core',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 2, // Explicit sort_order
    });
    const adc = makeBasePage({
      notion_page_id: 'adc',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1, // Explicit sort_order
    });
    const ts = makeBasePage({
      notion_page_id: 'ts',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 3, // Explicit sort_order
    });
    const section = makeBasePage({
      notion_page_id: 'section',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0, // Explicit sort_order
    });

    scope.child_scope_ids = ['art'];
    art.child_article_ids = ['sec'];
    sec.child_section_and_primary_doc_ids = ['core', 'adc', 'ts', 'section'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec, core, adc, ts, section],
    };
    const numbers = generateDocumentNumbers(pages);

    // Should be ordered by sort_order, then by document type priority
    expect(numbers.get('section')).toBe('A.0.1.1.1'); // sort_order: 0
    expect(numbers.get('adc')).toBe('A.0.1.1.2'); // sort_order: 1
    expect(numbers.get('core')).toBe('A.0.1.1.3'); // sort_order: 2
    expect(numbers.get('ts')).toBe('A.0.1.1.4'); // sort_order: 3
  });

  it('Sections & Primary Docs: all document types as siblings without sort_order', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });

    // Create all 4 document types as siblings under the section (no sort_order)
    const core = makeBasePage({
      notion_page_id: 'core',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const adc = makeBasePage({
      notion_page_id: 'adc',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const ts = makeBasePage({
      notion_page_id: 'ts',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const section = makeBasePage({
      notion_page_id: 'section',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });

    scope.child_scope_ids = ['art'];
    art.child_article_ids = ['sec'];
    sec.child_section_and_primary_doc_ids = ['core', 'adc', 'ts', 'section'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec, core, adc, ts, section],
    };
    const numbers = generateDocumentNumbers(pages);

    // Should be ordered by document type priority: Core(1), Active Data Controller(2), Type Specification(3), Section(4)
    expect(numbers.get('core')).toBe('A.0.1.1.1'); // Core priority: 1
    expect(numbers.get('adc')).toBe('A.0.1.1.2'); // Active Data Controller priority: 2
    expect(numbers.get('ts')).toBe('A.0.1.1.3'); // Type Specification priority: 3
    expect(numbers.get('section')).toBe('A.0.1.1.4'); // Section priority: 4
  });

  it('Sections & Primary Docs: multiple instances of each document type as siblings', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });

    // Create multiple instances of each document type
    const core1 = makeBasePage({
      notion_page_id: 'core1',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const core2 = makeBasePage({
      notion_page_id: 'core2',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const adc1 = makeBasePage({
      notion_page_id: 'adc1',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const adc2 = makeBasePage({
      notion_page_id: 'adc2',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const ts1 = makeBasePage({
      notion_page_id: 'ts1',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const ts2 = makeBasePage({
      notion_page_id: 'ts2',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const section1 = makeBasePage({
      notion_page_id: 'section1',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });
    const section2 = makeBasePage({
      notion_page_id: 'section2',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });

    scope.child_scope_ids = ['art'];
    art.child_article_ids = ['sec'];
    sec.child_section_and_primary_doc_ids = ['core1', 'adc1', 'ts1', 'section1', 'core2', 'adc2', 'ts2', 'section2'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec, core1, adc1, ts1, section1, core2, adc2, ts2, section2],
    };
    const numbers = generateDocumentNumbers(pages);

    // Should be ordered by document type priority, then by document number as fallback
    expect(numbers.get('core1')).toBe('A.0.1.1.1'); // Core priority: 1
    expect(numbers.get('core2')).toBe('A.0.1.1.2'); // Core priority: 1, second
    expect(numbers.get('adc1')).toBe('A.0.1.1.3'); // Active Data Controller priority: 2
    expect(numbers.get('adc2')).toBe('A.0.1.1.4'); // Active Data Controller priority: 2, second
    expect(numbers.get('ts1')).toBe('A.0.1.1.5'); // Type Specification priority: 3
    expect(numbers.get('ts2')).toBe('A.0.1.1.6'); // Type Specification priority: 3, second
    expect(numbers.get('section1')).toBe('A.0.1.1.7'); // Section priority: 4
    expect(numbers.get('section2')).toBe('A.0.1.1.8'); // Section priority: 4, second
  });

  it('Sections & Primary Docs: complex mixed scenario with explicit and implicit ordering', () => {
    const scope = makeBasePage({
      notion_page_id: 'scope',
      atlas_document_type: 'Scope',
      atlas_database_name: 'Scopes',
    });
    const art = makeBasePage({
      notion_page_id: 'art',
      atlas_document_type: 'Article',
      atlas_database_name: 'Articles',
    });
    const sec = makeBasePage({
      notion_page_id: 'sec',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
    });

    // Mix of explicit sort_order and implicit ordering
    const core1 = makeBasePage({
      notion_page_id: 'core1',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 2, // Explicit
    });
    const core2 = makeBasePage({
      notion_page_id: 'core2',
      atlas_document_type: 'Core',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order
    });
    const adc1 = makeBasePage({
      notion_page_id: 'adc1',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 1, // Explicit
    });
    const adc2 = makeBasePage({
      notion_page_id: 'adc2',
      atlas_document_type: 'Active Data Controller',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order
    });
    const ts1 = makeBasePage({
      notion_page_id: 'ts1',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 3, // Explicit
    });
    const ts2 = makeBasePage({
      notion_page_id: 'ts2',
      atlas_document_type: 'Type Specification',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order
    });
    const section1 = makeBasePage({
      notion_page_id: 'section1',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
      sort_order: 0, // Explicit
    });
    const section2 = makeBasePage({
      notion_page_id: 'section2',
      atlas_document_type: 'Section',
      atlas_database_name: 'Sections & Primary Docs',
      // No sort_order
    });

    scope.child_scope_ids = ['art'];
    art.child_article_ids = ['sec'];
    sec.child_section_and_primary_doc_ids = ['core1', 'adc1', 'ts1', 'section1', 'core2', 'adc2', 'ts2', 'section2'];

    const pages = {
      Scopes: [scope],
      Articles: [art],
      'Sections & Primary Docs': [sec, core1, adc1, ts1, section1, core2, adc2, ts2, section2],
    };
    const numbers = generateDocumentNumbers(pages);

    // Explicit sort_order first, then document type priority for those without sort_order
    expect(numbers.get('section1')).toBe('A.0.1.1.1'); // sort_order: 0
    expect(numbers.get('adc1')).toBe('A.0.1.1.2'); // sort_order: 1
    expect(numbers.get('core1')).toBe('A.0.1.1.3'); // sort_order: 2
    expect(numbers.get('ts1')).toBe('A.0.1.1.4'); // sort_order: 3
    expect(numbers.get('core2')).toBe('A.0.1.1.5'); // no sort_order, Core priority
    expect(numbers.get('adc2')).toBe('A.0.1.1.6'); // no sort_order, Active Data Controller priority
    expect(numbers.get('ts2')).toBe('A.0.1.1.7'); // no sort_order, Type Specification priority
    expect(numbers.get('section2')).toBe('A.0.1.1.8'); // no sort_order, Section priority
  });
});
