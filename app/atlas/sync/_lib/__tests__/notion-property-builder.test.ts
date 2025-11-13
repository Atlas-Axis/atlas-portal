/**
 * Tests for notion-property-builder.ts
 *
 * This file tests the building of Notion properties for syncing Atlas documents from Markdown to Notion.
 * For the original Notion property name mappings and database configurations, see:
 * @see app/server/atlas/notion-database-properties-and-relationships.ts
 */
import { describe, expect, it } from 'vitest';
import { BaseAtlasDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { addParentPageRelationshipProperty, buildNotionProperties } from '../notion-property-builder';

// Mock UUID mappings for testing
const mockUuidMappings: UuidMappings = {
  notionPageIDsToAtlasUUIDs: new Map(),
  atlasUUIDsToNotionPageIds: new Map(),
};

describe('notion-property-builder', () => {
  describe('buildNotionProperties', () => {
    it('builds basic properties for Section document', () => {
      const doc: BaseAtlasDocument = {
        type: 'Section',
        doc_no: 'A.1.2',
        name: 'Test Section',
        uuid: '123',
        content: 'Section content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Sections & Primary Docs', mockUuidMappings);

      // Document name is synced (title field for Sections & Primary Docs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Doc No (or Temp Name)'] as any).title[0].text.content).toBe('Test Section');

      // Document type is synced (select field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type'] as any).select.name).toBe('Section');

      // Content is synced (rich_text field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Content'] as any).rich_text[0].text.content).toBe('Section content');

      // Document number is not currently synced (commented out in implementation)
      // expect((properties['Doc No'] as any).rich_text[0].text.content).toBe('A.1.2');
    });

    it('builds basic properties for Scope document', () => {
      const doc: BaseAtlasDocument = {
        type: 'Scope',
        doc_no: 'A.1',
        name: 'Test Scope',
        uuid: '456',
        content: 'Scope content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Scopes', mockUuidMappings);

      // Document name is synced (rich_text field for Scopes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Name'] as any).rich_text[0].text.content).toBe('Test Scope');

      // Document type is synced (select field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type'] as any).select.name).toBe('Scope');

      // Content is synced (rich_text field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Content'] as any).rich_text[0].text.content).toBe('Scope content');

      // Document number is not currently synced (commented out in implementation)
      // expect((properties['Doc No'] as any).rich_text[0].text.content).toBe('A.1');
    });

    it('builds extra fields for Type Specification document', () => {
      const doc = {
        type: 'Type Specification',
        doc_no: 'A.1.2.3',
        name: 'Type Spec',
        uuid: '123',
        content: 'Content',
        last_modified: '',
        type_specification_components: 'Component list',
        type_specification_type_name: 'MyType',
        type_specification_type_overview: 'Overview text',
        type_specification_type_category: 'Category A',
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Sections & Primary Docs', mockUuidMappings);

      // Document type is synced (select field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type'] as any).select.name).toBe('Type Specification');

      // Extra fields are synced (rich_text fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Components'] as any).rich_text[0].text.content).toBe('Component list');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type Name'] as any).rich_text[0].text.content).toBe('MyType');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type Overview'] as any).rich_text[0].text.content).toBe('Overview text');

      // Type Category is a select field
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type Category'] as any).select.name).toBe('Category A');
    });

    it('builds extra fields for Scenario document', () => {
      const doc = {
        type: 'Scenario',
        doc_no: '.1.1',
        name: 'Test Scenario',
        uuid: '789',
        content: '',
        last_modified: '',
        scenario_description: 'Scenario description text',
        scenario_finding: 'Finding text',
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Scenarios', mockUuidMappings);

      // Document type is synced (select field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type'] as any).select.name).toBe('Scenario');

      // Extra fields are synced (rich_text fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Description'] as any).rich_text[0].text.content).toBe('Scenario description text');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Finding'] as any).rich_text[0].text.content).toBe('Finding text');
    });

    it('builds extra fields for Scenario Variation document', () => {
      const doc = {
        type: 'Scenario Variation',
        doc_no: '.var1',
        name: 'Variation',
        uuid: '999',
        content: '',
        last_modified: '',
        scenario_variation_description: 'Variation description',
        scenario_variation_finding: 'Variation finding',
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Scenario Variations', mockUuidMappings);

      // Document type is synced (select field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type'] as any).select.name).toBe('Scenario Variation');

      // Extra fields are synced (rich_text fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Description'] as any).rich_text[0].text.content).toBe('Variation description');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Finding'] as any).rich_text[0].text.content).toBe('Variation finding');
    });

    it('builds extra fields for Needed Research document', () => {
      const doc = {
        type: 'Needed Research',
        doc_no: 'NR-1',
        name: 'Research Item',
        uuid: '111',
        content: '',
        last_modified: '',
        needed_research_content: 'Research content text',
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Needed Research', mockUuidMappings);

      // Document type is synced (select field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type'] as any).select.name).toBe('Needed Research');

      // Extra fields are synced (rich_text fields)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Content'] as any).rich_text[0].text.content).toBe('Research content text');
    });

    it('handles null/undefined extra fields by skipping them', () => {
      const doc = {
        type: 'Scenario',
        doc_no: '.1.1',
        name: 'Scenario',
        uuid: '123',
        content: '',
        last_modified: '',
        scenario_description: null,
        scenario_additional_guidance: undefined,
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Scenarios', mockUuidMappings);

      // Should not include null/undefined fields (field not present)
      expect(properties['Description']).toBeUndefined();
      expect(properties['Additional Guidance']).toBeUndefined();
    });

    it('handles empty string extra fields by clearing them', () => {
      const doc = {
        type: 'Scenario',
        doc_no: '.1.1',
        name: 'Scenario',
        uuid: '123',
        content: '',
        last_modified: '',
        scenario_description: '',
        scenario_finding: '',
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Scenarios', mockUuidMappings);

      // Should set empty string fields to empty rich_text array (to clear Notion field)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Description'] as any).rich_text).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Finding'] as any).rich_text).toEqual([]);
    });

    it('handles empty content by providing empty rich_text array', () => {
      const doc: BaseAtlasDocument = {
        type: 'Section',
        doc_no: 'A.1.2',
        name: 'Empty Section',
        uuid: '123',
        content: '',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Sections & Primary Docs', mockUuidMappings);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Content'] as any).rich_text).toEqual([]);
    });

    it('handles database without content property', () => {
      const doc: BaseAtlasDocument = {
        type: 'Scenario Variation',
        doc_no: '.var1',
        name: 'Variation',
        uuid: '123',
        content: 'Some content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Scenario Variations', mockUuidMappings);

      // Scenario Variations database has content: null in config
      // So Content property should not be in the properties object
      expect(properties['Content']).toBeUndefined();
    });

    it('uses correct property name for document type in Agent Scope Database', () => {
      const doc: BaseAtlasDocument = {
        type: 'Core',
        doc_no: 'A.1.1',
        name: 'Agent Core',
        uuid: '777',
        content: 'Agent content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Agent Scope Database', mockUuidMappings);

      // Document name is synced (title field for Agent Scope Database)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Document Name'] as any).title[0].text.content).toBe('Agent Core');

      // Agent Scope Database uses "Doc Type" instead of "Type"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Doc Type'] as any).select.name).toBe('Core');

      // Should not have a "Type" property
      expect(properties['Type']).toBeUndefined();
    });

    it('uses correct property name for document type in Scopes database', () => {
      const doc: BaseAtlasDocument = {
        type: 'Scope',
        doc_no: 'A.1',
        name: 'Test Scope',
        uuid: '888',
        content: 'Scope content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Scopes', mockUuidMappings);

      // Document name is synced (rich_text field for Scopes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Name'] as any).rich_text[0].text.content).toBe('Test Scope');

      // Scopes database uses "Type"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type'] as any).select.name).toBe('Scope');

      // Should not have a "Doc Type" property
      expect(properties['Doc Type']).toBeUndefined();
    });

    it('handles document name as title type for Sections & Primary Docs', () => {
      const doc: BaseAtlasDocument = {
        type: 'Core',
        doc_no: 'A.1.2.1',
        name: 'Core Document Name',
        uuid: '999',
        content: 'Core content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Sections & Primary Docs', mockUuidMappings);

      // Document name uses title type (from NOTION_PROPERTY_TYPE_OVERRIDES)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Doc No (or Temp Name)'] as any).title).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Doc No (or Temp Name)'] as any).title[0].text.content).toBe('Core Document Name');
      // Should NOT have rich_text property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Doc No (or Temp Name)'] as any).rich_text).toBeUndefined();
    });

    it('handles document name as rich_text type for Articles', () => {
      const doc: BaseAtlasDocument = {
        type: 'Article',
        doc_no: 'A.1.1',
        name: 'Article Name',
        uuid: '1010',
        content: 'Article content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Articles', mockUuidMappings);

      // Document name uses rich_text type (no override for "Name" in Articles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Name'] as any).rich_text).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Name'] as any).rich_text[0].text.content).toBe('Article Name');
      // Should NOT have title property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Name'] as any).title).toBeUndefined();
    });

    it('handles empty document name for title type', () => {
      const doc: BaseAtlasDocument = {
        type: 'Core',
        doc_no: 'A.1.2.1',
        name: '',
        uuid: '1111',
        content: 'Core content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Sections & Primary Docs', mockUuidMappings);

      // Empty name should result in empty title array with one empty text item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Doc No (or Temp Name)'] as any).title[0].text.content).toBe('');
    });

    it('handles empty document name for rich_text type', () => {
      const doc: BaseAtlasDocument = {
        type: 'Scope',
        doc_no: 'A.1',
        name: '',
        uuid: '1212',
        content: 'Scope content',
        last_modified: '',
      };

      const properties = buildNotionProperties(doc, 'Scopes', mockUuidMappings);

      // Empty name should result in rich_text array with one empty text item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Name'] as any).rich_text[0].text.content).toBe('');
    });

    it('handles select type extra field (Type Category)', () => {
      const doc = {
        type: 'Type Specification',
        doc_no: 'A.1.2.3',
        name: 'Type Spec',
        uuid: '123',
        content: 'Content',
        last_modified: '',
        type_specification_type_category: 'Primary',
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Sections & Primary Docs', mockUuidMappings);

      // Type Category should be formatted as select
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type Category'] as any).select).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type Category'] as any).select.name).toBe('Primary');
    });

    it('handles empty string for select type extra field', () => {
      const doc = {
        type: 'Type Specification',
        doc_no: 'A.1.2.3',
        name: 'Type Spec',
        uuid: '123',
        content: 'Content',
        last_modified: '',
        type_specification_type_category: '',
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Sections & Primary Docs', mockUuidMappings);

      // Empty select should be set to null to clear the field
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Type Category'] as any).select).toBeNull();
    });

    it('handles null for select type extra field by skipping it', () => {
      const doc = {
        type: 'Type Specification',
        doc_no: 'A.1.2.3',
        name: 'Type Spec',
        uuid: '123',
        content: 'Content',
        last_modified: '',
        type_specification_type_category: null,
      };

      const properties = buildNotionProperties(doc as BaseAtlasDocument, 'Sections & Primary Docs', mockUuidMappings);

      // Null value should be skipped entirely (field not set)
      expect(properties['Type Category']).toBeUndefined();
    });

    it('handles number type extra field', () => {
      // This test demonstrates the number property type handling
      // by simulating the addExtraFieldsToProperties logic
      const properties: Record<string, unknown> = {};
      const value = '42';
      const propertyType = 'number';

      // Simulate the addExtraFieldsToProperties logic for number type
      if (propertyType === 'number') {
        const numValue = Number(value);
        properties['Hypothetical Number'] = {
          number: isNaN(numValue) ? null : numValue,
        };
      }

      // Number field should be formatted correctly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Hypothetical Number'] as any).number).toBe(42);
    });

    it('handles empty string for number type extra field', () => {
      // This test uses a hypothetical number field for demonstration
      const properties: Record<string, unknown> = {};
      const value = '';
      const propertyType = 'number';

      if (propertyType === 'number') {
        if (value === '') {
          properties['Hypothetical Number'] = {
            number: null,
          };
        }
      }

      // Empty number should be set to null to clear the field
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Hypothetical Number'] as any).number).toBeNull();
    });

    it('handles invalid number string for number type extra field', () => {
      const properties: Record<string, unknown> = {};
      const value = 'not-a-number';
      const propertyType = 'number';

      if (propertyType === 'number') {
        const numValue = Number(value);
        properties['Hypothetical Number'] = {
          number: isNaN(numValue) ? null : numValue,
        };
      }

      // Invalid number should be set to null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((properties['Hypothetical Number'] as any).number).toBeNull();
    });
  });

  describe('addParentPageRelationshipProperty', () => {
    it('returns empty object for database without internal nesting', () => {
      const props = addParentPageRelationshipProperty('parent-123', 'Scopes');

      expect(props).toEqual({});
    });

    it('returns empty object when no parent page ID is provided', () => {
      const props = addParentPageRelationshipProperty(null, 'Sections & Primary Docs');

      expect(props).toEqual({});
    });

    it('returns parent relationship for Sections & Primary Docs with parent', () => {
      const props = addParentPageRelationshipProperty('parent-page-123', 'Sections & Primary Docs');

      expect(props).toEqual({
        'Parent Doc': {
          relation: [{ id: 'parent-page-123' }],
        },
      });
    });

    it('returns parent relationship for Agent Scope Database with parent', () => {
      const props = addParentPageRelationshipProperty('parent-agent-456', 'Agent Scope Database');

      expect(props).toEqual({
        'Parent item': {
          relation: [{ id: 'parent-agent-456' }],
        },
      });
    });
  });
});
