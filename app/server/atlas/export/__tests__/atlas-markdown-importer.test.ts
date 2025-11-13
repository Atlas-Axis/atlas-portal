import { describe, expect, it } from 'vitest';
import { AGENT_ROOT_SECTION_UUIDS_MAPPED, AGENT_ROOT_SECTION_UUID_FOR_NESTING } from '@/app/server/atlas/constants';
import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';

function md(strings: TemplateStringsArray, ...values: Array<string | number>): string {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i] ?? '';
    if (i < values.length) out += String(values[i]);
  }
  return out;
}

describe('parseAtlasMarkdown', () => {
  it('builds a simple Scope → Article tree', () => {
    const input = md`
# A.1 - The Governance Scope [Scope] <!-- UUID: 00000000-0000-0000-0000-000000000001 -->

Scope body line

## A.1.1 - Articles Root [Article] <!-- UUID: 00000000-0000-0000-0000-000000000002 -->

Article body
    `;

    const trees = parseAtlasMarkdown(input);
    expect(Array.isArray(trees)).toBe(true);
    expect(trees).toHaveLength(1);

    const scope = trees[0] as {
      type: string;
      doc_no: string;
      content: string;
      articles: Array<{ type: string; doc_no: string; content: string }>;
    };
    expect(scope.type).toBe('Scope');
    expect(scope.doc_no).toBe('A.1');
    expect(scope.content).toContain('Scope body line');
    expect(Array.isArray(scope.articles)).toBe(true);
    expect(scope.articles).toHaveLength(1);

    const article = scope.articles[0];
    expect(article.type).toBe('Article');
    expect(article.doc_no).toBe('A.1.1');
    expect(article.content).toContain('Article body');
  });

  it('extracts Type Specification extra fields and excludes them from content', () => {
    const input = md`
##### A.1.2.2.2.1 - The Type Specification Type [Type Specification] <!-- UUID: 468d192b-83bc-45ab-896f-53e8ca307135 -->

\[See below\]

**Components**:

Components content

**Doc Identifier Rules**:

Rule content

**Additional Logic**:

Logic content

**Type Category**:

Primary Document

**Type Name**:

Type Specification

**Type Overview**:

Overview content
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      type_specification_components: string;
      type_specification_doc_identifier_rules: string;
      type_specification_additional_logic: string;
      type_specification_type_category: string;
      type_specification_type_name: string;
      type_specification_type_overview: string;
    };
    expect(node.type).toBe('Type Specification');
    // Content is everything up to first known extra field label
    expect(node.content.trim()).toBe('[See below]');
    // Known fields captured
    expect(node.type_specification_components).toBe('Components content');
    expect(node.type_specification_doc_identifier_rules).toBe('Rule content');
    expect(node.type_specification_additional_logic).toBe('Logic content');
    expect(node.type_specification_type_category).toBe('Primary Document');
    expect(node.type_specification_type_name).toBe('Type Specification');
    expect(node.type_specification_type_overview).toBe('Overview content');
  });

  it('extracts Scenario and Scenario Variation extra fields correctly', () => {
    const input = md`
#### A.1.1.0.4.1.1.1 - Example Scenario [Scenario] <!-- UUID: 00000000-0000-0000-0000-000000000010 -->

Scenario intro

**Description**:

Scenario description text

**Finding**:

Scenario finding text

**Additional Guidance**:

Scenario guidance text

##### A.1.1.0.4.1.1.1.var1 - Variant [Scenario Variation] <!-- UUID: 00000000-0000-0000-0000-000000000011 -->

Variation intro

**Description**:

Variation description text

**Finding**:

Variation finding text

**Additional Guidance**:

Variation guidance text
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const scenario = trees[0] as {
      type: string;
      content: string;
      scenario_description: string;
      scenario_finding: string;
      scenario_additional_guidance: string;
      scenario_variations: Array<{
        type: string;
        content: string;
        scenario_variation_description: string;
        scenario_variation_finding: string;
        scenario_variation_additional_guidance: string;
      }>;
    };
    expect(scenario.type).toBe('Scenario');
    expect(scenario.content.trim()).toBe('Scenario intro');
    expect(scenario.scenario_description).toBe('Scenario description text');
    expect(scenario.scenario_finding).toBe('Scenario finding text');
    expect(scenario.scenario_additional_guidance).toBe('Scenario guidance text');

    expect(Array.isArray(scenario.scenario_variations)).toBe(true);
    expect(scenario.scenario_variations).toHaveLength(1);
    const variation = scenario.scenario_variations[0] as {
      type: string;
      content: string;
      scenario_variation_description: string;
      scenario_variation_finding: string;
      scenario_variation_additional_guidance: string;
    };
    expect(variation.type).toBe('Scenario Variation');
    expect(variation.content.trim()).toBe('Variation intro');
    expect(variation.scenario_variation_description).toBe('Variation description text');
    expect(variation.scenario_variation_finding).toBe('Variation finding text');
    expect(variation.scenario_variation_additional_guidance).toBe('Variation guidance text');
  });

  it('assigns Core under agent root to Agent Scope Database collection', () => {
    const input = md`
#### A.6.1.1 - Agent Section [Section]  <!-- UUID: ${AGENT_ROOT_SECTION_UUIDS_MAPPED.get(AGENT_ROOT_SECTION_UUID_FOR_NESTING) ?? ''} -->

Parent content

##### A.6.1.1.1 - Agent Core Doc [Core]  <!-- UUID: 00000000-0000-0000-0000-000000000099 -->

Core content`;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const parent = trees[0] as {
      type: string;
      agent_scope_database: Array<{ type: string; content: string }>;
    };
    expect(parent.type).toBe('Section');
    // Since the child Core resolves to Agent Scope Database, it should appear under agent_scope_database
    expect(Array.isArray(parent.agent_scope_database)).toBe(true);
    expect(parent.agent_scope_database.length).toBe(1);
    const child = parent.agent_scope_database[0];
    expect(child.type).toBe('Core');
    expect(child.content).toContain('Core content');
  });

  it('preserves internal blank lines but trims outer separators completely', () => {
    const input = md`
### A.2.3 - Test Doc [Section] <!-- UUID: 00000000-0000-0000-0000-000000000033 -->

First line

Last line
    `;
    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as { content: string };
    // No extra leading or trailing blank lines; internal blank line preserved
    expect(node.content).toBe('First line\n\nLast line');
  });

  it('parses extra fields with multi-line values containing blank lines', () => {
    const input = md`
##### A.1.2.2.2.30 - The Needed Research Type [Type Specification] <!-- UUID: 90490d29-6410-4d0b-b3f7-7359615fb656 -->

[See below]

**Doc Identifier Rules**:

Unlike other Supporting Documents, the document identifier of Needed Research documents is not derived from the Supporting Root of their Target Document. The "standalone" numbering scheme of Needed Research documents enables them to be linked to more than one Atlas Document, no matter the latter's location in the Atlas document tree. Needed Research Document Identifiers begin with the prefix "NR-", followed by an incremented number.

**Additional Logic**:

Generally, Needed Research Documents are most effective when linked to Primary Documents or Supporting Documents. These Document types have the objective of extrapolating from the abstract logic of their Parent documents to formulate rules and processes that are more concrete and actionable. Therefore, inputs for Needed Research are more appropriately sourced at this deeper level in the Atlas Document tree.

**Type Category**:

Supporting Document

**Type Name**:

Needed Research

**Type Overview**:

Needed Research Documents specify potential problems associated with their Target Document. Such problems can include potential gaps or conflicts in logic; questions regarding the operation of the Target Document to which there are currently no answers; etc.

As such, Needed Research documents formalize continuing research into Universal Alignment and enable the adaptive intelligence of the ecosystem to drive the evolution of Sky. Scope Facilitators, Atlas workstream contributors or other ecosystem participants are able to submit Needed Research inputs, which are then progressively processed through the standardized Atlas data integration protocol.

The gradual processing of Needed Research inputs can lead to modifications to the organization or content of Atlas documents, as well as concrete process improvements and new initiatives.
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      type_specification_doc_identifier_rules: string;
      type_specification_additional_logic: string;
      type_specification_type_category: string;
      type_specification_type_name: string;
      type_specification_type_overview: string;
    };

    expect(node.type).toBe('Type Specification');
    expect(node.content.trim()).toBe('[See below]');

    // Verify first field
    expect(node.type_specification_doc_identifier_rules).toContain('Unlike other Supporting Documents');
    expect(node.type_specification_doc_identifier_rules).toContain('followed by an incremented number');

    // Verify second field
    expect(node.type_specification_additional_logic).toContain('Generally, Needed Research Documents');
    expect(node.type_specification_additional_logic).toContain('deeper level in the Atlas Document tree');

    // Verify simple fields
    expect(node.type_specification_type_category).toBe('Supporting Document');
    expect(node.type_specification_type_name).toBe('Needed Research');

    // Verify the last field contains all paragraphs including content after blank lines
    expect(node.type_specification_type_overview).toContain('Needed Research Documents specify potential problems');
    expect(node.type_specification_type_overview).toContain('currently no answers; etc.');
    expect(node.type_specification_type_overview).toContain('As such, Needed Research documents formalize');
    expect(node.type_specification_type_overview).toContain('standardized Atlas data integration protocol');
    expect(node.type_specification_type_overview).toContain('The gradual processing of Needed Research');
    expect(node.type_specification_type_overview).toContain('concrete process improvements and new initiatives');

    // Verify blank lines are preserved within the field value
    expect(node.type_specification_type_overview).toMatch(/etc\.\n\nAs such/);
    expect(node.type_specification_type_overview).toMatch(/protocol\.\n\nThe gradual/);
  });

  it('represents empty Type Specification extra fields as empty strings, not null or undefined', () => {
    const input = md`
##### A.1.2.2.2.1 - Test Type Spec [Type Specification] <!-- UUID: 00000000-0000-0000-0000-000000000050 -->

Content here

**Doc Identifier Rules**:
**Additional Logic**:
**Type Category**:
**Type Name**:
**Type Overview**:
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      type_specification_doc_identifier_rules?: string;
      type_specification_additional_logic?: string;
      type_specification_type_category?: string;
      type_specification_type_name?: string;
      type_specification_type_overview?: string;
    };

    expect(node.type).toBe('Type Specification');
    expect(node.content.trim()).toBe('Content here');

    // All empty fields should be defined as empty strings, not null or undefined
    expect(node.type_specification_doc_identifier_rules).toBe('');
    expect(node.type_specification_additional_logic).toBe('');
    expect(node.type_specification_type_category).toBe('');
    expect(node.type_specification_type_name).toBe('');
    expect(node.type_specification_type_overview).toBe('');
  });

  it('represents empty Scenario extra fields as empty strings', () => {
    const input = md`
#### A.1.1.0.4.1 - Empty Scenario [Scenario] <!-- UUID: 00000000-0000-0000-0000-000000000060 -->

Scenario content

**Finding**:
**Additional Guidance**:
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      scenario_finding?: string;
      scenario_additional_guidance?: string;
    };

    expect(node.type).toBe('Scenario');
    expect(node.content.trim()).toBe('Scenario content');

    // Empty fields should be defined as empty strings
    expect(node.scenario_finding).toBe('');
    expect(node.scenario_additional_guidance).toBe('');
  });

  it('represents empty Scenario Variation extra fields as empty strings', () => {
    const input = md`
##### A.1.1.0.4.1.1 - Empty Variation [Scenario Variation] <!-- UUID: 00000000-0000-0000-0000-000000000070 -->

Variation content

**Finding**:
**Additional Guidance**:
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      scenario_variation_finding?: string;
      scenario_variation_additional_guidance?: string;
    };

    expect(node.type).toBe('Scenario Variation');
    expect(node.content.trim()).toBe('Variation content');

    // Empty fields should be defined as empty strings
    expect(node.scenario_variation_finding).toBe('');
    expect(node.scenario_variation_additional_guidance).toBe('');
  });

  it('represents missing extra fields as empty strings when only some are present', () => {
    const input = md`
##### A.1.2.2.2.2 - Partial Type Spec [Type Specification] <!-- UUID: 00000000-0000-0000-0000-000000000080 -->

Content here

**Doc Identifier Rules**:

Has content

**Type Category**:

Primary Document
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      type_specification_doc_identifier_rules?: string;
      type_specification_additional_logic?: string;
      type_specification_type_category?: string;
      type_specification_type_name?: string;
      type_specification_type_overview?: string;
    };

    expect(node.type).toBe('Type Specification');
    expect(node.content.trim()).toBe('Content here');

    // Present fields should have their values
    expect(node.type_specification_doc_identifier_rules).toBe('Has content');
    expect(node.type_specification_type_category).toBe('Primary Document');

    // Missing fields should be defined as empty strings
    expect(node.type_specification_additional_logic).toBe('');
    expect(node.type_specification_type_name).toBe('');
    expect(node.type_specification_type_overview).toBe('');
  });

  it('handles whitespace-only extra field values as empty strings', () => {
    const input = md`
##### A.1.2.2.2.3 - Whitespace Type Spec [Type Specification] <!-- UUID: 00000000-0000-0000-0000-000000000090 -->

Content here

**Doc Identifier Rules**:

**Additional Logic**:

**Type Category**:

Valid

**Type Name**:

**Type Overview**:
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      type_specification_doc_identifier_rules?: string;
      type_specification_additional_logic?: string;
      type_specification_type_category?: string;
      type_specification_type_name?: string;
      type_specification_type_overview?: string;
    };

    expect(node.type).toBe('Type Specification');

    // Whitespace-only values should be treated as empty strings
    expect(node.type_specification_doc_identifier_rules).toBe('');
    expect(node.type_specification_additional_logic).toBe('');
    expect(node.type_specification_type_name).toBe('');
    expect(node.type_specification_type_overview).toBe('');

    // Only the field with actual content should have a value
    expect(node.type_specification_type_category).toBe('Valid');
  });

  it('correctly parses extra fields with blank lines after values (exporter format)', () => {
    // This tests the exact format that the exporter produces:
    // **Label**: followed by blank line, then value, then blank line (except last field)
    const input = md`
##### A.1.2.2.2.4 - Test Type Spec With Spacing [Type Specification] <!-- UUID: 00000000-0000-0000-0000-000000000100 -->

Content before fields

**Doc Identifier Rules**:

First field value

**Additional Logic**:

Second field value

**Type Category**:

Third field value

**Type Name**:

Fourth field value

**Type Overview**:

Last field value (no trailing blank line)
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as {
      type: string;
      content: string;
      type_specification_doc_identifier_rules?: string;
      type_specification_additional_logic?: string;
      type_specification_type_category?: string;
      type_specification_type_name?: string;
      type_specification_type_overview?: string;
    };

    expect(node.type).toBe('Type Specification');
    expect(node.content.trim()).toBe('Content before fields');

    // All field values should be correctly extracted without leading/trailing blank lines
    expect(node.type_specification_doc_identifier_rules).toBe('First field value');
    expect(node.type_specification_additional_logic).toBe('Second field value');
    expect(node.type_specification_type_category).toBe('Third field value');
    expect(node.type_specification_type_name).toBe('Fourth field value');
    expect(node.type_specification_type_overview).toBe('Last field value (no trailing blank line)');
  });

  it('parses deeply nested documents with 6 hashtag cap', () => {
    const input = md`
#### A.1.2.3.4 - Parent Core [Core] <!-- UUID: 00000000-0000-0000-0000-000000000200 -->

Parent content at depth 4

##### A.1.2.3.4.5 - Child Core [Core] <!-- UUID: 00000000-0000-0000-0000-000000000201 -->

Child content at depth 5

###### A.1.2.3.4.5.6 - Grandchild Core [Core] <!-- UUID: 00000000-0000-0000-0000-000000000202 -->

Grandchild content at depth 6

###### A.1.2.3.4.5.6.7 - Great-grandchild Core [Core] <!-- UUID: 00000000-0000-0000-0000-000000000203 -->

Great-grandchild content at depth 7 (capped at 6 hashtags)

###### A.1.2.3.4.5.6.7.8 - Deep Core [Core] <!-- UUID: 00000000-0000-0000-0000-000000000204 -->

Deep content at depth 8 (capped at 6 hashtags)
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);

    // Verify the tree structure is correct
    const root = trees[0] as {
      type: string;
      doc_no: string;
      sections_and_primary_docs: Array<{
        type: string;
        doc_no: string;
        sections_and_primary_docs: Array<{
          type: string;
          doc_no: string;
          sections_and_primary_docs: Array<{
            type: string;
            doc_no: string;
            sections_and_primary_docs: Array<{ type: string; doc_no: string }>;
          }>;
        }>;
      }>;
    };

    expect(root.doc_no).toBe('A.1.2.3.4');
    expect(root.sections_and_primary_docs).toHaveLength(1);

    const child = root.sections_and_primary_docs[0];
    expect(child.doc_no).toBe('A.1.2.3.4.5');
    expect(child.sections_and_primary_docs).toHaveLength(1);

    const grandchild = child.sections_and_primary_docs[0];
    expect(grandchild.doc_no).toBe('A.1.2.3.4.5.6');
    expect(grandchild.sections_and_primary_docs).toHaveLength(1);

    const greatGrandchild = grandchild.sections_and_primary_docs[0];
    expect(greatGrandchild.doc_no).toBe('A.1.2.3.4.5.6.7');
    expect(greatGrandchild.sections_and_primary_docs).toHaveLength(1);

    const deepCore = greatGrandchild.sections_and_primary_docs[0];
    expect(deepCore.doc_no).toBe('A.1.2.3.4.5.6.7.8');
  });

  it('correctly determines parent-child relationships using document numbers, not heading levels', () => {
    const input = md`
##### A.1.2.3.4.5 - First Doc [Core] <!-- UUID: 00000000-0000-0000-0000-000000000300 -->

First doc content

###### A.1.2.3.4.5.6 - Second Doc [Core] <!-- UUID: 00000000-0000-0000-0000-000000000301 -->

Second doc content

###### A.1.2.3.4.5.7 - Sibling Doc [Core] <!-- UUID: 00000000-0000-0000-0000-000000000302 -->

Sibling doc content (should be sibling of A.1.2.3.4.5.6, not child)
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);

    const root = trees[0] as {
      doc_no: string;
      sections_and_primary_docs: Array<{
        doc_no: string;
      }>;
    };

    // First doc should have two children (Second Doc and Sibling Doc)
    expect(root.doc_no).toBe('A.1.2.3.4.5');
    expect(root.sections_and_primary_docs).toHaveLength(2);
    expect(root.sections_and_primary_docs[0].doc_no).toBe('A.1.2.3.4.5.6');
    expect(root.sections_and_primary_docs[1].doc_no).toBe('A.1.2.3.4.5.7');
  });

  it('parses Needed Research documents nested under various parent types', () => {
    const input = md`
### A.0.1.1 - Section [Section] <!-- UUID: 00000000-0000-0000-0000-000000000400 -->

Section content

#### NR-1 - Research for Section [Needed Research] <!-- UUID: 00000000-0000-0000-0000-000000000401 -->

Research content

#### A.0.1.1.1 - Core [Core] <!-- UUID: 00000000-0000-0000-0000-000000000402 -->

Core content

##### NR-2 - Research for Core [Needed Research] <!-- UUID: 00000000-0000-0000-0000-000000000403 -->

More research
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);

    const section = trees[0] as {
      type: string;
      doc_no: string;
      needed_research: Array<{ doc_no: string; type: string }>;
      sections_and_primary_docs: Array<{
        type: string;
        doc_no: string;
        needed_research: Array<{ doc_no: string; type: string }>;
      }>;
    };

    expect(section.type).toBe('Section');
    expect(section.doc_no).toBe('A.0.1.1');

    // Section should have 1 Needed Research child
    expect(section.needed_research).toHaveLength(1);
    expect(section.needed_research[0].doc_no).toBe('NR-1');
    expect(section.needed_research[0].type).toBe('Needed Research');

    // Section should have 1 Core child
    expect(section.sections_and_primary_docs).toHaveLength(1);
    const core = section.sections_and_primary_docs[0];
    expect(core.doc_no).toBe('A.0.1.1.1');
    expect(core.type).toBe('Core');

    // Core should have 1 Needed Research child
    expect(core.needed_research).toHaveLength(1);
    expect(core.needed_research[0].doc_no).toBe('NR-2');
    expect(core.needed_research[0].type).toBe('Needed Research');
  });

  it('handles Needed Research at depth > 6 (capped heading level)', () => {
    const input = md`
###### A.1.2.3.4.5.6 - Deep Core [Core] <!-- UUID: 00000000-0000-0000-0000-000000000500 -->

Deep content at depth 6

###### NR-10 - Research at Depth 7 [Needed Research] <!-- UUID: 00000000-0000-0000-0000-000000000501 -->

Research content (both use 6 hashtags but NR is child)
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);

    const core = trees[0] as {
      type: string;
      doc_no: string;
      needed_research: Array<{ doc_no: string; type: string }>;
    };

    expect(core.type).toBe('Core');
    expect(core.doc_no).toBe('A.1.2.3.4.5.6');
    expect(core.needed_research).toHaveLength(1);
    expect(core.needed_research[0].doc_no).toBe('NR-10');
  });
});
