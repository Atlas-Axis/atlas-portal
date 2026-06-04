'use client';

import React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Theme provider for the app.
 *
 * HeroUI v3 no longer ships a `HeroUIProvider` — components are self-contained
 * and styling comes from `@heroui/styles` (imported in globals.css). We only
 * need next-themes here to drive the light/dark `class` on <html>.
 */
export function HeroUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
