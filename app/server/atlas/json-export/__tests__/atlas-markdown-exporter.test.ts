import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../../notion-database-properties-and-relationships';
import { buildAtlasJSON } from '../atlas-json-exporter';
import { buildAtlasMarkdown } from '../atlas-markdown-exporter';
import type {
  ArticlesDocument,
  ScenarioVariationsDocument,
  ScenariosDocument,
  SectionsAndPrimaryDocsDocument,
  StandardizedAtlasScopeTrees,
} from '../types';

vi.mock('../atlas-json-exporter', () => ({
  buildAtlasJSON: vi.fn(),
}));

const buildAtlasJSONMock = () => vi.mocked(buildAtlasJSON as unknown as () => Promise<StandardizedAtlasScopeTrees>);

describe('atlas-markdown-exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates basic markdown for simple documents', async () => {
    const basicArticle: ArticlesDocument = {
      type: 'Article',
      doc_no: 'A.1.2',
      name: 'An Article',
      uuid: '00000000-0000-0000-0000-000000000001',
      last_modified: '2025-01-01T00:00:00Z',
      content: 'Article body',
      sections_and_primary_docs: [],
      annotations: [],
      needed_research: [],
    };

    buildAtlasJSONMock().mockResolvedValueOnce([basicArticle]);

    const md = await buildAtlasMarkdown();

    expect(md).toContain('# A.1.2 - An Article [Article]');
    expect(md).toContain('Article body');
    expect(md).toContain('<!-- UUID: 00000000-0000-0000-0000-000000000001 -->');
  });

  it('includes extra fields for Type Specification', async () => {
    const typeSpec: SectionsAndPrimaryDocsDocument = {
      type: 'Type Specification',
      doc_no: 'A.1.1.3.1',
      name: 'Spec: Example',
      uuid: '00000000-0000-0000-0000-000000000010',
      last_modified: '2025-01-02T00:00:00Z',
      content: 'Type spec content',
      // child collections
      sections_and_primary_docs: [],
      annotations: [],
      tenets: [],
      active_data: [],
      needed_research: [],
      // extra fields
      type_specification_doc_identifier_rules: 'Doc ID rules',
      type_specification_additional_logic: null,
      type_specification_type_category: 'Category X',
      type_specification_type_name: 'SpecName',
      type_specification_type_overview: 'Overview here',
    };

    buildAtlasJSONMock().mockResolvedValueOnce([typeSpec]);

    const md = await buildAtlasMarkdown();

    // Title and UUID
    expect(md).toContain('# A.1.1.3.1 - Spec: Example [Type Specification]');
    expect(md).toContain('<!-- UUID: 00000000-0000-0000-0000-000000000010 -->');

    // Extra fields (labels come from TYPE_SPECIFICATION_PROPERTY_MAPPING)
    expect(md).toContain(
      `**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_doc_identifier_rules}**: Doc ID rules`,
    );
    expect(md).toContain(`**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_additional_logic}**: `);
    expect(md).toContain(`**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_type_category}**: Category X`);
    expect(md).toContain(`**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_type_name}**: SpecName`);
    expect(md).toContain(`**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_type_overview}**: Overview here`);
  });

  it('includes extra fields for Scenario', async () => {
    const scenario: ScenariosDocument = {
      type: 'Scenario',
      doc_no: 'A.1.1.4.1',
      name: 'Scenario Alpha',
      uuid: '00000000-0000-0000-0000-000000000020',
      last_modified: '2025-01-03T00:00:00Z',
      content: 'Scenario description',
      scenario_variations: [],
      needed_research: [],
      // extra fields
      scenario_finding: 'Key finding',
      scenario_additional_guidance: 'Some guidance',
    };

    buildAtlasJSONMock().mockResolvedValueOnce([scenario]);

    const md = await buildAtlasMarkdown();

    expect(md).toContain('# A.1.1.4.1 - Scenario Alpha [Scenario]');
    expect(md).toContain('<!-- UUID: 00000000-0000-0000-0000-000000000020 -->');
    expect(md).toContain(`**${SCENARIO_PROPERTY_MAPPING.scenario_finding}**: Key finding`);
    expect(md).toContain(`**${SCENARIO_PROPERTY_MAPPING.scenario_additional_guidance}**: Some guidance`);
  });

  it('includes extra fields for Scenario Variation', async () => {
    const variation: ScenarioVariationsDocument = {
      type: 'Scenario Variation',
      doc_no: 'A.1.1.4.1.var1',
      name: 'Scenario Alpha - Variant 1',
      uuid: '00000000-0000-0000-0000-000000000030',
      last_modified: '2025-01-04T00:00:00Z',
      content: 'Variation description',
      needed_research: [],
      // extra fields
      scenario_variation_finding: 'Variant finding',
      scenario_variation_additional_guidance: 'Variant guidance',
    };

    buildAtlasJSONMock().mockResolvedValueOnce([variation]);

    const md = await buildAtlasMarkdown();

    expect(md).toContain('# A.1.1.4.1.var1 - Scenario Alpha - Variant 1 [Scenario Variation]');
    expect(md).toContain('<!-- UUID: 00000000-0000-0000-0000-000000000030 -->');
    expect(md).toContain(`**${SCENARIO_VARIATION_PROPERTY_MAPPING.scenario_variation_finding}**: Variant finding`);
    expect(md).toContain(
      `**${SCENARIO_VARIATION_PROPERTY_MAPPING.scenario_variation_additional_guidance}**: Variant guidance`,
    );
  });
});
