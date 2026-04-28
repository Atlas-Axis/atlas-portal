'use client';

import React from 'react';
import { HeroUIProvider as HeroUIProviderOriginal } from '@heroui/react';

export function HeroUIProvider({ children }: { children: React.ReactNode }) {
  return <HeroUIProviderOriginal>{children}</HeroUIProviderOriginal>;
}
