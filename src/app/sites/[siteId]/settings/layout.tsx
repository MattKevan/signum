// src/app/sites/[siteId]/settings/layout.tsx
'use client';

import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';
import SettingsNav from '@/features/site-settings/components/SettingsNav';
import { ReactNode, useEffect } from 'react';
import { useUIStore } from '@/core/state/uiStore';

/**
 * The root layout for the entire settings section.
 * It provides the consistent ThreeColumnLayout structure and manages the
 * global UI state to ensure the left sidebar (with the settings menu) is

 * always visible and the right sidebar is always hidden.
 */
export default function SettingsSectionLayout({ children }: { children: ReactNode }) {
  // --- START: Get state and setters from the UI store ---
  const { 
    leftSidebarContent, 
    rightSidebarContent, 
    setLeftAvailable, 
    setRightAvailable, 
    setRightOpen,
    setLeftSidebarContent,
    setRightSidebarContent 
  } = useUIStore(state => state.sidebar);
  // --- END ---

  // This effect runs once to configure the sidebars for the entire settings section.
  useEffect(() => {
    // 1. Configure availability and state
    setLeftAvailable(true);
    setRightAvailable(false); // No right sidebar in settings
    setRightOpen(false);      // Ensure it's closed

    // 2. Set the static content for the left sidebar
    setLeftSidebarContent(<SettingsNav />);
    // 3. Ensure the right sidebar content is null
    setRightSidebarContent(null);

    // Cleanup when navigating away from the settings section
    return () => {
      setLeftAvailable(false);
      setLeftSidebarContent(null);
    };
  }, [setLeftAvailable, setRightAvailable, setRightOpen, setLeftSidebarContent, setRightSidebarContent]);

  // The final render now uses the ThreeColumnLayout, reading the sidebar
  // content from the store and passing it as props.
  return (
    <ThreeColumnLayout
      leftSidebar={leftSidebarContent}
      rightSidebar={rightSidebarContent} // This will be null, so nothing renders
    >
      {children}
    </ThreeColumnLayout>
  );
}