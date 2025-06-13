'use client';

import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';
import { ReactNode, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import SettingsNav from '@/components/publishing/SettingsNav'; // We will create this component next

// This layout sets a *fixed* left sidebar for all settings pages.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { setLeftSidebarContent, setRightSidebarContent } = useUIStore(state => state.sidebar);

  useEffect(() => {
    // On mount, tell the store what to render in the left sidebar.
    setLeftSidebarContent(<SettingsNav />);
    // Ensure the right sidebar is empty for all settings pages.
    setRightSidebarContent(null); 

    // On unmount, clean up the sidebar content.
    return () => {
      setLeftSidebarContent(null);
    };
  }, [setLeftSidebarContent, setRightSidebarContent]);

  return <ThreeColumnLayout>{children}</ThreeColumnLayout>;
}