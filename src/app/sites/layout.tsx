// src/app/sites/[siteId]/layout.tsx
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';

export default function SiteLoaderLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const siteId = params.siteId as string;

  // --- USE THE NEW ACTION ---
  const loadSiteAction = useAppStore(state => state.loadSite);
  
  useEffect(() => {
    if (siteId) {
      // This will now reliably load the manifest and content files.
      loadSiteAction(siteId);
    }
  }, [siteId, loadSiteAction]);

  return <>{children}</>;
}