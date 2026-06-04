'use client';

import React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Theme provider for the app.
 *
 * HeroUI v3 no longer ships a `HeroUIProvider` — components are self-contained
 * and styling comes from `@heroui/styles` (imported in globals.css). We only
 * need next-themes here to drive the light/dark `class` on <html>.
 *
 * `disableTransitionOnChange` suppresses the theme-application flash: HeroUI v3's
 * `@heroui/styles` applies global `transition: background-color/color` rules, so
 * without this guard the initial theme class (and toggles) animate the color
 * change, producing a brief flash on load. next-themes momentarily injects
 * `* { transition: none }` during the change to make it instant.
 */
export function HeroUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
