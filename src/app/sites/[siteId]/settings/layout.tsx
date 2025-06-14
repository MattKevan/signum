// src/app/sites/[siteId]/settings/layout.tsx
'use client';

import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';
import SettingsNav from '@/components/publishing/SettingsNav';
import { ReactNode, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
/**
 * The root layout for the entire settings section.
 * It provides the consistent ThreeColumnLayout structure and injects the
 * a dedicated <SettingsNav /> component into the left sidebar.
 * The right sidebar is intentionally left empty for this section.
 */
export default function SettingsSectionLayout({ children }: { children: ReactNode }) {
  const { setLeftAvailable, setRightAvailable, setRightOpen } = useUIStore(state => state.sidebar);

  useEffect(() => {
    // When this layout mounts, configure the UI for the settings section.
    setLeftAvailable(true);   // Ensure the left sidebar (with SettingsNav) is available.
    setRightAvailable(false); // Mark the right sidebar as unavailable, hiding its toggle button.
    setRightOpen(false);      // Explicitly close the right sidebar in case it was open.

    // On unmount (when navigating away from settings), we can reset.
    // Setting availability to false is a safe default.
    return () => {
      setLeftAvailable(false);
      setRightAvailable(false);
    };
  }, [setLeftAvailable, setRightAvailable, setRightOpen]);

  return (
    <ThreeColumnLayout
      leftSidebar={<SettingsNav />}
      rightSidebar={null} // Pass null as content since it will be hidden.
    >
      {children}
    </ThreeColumnLayout>
  );
}