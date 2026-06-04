'use client';

import React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Theme provider for the app.
 *
 * HeroUI v3 no longer ships a `HeroUIProvider` — components are self-contained
 * and styling comes from `@heroui/styles` (imported in globals.css).
 *
 * v3's stylesheet keys dark mode off BOTH `[data-theme=dark]` (the bulk of its
 * rules) and `.dark` (https://heroui.com — "HeroUI's built-in light and dark
 * themes respond to both .light / .dark classes and data-theme attributes").
 * So next-themes must set both attributes — driving only `class` (the v2 setup)
 * leaves the data-theme rules unmatched. `attribute={['class', 'data-theme']}`
 * writes both `class="dark"` and `data-theme="dark"` on <html>, kept in sync.
 *
 * `disableTransitionOnChange` suppresses the theme-application flash: HeroUI v3's
 * `@heroui/styles` applies global `transition: background-color/color` rules, so
 * without this guard the initial theme class (and toggles) animate the color
 * change, producing a brief flash on load. next-themes momentarily injects
 * `* { transition: none }` during the change to make it instant.
 *
 * Pre-paint application of the theme (so the FIRST frame is already dark and the
 * data-theme/class are present before the stylesheets paint) is handled by the
 * blocking inline script in app/layout.tsx's <head>. This provider only keeps
 * React/next-themes state in sync after hydration; the script wins first paint.
 */
export function HeroUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute={['class', 'data-theme']}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
