import { describe, expect, it } from 'vitest';
import { AGENT_ROOT_SECTION_UUID_FOR_NESTING } from '@/app/server/atlas/constants';
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
#### A.6.1.1 - Agent Section [Section]  <!-- UUID: ${AGENT_ROOT_SECTION_UUID_FOR_NESTING} -->

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

  it('preserves author-intended blank lines, trimming only single separators', () => {
    const input = md`
### A.2.3 - Test Doc [Section] <!-- UUID: 00000000-0000-0000-0000-000000000033 -->

First line

Last line
    `;
    const trees = parseAtlasMarkdown(input);
    expect(trees).toHaveLength(1);
    const node = trees[0] as { content: string };
    // After trimming only one leading and one trailing blank line, we should still have
    // one leading and one trailing blank line in content
    expect(node.content.startsWith('\nFirst line')).toBe(true);
    expect(node.content.endsWith('Last line\n')).toBe(true);
  });
});
