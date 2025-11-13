import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AtlasChangelogPage from '../page';

// Mock the loadAtlasChangeHistory function
vi.mock('@/app/server/atlas/changelog/load-atlas-change-history', () => ({
  loadAtlasChangeHistory: vi.fn(),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  Edit3: () => <div data-testid="edit-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  List: () => <div data-testid="list-icon" />,
  Minus: () => <div data-testid="minus-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
}));

describe('AtlasChangelogPage', () => {
  it('renders the page title and description', async () => {
    const { loadAtlasChangeHistory } = await import('@/app/server/atlas/changelog/load-atlas-change-history');
    vi.mocked(loadAtlasChangeHistory).mockResolvedValue([]);

    const component = await AtlasChangelogPage();
    render(component);

    expect(screen.getByText('Atlas Changelog')).toBeInTheDocument();
    expect(screen.getByText('Recent changes to Atlas documents tracked in the system.')).toBeInTheDocument();
  });

  it('displays no changes message when no changes are found', async () => {
    const { loadAtlasChangeHistory } = await import('@/app/server/atlas/changelog/load-atlas-change-history');
    vi.mocked(loadAtlasChangeHistory).mockResolvedValue([]);

    const component = await AtlasChangelogPage();
    render(component);

    expect(screen.getByText('No Changes Found')).toBeInTheDocument();
    expect(screen.getByText('No recent changes have been detected in the Atlas documents.')).toBeInTheDocument();
  });

  it('displays changes when they exist', async () => {
    const { loadAtlasChangeHistory } = await import('@/app/server/atlas/changelog/load-atlas-change-history');
    const mockChanges = [
      {
        type: 'new' as const,
        oldPage: null,
        newPage: {
          notion_page_id: 'test-id',
          plain_text_name: 'Test Document',
          atlas_document_type: 'Core' as const,
          atlas_database_name: 'Sections & Primary Docs' as const,
          atlas_document_number: 'A.1.1',
          plain_text_content: 'Test content',
          has_children: false,
          archived: false,
          in_trash: false,
          last_edited_by_user_id: 'user-1',
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
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        changes: { properties: {} },
      },
    ];
    vi.mocked(loadAtlasChangeHistory).mockResolvedValue(mockChanges);

    const component = await AtlasChangelogPage();
    render(component);

    expect(screen.getAllByText('Test Document')).toHaveLength(2); // Appears in header and body
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Sections & Primary Docs')).toBeInTheDocument();
    expect(screen.getByText('A.1.1')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText('New document created:')).toBeInTheDocument();
  });
});
