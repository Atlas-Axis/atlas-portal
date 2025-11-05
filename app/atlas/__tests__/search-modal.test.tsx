import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import type { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import SearchModal from '../search-modal';

// Mock the custom events module
vi.mock('../custom-events', () => ({
  dispatchExpandScopeEvent: vi.fn(),
}));

describe('SearchModal', () => {
  const mockUuidMappings: UuidMappings = {
    atlasUUIDsToNotionPageIds: new Map(),
    notionPageIDsToAtlasUUIDs: new Map(),
  };

  const mockOnClose = vi.fn();

  const createMockDocument = (
    type: string,
    doc_no: string,
    name: string,
    content: string,
    extraFields?: Record<string, string>,
  ): StandardizedAtlasDocument =>
    ({
      type: type as StandardizedAtlasDocument['type'],
      doc_no,
      name,
      uuid: null,
      last_modified: '2025-01-01',
      content,
      ...extraFields,
    }) as StandardizedAtlasDocument;

  it('searches in standard fields (doc_no, name, content)', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Scope', 'A.1', 'Test Scope', 'This is test content'),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search by doc_no
    await user.type(input, 'A.1');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });

    // Clear and search by name
    await user.clear(input);
    await user.type(input, 'Test Scope');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });

    // Clear and search by content
    await user.clear(input);
    await user.type(input, 'test content');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });
  });

  it('searches in Type Specification extra fields and shows matched field', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Type Specification', 'A.1.1.1', 'My Type Spec', 'Standard content', {
        type_specification_type_name: 'Special Type Name',
        type_specification_type_overview: 'This is a unique overview',
        type_specification_components: 'Component A, Component B',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search by type_specification_type_name - should show the field label
    await user.type(input, 'Special Type Name');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      expect(screen.getByText('My Type Spec')).toBeInTheDocument();
      // Should show the field label and matched content
      expect(screen.getByText(/Type Name:/)).toBeInTheDocument();
    });

    // Clear and search by type_specification_type_overview
    await user.clear(input);
    await user.type(input, 'unique overview');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      expect(screen.getByText(/Type Overview:/)).toBeInTheDocument();
    });

    // Clear and search by type_specification_components
    await user.clear(input);
    await user.type(input, 'Component B');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      expect(screen.getByText(/Components:/)).toBeInTheDocument();
    });
  });

  it('searches in Scenario extra fields and shows matched field label', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Scenario', 'A.1.1.1.1', 'My Scenario', '', {
        scenario_description: 'A detailed scenario description',
        scenario_finding: 'Important finding here',
        scenario_additional_guidance: 'Follow these guidelines',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search by scenario_description - should show Description label
    await user.type(input, 'detailed scenario');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      expect(screen.getByText(/Description:/)).toBeInTheDocument();
    });

    // Clear and search by scenario_finding - should show Finding label
    await user.clear(input);
    await user.type(input, 'Important finding');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      expect(screen.getByText(/Finding:/)).toBeInTheDocument();
    });

    // Clear and search by scenario_additional_guidance - should show Additional Guidance label
    await user.clear(input);
    await user.type(input, 'guidelines');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      expect(screen.getByText(/Additional Guidance:/)).toBeInTheDocument();
    });
  });

  it('searches in Scenario Variation extra fields', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Scenario Variation', 'A.1.1.1.1.var1', 'My Variation', '', {
        scenario_variation_description: 'Variation description text',
        scenario_variation_finding: 'Variation finding',
        scenario_variation_additional_guidance: 'Variation guidance',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search by scenario_variation_description
    await user.type(input, 'Variation description');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });
  });

  it('searches in Needed Research extra fields', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Needed Research', 'NR-1', 'Research Item', '', {
        needed_research_content: 'This research is about quantum computing',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search by needed_research_content
    await user.type(input, 'quantum computing');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });
  });

  it('does not match documents without extra field content', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Section', 'A.1.1', 'Regular Section', 'Normal content'),
      createMockDocument('Type Specification', 'A.1.1.1', 'Type Spec', 'Regular content', {
        type_specification_type_name: 'Special Name',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search for text that only exists in extra fields
    await user.type(input, 'Special Name');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      // Should only show the Type Specification document
      expect(screen.getByText('Type Spec')).toBeInTheDocument();
      expect(screen.queryByText('Regular Section')).not.toBeInTheDocument();
    });
  });

  it('searches case-insensitively in extra fields', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Type Specification', 'A.1.1.1', 'Type Spec', 'Content', {
        type_specification_type_name: 'Special Type Name',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search with different casing
    await user.type(input, 'SPECIAL type NAME');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });
  });

  it('highlights matching text in extra fields when displayed', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Scenario', 'A.1.1.1.1', 'Test Scenario', '', {
        scenario_description: 'This is a test description with unique keyword',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    await user.type(input, 'unique keyword');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      // Should show the field label
      expect(screen.getByText(/Description:/)).toBeInTheDocument();
      // The search result should appear in the list
      expect(screen.getByText('Test Scenario')).toBeInTheDocument();
    });
  });

  it('shows content field when query matches content, not extra field label', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Type Specification', 'A.1.1.1', 'My Type Spec', 'This content has special text', {
        type_specification_type_name: 'Some other text',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search for text in content field
    await user.type(input, 'special text');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      // Should NOT show field label since it matched content
      expect(screen.queryByText(/Type Name:/)).not.toBeInTheDocument();
      // Should show the content
      expect(screen.getByText(/special text/)).toBeInTheDocument();
    });
  });

  it('shows extra field label only when extra field matches', async () => {
    const user = userEvent.setup();
    const scopeTrees = [
      createMockDocument('Type Specification', 'A.1.1.1', 'My Type Spec', 'Regular content here', {
        type_specification_type_name: 'Unique field text',
      }),
    ] as StandardizedAtlasDocument[];

    render(<SearchModal scopeTrees={scopeTrees} uuidMappings={mockUuidMappings} isOpen={true} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Search Atlas documents...');

    // Search for text only in extra field
    await user.type(input, 'Unique field');
    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
      // Should show field label since extra field matched
      expect(screen.getByText(/Type Name:/)).toBeInTheDocument();
      // Should NOT show content (since it doesn't match)
      expect(screen.queryByText(/Regular content/)).not.toBeInTheDocument();
    });
  });
});
