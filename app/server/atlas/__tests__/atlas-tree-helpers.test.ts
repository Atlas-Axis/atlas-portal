import { describe, expect, it } from 'vitest';
import { sortAtlasDocuments } from '../atlas-tree-helpers';

describe('sortAtlasDocuments', () => {
  describe('Sections & Primary Docs database', () => {
    it('sorts documents with same sort_order by document number using compareDocNumbers', () => {
      const documents = [
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A10 - Alignment Conservers - Accountability And Misalignment Handling - AC Derecognition',
          atlas_database_name: 'Sections & Primary Docs',
        },
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A2 - Alignment Conservers - Powers And Constraints - ACs Must Safeguard The Spirit Of The Atlas',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      // When sort_order is the same, compareDocNumbers is used
      // Natural ordering: A2 comes before A10 (2 < 10 numerically)
      expect(sorted[0].atlas_document_number).toBe(
        'A.1.4 - A2 - Alignment Conservers - Powers And Constraints - ACs Must Safeguard The Spirit Of The Atlas',
      );
      expect(sorted[1].atlas_document_number).toBe(
        'A.1.4 - A10 - Alignment Conservers - Accountability And Misalignment Handling - AC Derecognition',
      );
    });

    it('sorts documents with same sort_order by document number (reversed input)', () => {
      // Same test as above but with reversed input order
      const documents = [
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A2 - Alignment Conservers - Powers And Constraints - ACs Must Safeguard The Spirit Of The Atlas',
          atlas_database_name: 'Sections & Primary Docs',
        },
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A10 - Alignment Conservers - Accountability And Misalignment Handling - AC Derecognition',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      // Should produce the same sorted order regardless of input order
      // Natural ordering: A2 comes before A10 (2 < 10 numerically)
      expect(sorted[0].atlas_document_number).toBe(
        'A.1.4 - A2 - Alignment Conservers - Powers And Constraints - ACs Must Safeguard The Spirit Of The Atlas',
      );
      expect(sorted[1].atlas_document_number).toBe(
        'A.1.4 - A10 - Alignment Conservers - Accountability And Misalignment Handling - AC Derecognition',
      );
    });

    it('sorts documents by sort_order first, then by document number', () => {
      const documents = [
        {
          sort_order: 2,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A2 - Alignment Conservers - Powers And Constraints - ACs Must Safeguard The Spirit Of The Atlas',
          atlas_database_name: 'Sections & Primary Docs',
        },
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A10 - Alignment Conservers - Accountability And Misalignment Handling - AC Derecognition',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      // sort_order 1 should come before sort_order 2
      expect(sorted[0].sort_order).toBe(1);
      expect(sorted[0].atlas_document_number).toContain('A10');
      expect(sorted[1].sort_order).toBe(2);
      expect(sorted[1].atlas_document_number).toContain('A2');
    });

    it('handles null sort_order as 0', () => {
      const documents = [
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A10 - Alignment Conservers - Accountability And Misalignment Handling - AC Derecognition',
          atlas_database_name: 'Sections & Primary Docs',
        },
        {
          sort_order: null,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A2 - Alignment Conservers - Powers And Constraints - ACs Must Safeguard The Spirit Of The Atlas',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      // null (treated as 0) should come before 1
      // TODO: Verify that this is the expected behavior
      expect(sorted[0].sort_order).toBe(null);
      expect(sorted[0].atlas_document_number).toContain('A2');
      expect(sorted[1].sort_order).toBe(1);
      expect(sorted[1].atlas_document_number).toContain('A10');
    });

    it('does not mutate the original array', () => {
      const documents = [
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A10 - Alignment Conservers - Accountability And Misalignment Handling - AC Derecognition',
          atlas_database_name: 'Sections & Primary Docs',
        },
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number:
            'A.1.4 - A2 - Alignment Conservers - Powers And Constraints - ACs Must Safeguard The Spirit Of The Atlas',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const original = [...documents];
      sortAtlasDocuments(documents);

      // Original array should remain unchanged
      expect(documents).toEqual(original);
    });
  });

  describe('Other databases (using document number only)', () => {
    it('sorts Scopes by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Scope',
          atlas_document_number: 'A.10',
          atlas_database_name: 'Scopes',
        },
        {
          sort_order: null,
          atlas_document_type: 'Scope',
          atlas_document_number: 'A.2',
          atlas_database_name: 'Scopes',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.2');
      expect(sorted[1].atlas_document_number).toBe('A.10');
    });

    it('sorts Scopes by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Scope',
          atlas_document_number: 'A.2',
          atlas_database_name: 'Scopes',
        },
        {
          sort_order: null,
          atlas_document_type: 'Scope',
          atlas_document_number: 'A.10',
          atlas_database_name: 'Scopes',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.2');
      expect(sorted[1].atlas_document_number).toBe('A.10');
    });

    it('sorts Articles by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Article',
          atlas_document_number: 'A.1.10',
          atlas_database_name: 'Articles',
        },
        {
          sort_order: null,
          atlas_document_type: 'Article',
          atlas_document_number: 'A.1.2',
          atlas_database_name: 'Articles',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.1.2');
      expect(sorted[1].atlas_document_number).toBe('A.1.10');
    });

    it('sorts Articles by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Article',
          atlas_document_number: 'A.1.2',
          atlas_database_name: 'Articles',
        },
        {
          sort_order: null,
          atlas_document_type: 'Article',
          atlas_document_number: 'A.1.10',
          atlas_database_name: 'Articles',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.1.2');
      expect(sorted[1].atlas_document_number).toBe('A.1.10');
    });

    it('sorts Agent Scope Database by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Core',
          atlas_document_number: 'A.1.1.10',
          atlas_database_name: 'Agent Scope Database',
        },
        {
          sort_order: null,
          atlas_document_type: 'Core',
          atlas_document_number: 'A.1.1.2',
          atlas_database_name: 'Agent Scope Database',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.1.1.2');
      expect(sorted[1].atlas_document_number).toBe('A.1.1.10');
    });

    it('sorts Agent Scope Database by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Core',
          atlas_document_number: 'A.1.1.2',
          atlas_database_name: 'Agent Scope Database',
        },
        {
          sort_order: null,
          atlas_document_type: 'Core',
          atlas_document_number: 'A.1.1.10',
          atlas_database_name: 'Agent Scope Database',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.1.1.2');
      expect(sorted[1].atlas_document_number).toBe('A.1.1.10');
    });

    it('sorts Annotations by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Annotation',
          atlas_document_number: 'Chief Contract - Element Annotation',
          atlas_database_name: 'Annotations',
        },
        {
          sort_order: null,
          atlas_document_type: 'Annotation',
          atlas_document_number: 'Ambiguity - Element Annotation',
          atlas_database_name: 'Annotations',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('Ambiguity - Element Annotation');
      expect(sorted[1].atlas_document_number).toBe('Chief Contract - Element Annotation');
    });

    it('sorts Annotations by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Annotation',
          atlas_document_number: 'Ambiguity - Element Annotation',
          atlas_database_name: 'Annotations',
        },
        {
          sort_order: null,
          atlas_document_type: 'Annotation',
          atlas_document_number: 'Chief Contract - Element Annotation',
          atlas_database_name: 'Annotations',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('Ambiguity - Element Annotation');
      expect(sorted[1].atlas_document_number).toBe('Chief Contract - Element Annotation');
    });

    it('sorts Tenets by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Action Tenet',
          atlas_document_number: 'Clear Error',
          atlas_database_name: 'Tenets',
        },
        {
          sort_order: null,
          atlas_document_type: 'Action Tenet',
          atlas_document_number: 'ACs Must Go Beyond Mere Technical Compliance With Rules',
          atlas_database_name: 'Tenets',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('ACs Must Go Beyond Mere Technical Compliance With Rules');
      expect(sorted[1].atlas_document_number).toBe('Clear Error');
    });

    it('sorts Tenets by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Action Tenet',
          atlas_document_number: 'ACs Must Go Beyond Mere Technical Compliance With Rules',
          atlas_database_name: 'Tenets',
        },
        {
          sort_order: null,
          atlas_document_type: 'Action Tenet',
          atlas_document_number: 'Clear Error',
          atlas_database_name: 'Tenets',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('ACs Must Go Beyond Mere Technical Compliance With Rules');
      expect(sorted[1].atlas_document_number).toBe('Clear Error');
    });

    it('sorts Active Data by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Active Data',
          atlas_document_number: 'A.2.11 - Lawyer Registry Current Approved Legal Counsels',
          atlas_database_name: 'Active Data',
        },
        {
          sort_order: null,
          atlas_document_type: 'Active Data',
          atlas_document_number: 'A.2.10 - Dispute Resolutions',
          atlas_database_name: 'Active Data',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.2.10 - Dispute Resolutions');
      expect(sorted[1].atlas_document_number).toBe('A.2.11 - Lawyer Registry Current Approved Legal Counsels');
    });

    it('sorts Active Data by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Active Data',
          atlas_document_number: 'A.2.10 - Dispute Resolutions',
          atlas_database_name: 'Active Data',
        },
        {
          sort_order: null,
          atlas_document_type: 'Active Data',
          atlas_document_number: 'A.2.11 - Lawyer Registry Current Approved Legal Counsels',
          atlas_database_name: 'Active Data',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('A.2.10 - Dispute Resolutions');
      expect(sorted[1].atlas_document_number).toBe('A.2.11 - Lawyer Registry Current Approved Legal Counsels');
    });

    it('sorts Scenarios by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Scenario',
          atlas_document_number: 'Extended Leave Of Absence',
          atlas_database_name: 'Scenarios',
        },
        {
          sort_order: null,
          atlas_document_type: 'Scenario',
          atlas_document_number: 'Alternating Between Two Roles In Separate Time Intervals',
          atlas_database_name: 'Scenarios',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('Alternating Between Two Roles In Separate Time Intervals');
      expect(sorted[1].atlas_document_number).toBe('Extended Leave Of Absence');
    });

    it('sorts Scenarios by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Scenario',
          atlas_document_number: 'Alternating Between Two Roles In Separate Time Intervals',
          atlas_database_name: 'Scenarios',
        },
        {
          sort_order: null,
          atlas_document_type: 'Scenario',
          atlas_document_number: 'Extended Leave Of Absence',
          atlas_database_name: 'Scenarios',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('Alternating Between Two Roles In Separate Time Intervals');
      expect(sorted[1].atlas_document_number).toBe('Extended Leave Of Absence');
    });

    it('sorts Scenario Variations by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Scenario Variation',
          atlas_document_number: 'Resignation Notice Not Received - var. 1',
          atlas_database_name: 'Scenario Variations',
        },
        {
          sort_order: null,
          atlas_document_type: 'Scenario Variation',
          atlas_document_number: 'Alternating Between Two Roles In Separate Time Intervals - var. 1',
          atlas_database_name: 'Scenario Variations',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('Alternating Between Two Roles In Separate Time Intervals - var. 1');
      expect(sorted[1].atlas_document_number).toBe('Resignation Notice Not Received - var. 1');
    });

    it('sorts Scenario Variations by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Scenario Variation',
          atlas_document_number: 'Alternating Between Two Roles In Separate Time Intervals - var. 1',
          atlas_database_name: 'Scenario Variations',
        },
        {
          sort_order: null,
          atlas_document_type: 'Scenario Variation',
          atlas_document_number: 'Resignation Notice Not Received - var. 1',
          atlas_database_name: 'Scenario Variations',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      // Should produce the same sorted order regardless of input order
      expect(sorted[0].atlas_document_number).toBe('Alternating Between Two Roles In Separate Time Intervals - var. 1');
      expect(sorted[1].atlas_document_number).toBe('Resignation Notice Not Received - var. 1');
    });

    it('sorts Needed Research by document number', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Needed Research',
          atlas_document_number: 'Conflicting Atlas Edit Proposals',
          atlas_database_name: 'Needed Research',
        },
        {
          sort_order: null,
          atlas_document_type: 'Needed Research',
          atlas_document_number: 'AD Budget Management',
          atlas_database_name: 'Needed Research',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted[0].atlas_document_number).toBe('AD Budget Management');
      expect(sorted[1].atlas_document_number).toBe('Conflicting Atlas Edit Proposals');
    });

    it('sorts Needed Research by document number (reversed input)', () => {
      const documents = [
        {
          sort_order: null,
          atlas_document_type: 'Needed Research',
          atlas_document_number: 'AD Budget Management',
          atlas_database_name: 'Needed Research',
        },
        {
          sort_order: null,
          atlas_document_type: 'Needed Research',
          atlas_document_number: 'Conflicting Atlas Edit Proposals',
          atlas_database_name: 'Needed Research',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      // Should produce the same sorted order regardless of input order
      expect(sorted[0].atlas_document_number).toBe('AD Budget Management');
      expect(sorted[1].atlas_document_number).toBe('Conflicting Atlas Edit Proposals');
    });
  });

  describe('Edge cases', () => {
    it('handles empty array', () => {
      const documents: Array<{
        sort_order: number | null;
        atlas_document_type: string;
        atlas_document_number: string;
        atlas_database_name: string;
      }> = [];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted).toEqual([]);
    });

    it('handles single document', () => {
      const documents = [
        {
          sort_order: 1,
          atlas_document_type: 'Section',
          atlas_document_number: 'A.1.4 - A2 - Test',
          atlas_database_name: 'Sections & Primary Docs',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      expect(sorted).toEqual(documents);
    });

    it('handles unknown database name', () => {
      const documents = [
        {
          sort_order: 1,
          atlas_document_type: 'Unknown',
          atlas_document_number: 'B.10',
          atlas_database_name: 'Unknown Database',
        },
        {
          sort_order: 1,
          atlas_document_type: 'Unknown',
          atlas_document_number: 'A.2',
          atlas_database_name: 'Unknown Database',
        },
      ];

      const sorted = sortAtlasDocuments(documents);

      // Should return 0 for unknown databases, maintaining original order
      expect(sorted[0].atlas_document_number).toBe('B.10');
      expect(sorted[1].atlas_document_number).toBe('A.2');
    });
  });
});
