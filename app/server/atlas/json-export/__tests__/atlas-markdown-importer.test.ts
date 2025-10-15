import { describe, expect, it } from 'vitest';
import { AGENT_ROOT_SECTION_UUIDS_MAPPED, AGENT_ROOT_SECTION_UUID_FOR_NESTING } from '@/app/server/atlas/constants';
import { parseAtlasMarkdown } from '@/app/server/atlas/json-export/atlas-markdown-importer';

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

**Doc Identifier Rules**: Rule content
**Additional Logic**: Logic content
**Type Category**: Primary Document
**Type Name**: Type Specification
**Type Overview**: Overview content
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
    // Content is everything up to first known extra field label
    expect(node.content.trim()).toBe('[See below]');
    // Known fields captured
    expect(node.type_specification_doc_identifier_rules).toBe('Rule content');
    expect(node.type_specification_additional_logic).toBe('Logic content');
    expect(node.type_specification_type_category).toBe('Primary Document');
    expect(node.type_specification_type_name).toBe('Type Specification');
    expect(node.type_specification_type_overview).toBe('Overview content');
  });

  it('extracts Scenario and Scenario Variation extra fields correctly', () => {
    const input = md`
#### A.1.1.0.4.1 - Example Scenario [Scenario] <!-- UUID: 00000000-0000-0000-0000-000000000010 -->

Scenario intro

**Finding**: Scenario finding text
**Additional Guidance**: Scenario guidance text

##### A.1.1.0.4.1.1 - Variant [Scenario Variation] <!-- UUID: 00000000-0000-0000-0000-000000000011 -->

Variation intro

**Finding**: Variation finding text
**Additional Guidance**: Variation guidance text
    `;

    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const scenario = trees[0] as {
      type: string;
      content: string;
      scenario_finding: string;
      scenario_additional_guidance: string;
      scenario_variations: Array<{
        type: string;
        content: string;
        scenario_variation_finding: string;
        scenario_variation_additional_guidance: string;
      }>;
    };
    expect(scenario.type).toBe('Scenario');
    expect(scenario.content.trim()).toBe('Scenario intro');
    expect(scenario.scenario_finding).toBe('Scenario finding text');
    expect(scenario.scenario_additional_guidance).toBe('Scenario guidance text');

    expect(Array.isArray(scenario.scenario_variations)).toBe(true);
    expect(scenario.scenario_variations).toHaveLength(1);
    const variation = scenario.scenario_variations[0] as {
      type: string;
      content: string;
      scenario_variation_finding: string;
      scenario_variation_additional_guidance: string;
    };
    expect(variation.type).toBe('Scenario Variation');
    expect(variation.content.trim()).toBe('Variation intro');
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

**Doc Identifier Rules**: Unlike other Supporting Documents, the document identifier of Needed Research documents is not derived from the Supporting Root of their Target Document. The "standalone" numbering scheme of Needed Research documents enables them to be linked to more than one Atlas Document, no matter the latter's location in the Atlas document tree. Needed Research Document Identifiers begin with the prefix "NR-", followed by an incremented number.
**Additional Logic**: Generally, Needed Research Documents are most effective when linked to Primary Documents or Supporting Documents. These Document types have the objective of extrapolating from the abstract logic of their Parent documents to formulate rules and processes that are more concrete and actionable. Therefore, inputs for Needed Research are more appropriately sourced at this deeper level in the Atlas Document tree.
**Type Category**: Supporting Document
**Type Name**: Needed Research
**Type Overview**: Needed Research Documents specify potential problems associated with their Target Document. Such problems can include potential gaps or conflicts in logic; questions regarding the operation of the Target Document to which there are currently no answers; etc.

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

**Doc Identifier Rules**: Has content
**Type Category**: Primary Document
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

**Type Category**: Valid
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
});
