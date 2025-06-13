'use client';

import { LayoutProvider } from '@/contexts/LayoutContext';
import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';
import { ReactNode } from 'react';

export default function EditSiteLayout({ children }: { children: ReactNode }) {
  return (
    <LayoutProvider>
      {({ leftSidebar, rightSidebar }) => (
        <ThreeColumnLayout
          leftSidebar={leftSidebar}
          rightSidebar={rightSidebar}
        >
          {children}
        </ThreeColumnLayout>
      )}
    </LayoutProvider>
  );
}