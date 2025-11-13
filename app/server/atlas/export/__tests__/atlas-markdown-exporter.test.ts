import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../../notion-mapping/notion-database-properties-and-relationships';
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
    // New format: **Label**: followed by newline, then value, then blank line (except last field)
    expect(md).toContain(
      `**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_doc_identifier_rules}**:\n\nDoc ID rules\n\n`,
    );
    expect(md).toContain(`**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_additional_logic}**:\n\n\n\n`);
    expect(md).toContain(
      `**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_type_category}**:\n\nCategory X\n\n`,
    );
    expect(md).toContain(`**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_type_name}**:\n\nSpecName\n\n`);
    // Last field doesn't have trailing blank line
    expect(md).toContain(
      `**${TYPE_SPECIFICATION_PROPERTY_MAPPING.type_specification_type_overview}**:\n\nOverview here`,
    );
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
    // New format: **Label**: followed by newline, then value, then blank line (except last field)
    expect(md).toContain(`**${SCENARIO_PROPERTY_MAPPING.scenario_finding}**:\n\nKey finding\n\n`);
    // Last field doesn't have trailing blank line
    expect(md).toContain(`**${SCENARIO_PROPERTY_MAPPING.scenario_additional_guidance}**:\n\nSome guidance`);
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
    // New format: **Label**: followed by newline, then value, then blank line (except last field)
    expect(md).toContain(
      `**${SCENARIO_VARIATION_PROPERTY_MAPPING.scenario_variation_finding}**:\n\nVariant finding\n\n`,
    );
    // Last field doesn't have trailing blank line
    expect(md).toContain(
      `**${SCENARIO_VARIATION_PROPERTY_MAPPING.scenario_variation_additional_guidance}**:\n\nVariant guidance`,
    );
  });

  it('caps heading levels at 6 for deeply nested documents', async () => {
    // Create a deeply nested Core document at depth 8
    const deeplyNested: SectionsAndPrimaryDocsDocument = {
      type: 'Core',
      doc_no: 'A.1.2.3.4.5.6.7.8', // Depth 8
      name: 'Deeply Nested Core',
      uuid: '00000000-0000-0000-0000-000000000040',
      last_modified: '2025-01-05T00:00:00Z',
      content: 'Content at depth 8',
      sections_and_primary_docs: [],
      annotations: [],
      tenets: [],
      active_data: [],
      needed_research: [],
    };

    buildAtlasJSONMock().mockResolvedValueOnce([deeplyNested]);

    const md = await buildAtlasMarkdown();

    // Should use 6 hashtags (######) even though depth is 8
    expect(md).toContain('###### A.1.2.3.4.5.6.7.8 - Deeply Nested Core [Core]');
    expect(md).not.toContain('######## '); // Should not have 8 hashtags
  });

  it('uses correct heading levels for documents at depth 1-6', async () => {
    const scope: ArticlesDocument = {
      type: 'Article', // Depth 2
      doc_no: 'A.1.2',
      name: 'Test Article',
      uuid: '00000000-0000-0000-0000-000000000050',
      last_modified: '2025-01-06T00:00:00Z',
      content: 'Article at depth 2',
      sections_and_primary_docs: [],
      annotations: [],
      needed_research: [],
    };

    buildAtlasJSONMock().mockResolvedValueOnce([scope]);

    const md = await buildAtlasMarkdown();

    // Depth 2 should use ## (2 hashtags)
    expect(md).toContain('## A.1.2 - Test Article [Article]');
  });

  it('handles multiple documents at depth 7+ all with 6 hashtags', async () => {
    const doc1: SectionsAndPrimaryDocsDocument = {
      type: 'Core',
      doc_no: 'A.1.2.3.4.5.6.7', // Depth 7
      name: 'First Deep Doc',
      uuid: '00000000-0000-0000-0000-000000000060',
      last_modified: '2025-01-07T00:00:00Z',
      content: 'First doc at depth 7',
      sections_and_primary_docs: [],
      annotations: [],
      tenets: [],
      active_data: [],
      needed_research: [],
    };

    const doc2: SectionsAndPrimaryDocsDocument = {
      type: 'Core',
      doc_no: 'A.1.2.3.4.5.6.7.8', // Depth 8
      name: 'Second Deep Doc',
      uuid: '00000000-0000-0000-0000-000000000061',
      last_modified: '2025-01-07T00:00:00Z',
      content: 'Second doc at depth 8',
      sections_and_primary_docs: [],
      annotations: [],
      tenets: [],
      active_data: [],
      needed_research: [],
    };

    // Put doc2 as child of doc1
    doc1.sections_and_primary_docs.push(doc2);

    buildAtlasJSONMock().mockResolvedValueOnce([doc1]);

    const md = await buildAtlasMarkdown();

    // Both should use 6 hashtags
    expect(md).toContain('###### A.1.2.3.4.5.6.7 - First Deep Doc [Core]');
    expect(md).toContain('###### A.1.2.3.4.5.6.7.8 - Second Deep Doc [Core]');
  });

  it('exports Needed Research with correct heading levels based on parent', async () => {
    const core: SectionsAndPrimaryDocsDocument = {
      type: 'Core',
      doc_no: 'A.1.2.3.4', // Depth 4
      name: 'Test Core',
      uuid: '00000000-0000-0000-0000-000000000070',
      last_modified: '2025-01-08T00:00:00Z',
      content: 'Core content',
      sections_and_primary_docs: [],
      annotations: [],
      tenets: [],
      active_data: [],
      needed_research: [
        {
          type: 'Needed Research',
          doc_no: 'NR-1',
          name: 'Research Item',
          uuid: '00000000-0000-0000-0000-000000000071',
          last_modified: '2025-01-08T00:00:00Z',
          content: 'Research content',
          needed_research_content: 'What needs research?',
        },
      ],
    };

    buildAtlasJSONMock().mockResolvedValueOnce([core]);

    const md = await buildAtlasMarkdown();

    // Core at depth 4 should use ####
    expect(md).toContain('#### A.1.2.3.4 - Test Core [Core]');
    // Needed Research should use ##### (parent depth + 1)
    expect(md).toContain('##### NR-1 - Research Item [Needed Research]');
  });

  it('exports Needed Research at depth > 6 with capped heading level', async () => {
    const deepCore: SectionsAndPrimaryDocsDocument = {
      type: 'Core',
      doc_no: 'A.1.2.3.4.5.6', // Depth 6
      name: 'Deep Core',
      uuid: '00000000-0000-0000-0000-000000000080',
      last_modified: '2025-01-09T00:00:00Z',
      content: 'Deep content',
      sections_and_primary_docs: [],
      annotations: [],
      tenets: [],
      active_data: [],
      needed_research: [
        {
          type: 'Needed Research',
          doc_no: 'NR-5',
          name: 'Deep Research',
          uuid: '00000000-0000-0000-0000-000000000081',
          last_modified: '2025-01-09T00:00:00Z',
          content: 'Research at depth 7',
          needed_research_content: 'Deep question?',
        },
      ],
    };

    buildAtlasJSONMock().mockResolvedValueOnce([deepCore]);

    const md = await buildAtlasMarkdown();

    // Core at depth 6 should use ######
    expect(md).toContain('###### A.1.2.3.4.5.6 - Deep Core [Core]');
    // Needed Research at depth 7 should be capped at ######
    expect(md).toContain('###### NR-5 - Deep Research [Needed Research]');
  });

  it('exports Annotations with correct depth calculation (regression test for inferDocumentType)', async () => {
    // This tests the fix for the bug where A.0.1.2.1.1 was incorrectly identified as Scenario
    // because it ended with .1.1, matching the pattern /\.1\.\d+$/
    const core: SectionsAndPrimaryDocsDocument = {
      type: 'Core',
      doc_no: 'A.0.1.2.1.1', // Depth 5 (ends with .1.1, should NOT be confused with Scenario)
      name: 'Authorization Core',
      uuid: '00000000-0000-0000-0000-000000000090',
      last_modified: '2025-01-10T00:00:00Z',
      content: 'Core content',
      sections_and_primary_docs: [],
      annotations: [
        {
          type: 'Annotation',
          doc_no: 'A.0.1.2.1.1.0.3.1', // Depth 6 (parent 5 + 1)
          name: 'Element Annotation',
          uuid: '00000000-0000-0000-0000-000000000091',
          last_modified: '2025-01-10T00:00:00Z',
          content: 'Annotation content',
          needed_research: [],
        },
      ],
      tenets: [],
      active_data: [],
      needed_research: [],
    };

    buildAtlasJSONMock().mockResolvedValueOnce([core]);

    const md = await buildAtlasMarkdown();

    // Core at depth 5 should use #####
    expect(md).toContain('##### A.0.1.2.1.1 - Authorization Core [Core]');
    // Annotation at depth 6 should use ######
    expect(md).toContain('###### A.0.1.2.1.1.0.3.1 - Element Annotation [Annotation]');

    // Ensure child has MORE hashtags than parent
    const coreMatch = md.match(/(#{1,6}) A\.0\.1\.2\.1\.1 - Authorization Core/);
    const annotationMatch = md.match(/(#{1,6}) A\.0\.1\.2\.1\.1\.0\.3\.1 - Element Annotation/);

    expect(coreMatch).not.toBeNull();
    expect(annotationMatch).not.toBeNull();

    const coreHashtags = coreMatch![1].length;
    const annotationHashtags = annotationMatch![1].length;

    expect(annotationHashtags).toBeGreaterThan(coreHashtags);
    expect(coreHashtags).toBe(5);
    expect(annotationHashtags).toBe(6);
  });
});
