import Image from 'next/image';
import Link from 'next/link';
import PortalHeaderNav from './portal-header-nav';
import PortalThemeToggle from './portal-theme-toggle';

/**
 * Small shared header rendered above every route by the root layout.
 *
 * Design: borderless / frosted-glass, sticky to top, doesn't compete with
 * page content. Server-rendered except for two small client islands:
 *   - PortalHeaderNav (needs usePathname for active-route highlight)
 *   - PortalThemeToggle (needs useTheme)
 *
 * Stays mobile-friendly with the two nav links visible at all widths;
 * no hamburger menu — the link count is small enough to keep flat.
 */
export default function PortalHeader() {
  return (
    <header
      role="banner"
      className="sticky top-0 z-40 bg-white/70 backdrop-blur-md backdrop-saturate-150 dark:bg-zinc-950/70"
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            href="/"
            aria-label="Sky Atlas — home"
            className="flex items-center gap-2 text-slate-900 dark:text-slate-100"
          >
            <Image
              src="/images/sky.png"
              alt=""
              aria-hidden
              width={20}
              height={20}
              priority
              className="object-contain"
            />
            <span className="text-sm font-semibold tracking-tight">Sky Atlas</span>
          </Link>
          <PortalHeaderNav />
        </div>
        <div className="flex items-center gap-1">
          <PortalThemeToggle />
        </div>
      </div>
    </header>
  );
}
