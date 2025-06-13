// src/app/sites/[siteId]/layout.tsx
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';

/**
 * Site Loader Root Layout
 * 
 * This layout component has no UI. Its sole responsibility is to act as a wrapper
 * for all routes under /sites/[siteId]/. It ensures that the necessary content
 * files for a given site are loaded into the application's state as soon as a user
 * navigates to any page within that site's context (e.g., edit, settings, or view).
 */
export default function SiteLoaderLayout({ children }: { children: React.ReactNode }) {
  // Get the current siteId from the URL parameters.
  const params = useParams();
  const siteId = params.siteId as string;

  // Get the lazy-loading action from our Zustand store.
  const loadContentForSite = useAppStore(state => state.loadContentForSite);
  
  // This effect runs when the component mounts or when the siteId changes.
  useEffect(() => {
    // If we have a valid siteId, we trigger the action to load its content.
    // The action itself is idempotent; it won't re-fetch data if it's already loaded.
    if (siteId) {
      loadContentForSite(siteId);
    }
  }, [siteId, loadContentForSite]); // Dependency array ensures this runs only when needed.

  // Render the actual page content that this layout is wrapping.
  return <>{children}</>;
}