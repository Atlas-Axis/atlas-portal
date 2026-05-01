'use client';
 
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
 
/**
 * Theme toggle that flips between light and dark.
 *
 * Renders a stable placeholder on the server and during the first client render
 * to avoid a hydration mismatch (next-themes only knows the resolved theme on the client).
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
 
  useEffect(() => {
    setMounted(true);
  }, []);
 
  const isDark = mounted && resolvedTheme === 'dark';
 
  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-default-100"
    >
      {isDark ? <Sun size={16} className="text-default-500" /> : <Moon size={16} className="text-default-500" />}
      <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
