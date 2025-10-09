import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import {
  type ScenarioExtraFields,
  type ScenarioVariationExtraFields,
  type TypeSpecificationExtraFields,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
import { type Json } from '@/app/server/services/supabase/database.types';
import { atlasNodeToStandardized } from '../atlas-node-tree-to-standardized-atlas-node-tree';
import {
  type ActiveDataDocument,
  type AgentScopeDatabaseDocument,
  type ArticlesDocument,
  type ScenarioVariationsDocument,
  type ScenariosDocument,
  type ScopesDocument,
  type SectionsAndPrimaryDocsDocument,
  type TenetsDocument,
  extraFieldsByDocumentType,
} from '../types';
import { loadUuidMappings, UuidMappings } from '../../load-uuid-mapping';

vi.mock('../atlas-rich-text-formatter', () => ({
  atlasDatabasePageToMarkdown: vi.fn().mockImplementation((node: AtlasTreeNode) => `# ${node.plain_text_name ?? ''}`),
}));

function makeNode(overrides: Partial<AtlasTreeNode> = {}): AtlasTreeNode {
  const now = '2025-01-01T00:00:00.000Z';
  return {
    notion_page_id: overrides.notion_page_id ?? cryptoRandomId(),
    canonical_document_title: overrides.canonical_document_title ?? null,
    atlas_document_type: overrides.atlas_document_type ?? 'Section',
    atlas_document_number: overrides.atlas_document_number ?? 'A.1',
    atlas_document_number_sortable: overrides.atlas_document_number_sortable ?? undefined,
    atlas_database_name: overrides.atlas_database_name ?? ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
    has_children: overrides.has_children ?? false,
    archived: overrides.archived ?? false,
    in_trash: overrides.in_trash ?? false,
    last_edited_by_user_id: overrides.last_edited_by_user_id ?? null,
    plain_text_name: overrides.plain_text_name ?? 'Name',
    json_name: overrides.json_name ?? null,
    plain_text_content: overrides.plain_text_content ?? '',
    json_content: overrides.json_content ?? null,
    parent_notion_page_id: overrides.parent_notion_page_id ?? null,
    extra_fields: overrides.extra_fields ?? {},
    sort_order: overrides.sort_order ?? 0,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    date_valid_from: overrides.date_valid_from ?? null,
    date_valid_to: overrides.date_valid_to ?? null,
    generatedDocID: overrides.generatedDocID,
    generatedDocName: overrides.generatedDocName,
    scopes: overrides.scopes ?? [],
    articles: overrides.articles ?? [],
    sectionsAndPrimaryDocs: overrides.sectionsAndPrimaryDocs ?? [],
    annotations: overrides.annotations ?? [],
    tenets: overrides.tenets ?? [],
    scenarios: overrides.scenarios ?? [],
    scenarioVariations: overrides.scenarioVariations ?? [],
    activeData: overrides.activeData ?? [],
    agentScopeDocs: overrides.agentScopeDocs ?? [],
    neededResearch: overrides.neededResearch ?? [],
  };
}

function cryptoRandomId(): string {
  // simple deterministic-ish stub that's unique enough for tests
  return '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
}

describe('atlasNodeToStandardized', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let uuidMappings: UuidMappings;
  
  beforeEach(async () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    uuidMappings = await loadUuidMappings();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('maps base fields and prefers generatedDocID/name over originals', () => {
    const node = makeNode({
      atlas_database_name: ATLAS_DATABASES.ARTICLES,
      atlas_document_type: 'Article',
      atlas_document_number: 'A.2',
      plain_text_name: 'Original Name',
      generatedDocID: 'GEN.1',
      generatedDocName: 'Generated Name',
    });

    const result = atlasNodeToStandardized(node, uuidMappings);
    expect(result.type).toBe('Article');
    expect(result.doc_no).toBe('GEN.1');
    expect(result.name).toBe('Generated Name');
    expect(result.uuid).toBe(node.notion_page_id);
    expect(result.last_modified).toBe(node.updated_at);
    expect(result.content).toContain('Generated Name');
  });

  it('preserves child order', () => {
    const child1 = makeNode({
      atlas_database_name: ATLAS_DATABASES.ARTICLES,
      atlas_document_type: 'Article',
      generatedDocName: '1',
    });
    const child2 = makeNode({
      atlas_database_name: ATLAS_DATABASES.ARTICLES,
      atlas_document_type: 'Article',
      generatedDocName: '2',
    });
    const root = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCOPES,
      atlas_document_type: 'Scope',
      articles: [child1, child2],
    });
    const result = atlasNodeToStandardized(root, uuidMappings) as ScopesDocument;
    expect(result.type).toBe('Scope');
    expect(result.articles[0].name).toBe('1');
    expect(result.articles[1].name).toBe('2');
  });

  it('Scopes → Articles', () => {
    const art = makeNode({
      atlas_database_name: ATLAS_DATABASES.ARTICLES,
      atlas_document_type: 'Article',
      generatedDocName: 'Art',
    });
    const scope = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCOPES,
      atlas_document_type: 'Scope',
      articles: [art],
    });
    const result = atlasNodeToStandardized(scope, uuidMappings) as ScopesDocument;
    expect(result).toHaveProperty('articles');
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].type).toBe('Article');
  });

  it('Articles → Sections & Primary Docs, Annotations, Needed Research (agent scope excluded at this level)', () => {
    const sec = makeNode({
      atlas_database_name: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
      atlas_document_type: 'Section',
    });
    const ann = makeNode({ atlas_database_name: ATLAS_DATABASES.ANNOTATIONS, atlas_document_type: 'Annotation' });
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });
    const agent = makeNode({ atlas_database_name: ATLAS_DATABASES.AGENTS, atlas_document_type: 'Core' });
    const art = makeNode({
      atlas_database_name: ATLAS_DATABASES.ARTICLES,
      atlas_document_type: 'Article',
      sectionsAndPrimaryDocs: [sec],
      annotations: [ann],
      neededResearch: [nr],
      agentScopeDocs: [agent],
    });
    const result = atlasNodeToStandardized(art, uuidMappings) as ArticlesDocument;
    expect(result).toHaveProperty('sections_and_primary_docs');
    expect(result).toHaveProperty('annotations');
    expect(result).toHaveProperty('needed_research');
    expect(result).not.toHaveProperty('agent_scope_database');
  });

  it('Sections & Primary Docs → nested + agent scope present only when non-empty + extra fields for Type Specification', () => {
    const nested = makeNode({
      atlas_database_name: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
      atlas_document_type: 'Core',
    });
    const agent = makeNode({ atlas_database_name: ATLAS_DATABASES.AGENTS, atlas_document_type: 'Core' });
    const ann = makeNode({ atlas_database_name: ATLAS_DATABASES.ANNOTATIONS, atlas_document_type: 'Annotation' });
    const tenet = makeNode({ atlas_database_name: ATLAS_DATABASES.TENETS, atlas_document_type: 'Action Tenet' });
    const ad = makeNode({ atlas_database_name: ATLAS_DATABASES.ACTIVE_DATA, atlas_document_type: 'Active Data' });
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });

    const typeSpec = makeNode({
      atlas_database_name: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
      atlas_document_type: 'Type Specification',
      sectionsAndPrimaryDocs: [nested],
      agentScopeDocs: [agent],
      annotations: [ann],
      tenets: [tenet],
      activeData: [ad],
      neededResearch: [nr],
      extra_fields: { type_specification_type_name: 'T', unknown_prop: 'x' },
    });
    const result = atlasNodeToStandardized(typeSpec, uuidMappings) as SectionsAndPrimaryDocsDocument;
    expect(result.sections_and_primary_docs).toHaveLength(1);
    expect(result.annotations).toHaveLength(1);
    expect(result.tenets).toHaveLength(1);
    expect(result.active_data).toHaveLength(1);
    expect(result.needed_research).toHaveLength(1);
    expect(result.agent_scope_database).toHaveLength(1);
    expect(result.type_specification_type_name).toBeDefined();
    expect('unknown_prop' in (result as object)).toBe(false);
  });

  it('Tenets → Scenarios (+ Needed Research)', () => {
    const scen = makeNode({ atlas_database_name: ATLAS_DATABASES.SCENARIOS, atlas_document_type: 'Scenario' });
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });
    const tenet = makeNode({
      atlas_database_name: ATLAS_DATABASES.TENETS,
      atlas_document_type: 'Action Tenet',
      scenarios: [scen],
      neededResearch: [nr],
    });
    const result = atlasNodeToStandardized(tenet, uuidMappings) as TenetsDocument;
    expect(result.scenarios).toHaveLength(1);
    expect(result.needed_research).toHaveLength(1);
  });

  it('Scenarios → Scenario Variations (+ Needed Research) with extra fields', () => {
    const sv = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCENARIO_VARIATIONS,
      atlas_document_type: 'Scenario Variation',
    });
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });
    const scen = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCENARIOS,
      atlas_document_type: 'Scenario',
      scenarioVariations: [sv],
      neededResearch: [nr],
      extra_fields: { scenario_finding: 'S', unknown: 1 },
    });
    const result = atlasNodeToStandardized(scen, uuidMappings) as ScenariosDocument;
    expect(result.scenario_variations).toHaveLength(1);
    expect(result.needed_research).toHaveLength(1);
    expect(result.scenario_finding).toBeDefined();
    expect('unknown' in (result as object)).toBe(false);
  });

  it('Scenario Variations → leaf with extra fields (+ Needed Research)', () => {
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });
    const sv = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCENARIO_VARIATIONS,
      atlas_document_type: 'Scenario Variation',
      neededResearch: [nr],
      extra_fields: { scenario_variation_finding: 'SV', bogus: true },
    });
    const result = atlasNodeToStandardized(sv, uuidMappings) as ScenarioVariationsDocument;
    expect(result.needed_research).toHaveLength(1);
    expect(result.scenario_variation_finding).toBeDefined();
    expect('bogus' in (result as object)).toBe(false);
  });

  it('includes all extra fields for Type Specification documents', () => {
    const allKeys = (extraFieldsByDocumentType['Type Specification'] ?? []) as (keyof TypeSpecificationExtraFields)[];
    const extra = Object.fromEntries(allKeys.map((k) => [k, `val-${k}`])) as unknown as Json;
    const node = makeNode({
      atlas_database_name: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
      atlas_document_type: 'Type Specification',
      extra_fields: extra,
    });
    const result = atlasNodeToStandardized(node, uuidMappings);
    for (const key of allKeys) {
      const got = (result as unknown as Record<string, unknown>)[key as string];
      expect(got).toBe(`val-${key}`);
    }
  });

  it('includes all extra fields for Scenario documents', () => {
    const allKeys = (extraFieldsByDocumentType['Scenario'] ?? []) as (keyof ScenarioExtraFields)[];
    const extra = Object.fromEntries(allKeys.map((k) => [k, `val-${k}`])) as unknown as Json;
    const node = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCENARIOS,
      atlas_document_type: 'Scenario',
      extra_fields: extra,
    });
    const result = atlasNodeToStandardized(node, uuidMappings);
    for (const key of allKeys) {
      const got = (result as unknown as Record<string, unknown>)[key as string];
      expect(got).toBe(`val-${key}`);
    }
  });

  it('includes all extra fields for Scenario Variation documents', () => {
    const allKeys = (extraFieldsByDocumentType['Scenario Variation'] ?? []) as (keyof ScenarioVariationExtraFields)[];
    const extra = Object.fromEntries(allKeys.map((k) => [k, `val-${k}`])) as unknown as Json;
    const node = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCENARIO_VARIATIONS,
      atlas_document_type: 'Scenario Variation',
      extra_fields: extra,
    });
    const result = atlasNodeToStandardized(node, uuidMappings);
    for (const key of allKeys) {
      const got = (result as unknown as Record<string, unknown>)[key as string];
      expect(got).toBe(`val-${key}`);
    }
  });

  it('Active Data → leaf (+ Needed Research)', () => {
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });
    const ad = makeNode({
      atlas_database_name: ATLAS_DATABASES.ACTIVE_DATA,
      atlas_document_type: 'Active Data',
      neededResearch: [nr],
    });
    const result = atlasNodeToStandardized(ad, uuidMappings) as ActiveDataDocument;
    expect(result.needed_research).toHaveLength(1);
  });

  it('Agent Scope Database → nested, annotations, tenets, active data (+ Needed Research)', () => {
    const nested = makeNode({ atlas_database_name: ATLAS_DATABASES.AGENTS, atlas_document_type: 'Core' });
    const ann = makeNode({ atlas_database_name: ATLAS_DATABASES.ANNOTATIONS, atlas_document_type: 'Annotation' });
    const ten = makeNode({ atlas_database_name: ATLAS_DATABASES.TENETS, atlas_document_type: 'Action Tenet' });
    const ad = makeNode({ atlas_database_name: ATLAS_DATABASES.ACTIVE_DATA, atlas_document_type: 'Active Data' });
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });
    const agentRoot = makeNode({
      atlas_database_name: ATLAS_DATABASES.AGENTS,
      atlas_document_type: 'Core',
      agentScopeDocs: [nested],
      annotations: [ann],
      tenets: [ten],
      activeData: [ad],
      neededResearch: [nr],
    });
    const result = atlasNodeToStandardized(agentRoot, uuidMappings) as AgentScopeDatabaseDocument;
    expect(result.agent_scope_database).toHaveLength(1);
    expect(result.annotations).toHaveLength(1);
    expect(result.tenets).toHaveLength(1);
    expect(result.active_data).toHaveLength(1);
    expect(result.needed_research).toHaveLength(1);
  });

  it('Needed Research → leaf', () => {
    const nr = makeNode({
      atlas_database_name: ATLAS_DATABASES.NEEDED_RESEARCH,
      atlas_document_type: 'Needed Research',
    });
    const result = atlasNodeToStandardized(nr, uuidMappings);
    // no child arrays on type interface beyond base
    expect(Object.keys(result)).not.toContain('articles');
  });

  it('omitAgents option prunes agent roots (keeps base only)', async () => {
    const { AGENT_ROOT_SECTION_UUIDS } = await import('@/app/server/atlas/constants');
    const agentRootId = Array.from(AGENT_ROOT_SECTION_UUIDS)[0];
    const child = makeNode({ atlas_database_name: ATLAS_DATABASES.AGENTS, atlas_document_type: 'Core' });
    const agentRoot = makeNode({
      atlas_database_name: ATLAS_DATABASES.AGENTS,
      atlas_document_type: 'Core',
      notion_page_id: agentRootId,
      agentScopeDocs: [child],
    });
    const result = atlasNodeToStandardized(agentRoot, uuidMappings, { omitAgents: true });
    expect(result.type).toBe('Core');
    expect('agent_scope_database' in (result as object)).toBe(false);
  });

  it('unknown database falls back to base only and logs error', () => {
    const node = makeNode({
      atlas_database_name: 'Unknown' as unknown as (typeof ATLAS_DATABASES)[keyof typeof ATLAS_DATABASES],
    });
    const result = atlasNodeToStandardized(node, uuidMappings);
    expect(errorSpy).toHaveBeenCalled();
    expect('articles' in (result as object)).toBe(false);
  });

  it('logs warnings for invalid child databases but does not throw', () => {
    const badChild = makeNode({ atlas_database_name: ATLAS_DATABASES.ACTIVE_DATA, atlas_document_type: 'Active Data' });
    const scope = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCOPES,
      atlas_document_type: 'Scope',
      activeData: [badChild],
    });
    const result = atlasNodeToStandardized(scope, uuidMappings);
    expect(result.type).toBe('Scope');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('includes all extra fields for Type Specification documents', () => {
    const allKeys = (extraFieldsByDocumentType['Type Specification'] ?? []) as (keyof TypeSpecificationExtraFields)[];
    const extra = Object.fromEntries(allKeys.map((k) => [k, `val-${String(k)}`])) as unknown as Json;
    const node = makeNode({
      atlas_database_name: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
      atlas_document_type: 'Type Specification',
      extra_fields: extra,
    });
    const result = atlasNodeToStandardized(node, uuidMappings) as SectionsAndPrimaryDocsDocument;
    for (const key of allKeys) {
      const got = (result as unknown as Record<string, unknown>)[key as string];
      expect(got).toBe(`val-${String(key)}`);
    }
  });

  it('includes all extra fields for Scenario documents', () => {
    const allKeys = (extraFieldsByDocumentType['Scenario'] ?? []) as (keyof ScenarioExtraFields)[];
    const extra = Object.fromEntries(allKeys.map((k) => [k, `val-${String(k)}`])) as unknown as Json;
    const node = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCENARIOS,
      atlas_document_type: 'Scenario',
      extra_fields: extra,
    });
    const result = atlasNodeToStandardized(node, uuidMappings) as ScenariosDocument;
    for (const key of allKeys) {
      const got = (result as unknown as Record<string, unknown>)[key as string];
      expect(got).toBe(`val-${String(key)}`);
    }
  });

  it('includes all extra fields for Scenario Variation documents', () => {
    const allKeys = (extraFieldsByDocumentType['Scenario Variation'] ?? []) as (keyof ScenarioVariationExtraFields)[];
    const extra = Object.fromEntries(allKeys.map((k) => [k, `val-${String(k)}`])) as unknown as Json;
    const node = makeNode({
      atlas_database_name: ATLAS_DATABASES.SCENARIO_VARIATIONS,
      atlas_document_type: 'Scenario Variation',
      extra_fields: extra,
    });
    const result = atlasNodeToStandardized(node, uuidMappings) as ScenarioVariationsDocument;
    for (const key of allKeys) {
      const got = (result as unknown as Record<string, unknown>)[key as string];
      expect(got).toBe(`val-${String(key)}`);
    }
  });
});
