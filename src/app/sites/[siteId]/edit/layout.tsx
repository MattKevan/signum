// src/app/sites/[siteId]/edit/layout.tsx
'use client';

import { ReactNode } from 'react';

/**
 * The root layout for the /edit section.
 * In this refactored architecture, this layout has a minimal role.
 * It primarily serves as a container for the editor pages.
 * The context providers and specific layouts are now handled by the
 * page components themselves for better encapsulation.
 */
export default function EditSiteLayout({ children }: { children: ReactNode }) {
  // This layout simply renders the page that Next.js passes to it.
  return <>{children}</>;
}