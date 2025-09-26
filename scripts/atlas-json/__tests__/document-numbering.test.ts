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
    // Per-type numbering: Active Data Controller starts atification 1 under the same parent
    expect(numbers.get('adc')).toBe('A.0.1.1.1');
    // Per-type numbering: Type Specification starts at 1 under the same parent
    expect(numbers.get('ts')).toBe('A.0.1.1.1');

    // Also verify direct generators produce matching formats when parentNumber provided
    const hierarchy = buildDocumentHierarchy(Object.values(pages).flat());
    const map = new Map<string, string>(Array.from(numbers.entries()));
    expect(generateCoreNumber(core1, hierarchy, map)).toBe('A.0.1.1.1');
    expect(generateActiveDataControllerNumber(adc, hierarchy, map)).toBe('A.0.1.1.1');
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
});
