'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

/**
 * Theme toggle that flips between light and dark.
 *
 * resolvedTheme is undefined on the server and during the first client render,
 * then becomes 'light' or 'dark' once next-themes mounts. Until it resolves,
 * we render a neutral placeholder so SSR markup matches the first client render.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isReady = resolvedTheme !== undefined;
  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    if (isReady) setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className="hover:bg-default-100 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
      suppressHydrationWarning
    >
      {isDark ? <Sun size={16} className="text-default-500" /> : <Moon size={16} className="text-default-500" />}
      <span suppressHydrationWarning>{isReady ? (isDark ? 'Light mode' : 'Dark mode') : 'Theme'}</span>
    </button>
  );
}
