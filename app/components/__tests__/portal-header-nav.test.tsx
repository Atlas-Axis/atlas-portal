import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PortalHeaderNav from '../portal-header-nav';

const usePathnameMock = vi.fn<() => string>();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

function getLink(name: 'Atlas' | 'Proposal'): HTMLAnchorElement {
  const el = screen.getByRole('link', { name });
  return el as HTMLAnchorElement;
}

describe('PortalHeaderNav', () => {
  it('renders Atlas and Proposal links', () => {
    usePathnameMock.mockReturnValue('/atlas');
    render(<PortalHeaderNav />);
    expect(getLink('Atlas')).toHaveAttribute('href', '/atlas');
    expect(getLink('Proposal')).toHaveAttribute('href', '/proposal');
  });

  it('marks /atlas active on /atlas', () => {
    usePathnameMock.mockReturnValue('/atlas');
    render(<PortalHeaderNav />);
    expect(getLink('Atlas')).toHaveAttribute('aria-current', 'page');
    expect(getLink('Proposal')).not.toHaveAttribute('aria-current');
  });

  it('marks /atlas active on / (atlas serves as homepage)', () => {
    usePathnameMock.mockReturnValue('/');
    render(<PortalHeaderNav />);
    expect(getLink('Atlas')).toHaveAttribute('aria-current', 'page');
    expect(getLink('Proposal')).not.toHaveAttribute('aria-current');
  });

  it('marks /proposal active on /proposal', () => {
    usePathnameMock.mockReturnValue('/proposal');
    render(<PortalHeaderNav />);
    expect(getLink('Proposal')).toHaveAttribute('aria-current', 'page');
    expect(getLink('Atlas')).not.toHaveAttribute('aria-current');
  });

  it('marks neither active on an unknown route', () => {
    usePathnameMock.mockReturnValue('/something-else');
    render(<PortalHeaderNav />);
    expect(getLink('Atlas')).not.toHaveAttribute('aria-current');
    expect(getLink('Proposal')).not.toHaveAttribute('aria-current');
  });
});
