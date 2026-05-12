'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

/**
 * Header-mounted theme toggle. Single icon button that flips light ↔ dark.
 *
 * resolvedTheme is undefined on the server and during the first client render,
 * then becomes 'light' or 'dark' once next-themes mounts. We render a neutral
 * placeholder icon until it resolves and use suppressHydrationWarning to avoid
 * SSR/CSR mismatch flicker (consistent with the dropdown variant in
 * app/atlas/theme-toggle.tsx).
 */
export default function PortalThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isReady = resolvedTheme !== undefined;
  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    if (isReady) setTheme(isDark ? 'light' : 'dark');
  };

  const label = isReady ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800"
      suppressHydrationWarning
    >
      {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
