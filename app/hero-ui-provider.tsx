'use client';
 
import React from 'react';
import { HeroUIProvider as HeroUIProviderOriginal } from '@heroui/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
 
export function HeroUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <HeroUIProviderOriginal>{children}</HeroUIProviderOriginal>
    </NextThemesProvider>
  );
}
 