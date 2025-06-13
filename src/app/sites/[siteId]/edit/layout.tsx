// src/app/sites/[siteId]/edit/layout.tsx
'use client';

import { EditorProvider } from '@/contexts/EditorContext';
import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';
import { ReactNode } from 'react';

/**
 * The layout for the entire editing section (/edit).
 * It provides the EditorContext for managing save state and sidebars,
 * and renders the ThreeColumnLayout which is the main UI for editing.
 * Any page inside the `/edit` directory will be rendered as a child of this layout.
 */
export default function EditSiteLayout({ children }: { children: ReactNode }) {
  return (
    // The EditorProvider MUST wrap the components that use the `useEditor` hook.
    <EditorProvider>
      {({ leftSidebar, rightSidebar }) => (
        <ThreeColumnLayout
          leftSidebar={leftSidebar}
          rightSidebar={rightSidebar}
        >
          {/* The {children} prop here will be the actual page, e.g., EditContentPage */}
          {children}
        </ThreeColumnLayout>
      )}
    </EditorProvider>
  );
}