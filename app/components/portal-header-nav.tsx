'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Header nav links with subtle active-route highlighting.
 *
 * Split out as a small client component so the active-link logic is the
 * only client-side work in the header; the rest of the header
 * (logo, layout, theme-toggle wrapper) stays in a server component.
 *
 * Active match is exact (`pathname === href`). The atlas page also serves
 * at `/`, so the "Atlas" link counts both as active.
 */
const NAV = [
  {
    href: '/atlas' as const,
    label: 'Atlas',
    match: (p: string) => p === '/' || p === '/atlas' || p.startsWith('/atlas/'),
  },
  {
    href: '/proposal' as const,
    label: 'Proposal',
    match: (p: string) => p === '/proposal' || p.startsWith('/proposal/'),
  },
];

export default function PortalHeaderNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
      {NAV.map((item) => {
        const isActive = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'rounded-md px-2.5 py-1.5 font-medium text-slate-900 dark:text-slate-100'
                : 'rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
