import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import TypeChip from '../type-chip';

describe('TypeChip', () => {
  it('renders the provided type text', () => {
    render(<TypeChip type={'Section' as AtlasDocumentType} />);
    expect(screen.getByText('Section')).toBeInTheDocument();
  });
});
