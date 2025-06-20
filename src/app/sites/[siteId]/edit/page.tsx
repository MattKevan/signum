// src/app/sites/[siteId]/edit/page.tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { toast } from 'sonner';

/**
 * A smart entry point for the site editor.
 *
 * This component's logic is now simplified:
 * 1. It waits for the site data to be fully loaded.
 * 2. If the site has pages, it finds the designated homepage (the first page)
 *    and redirects to its specific editor URL.
 * 3. If the site has NO pages, it redirects to the generic content editor URL,
 *    which will then display the "Create Your Homepage" prompt.
 */
export default function SiteEditorRootPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  const site = useAppStore(state => state.getSiteById(siteId));
  const loadingSites = useAppStore(state => state.loadingSites);

  useEffect(() => {
    // Guard Clause 1: Wait for the siteId to be available.
    if (!siteId) return;

    // Guard Clause 2: Wait for the asynchronous data loading from storage to complete.
    // The `SiteLoaderLayout` triggers this load; we just wait for it to finish.
    if (loadingSites.has(siteId) || !site) {
      return;
    }
    
    let redirectPath: string;

    // Check if the site's structure array has any pages.
    if (site.manifest.structure.length > 0) {
      // The site has pages. The homepage is always the first one.
      const homepageNode = site.manifest.structure[0];
      
      if (homepageNode) {
        // Derive the editor slug from the homepage node's actual path.
        const editorSlug = homepageNode.path.replace(/^content\//, '').replace(/\.md$/, '');
        redirectPath = `/sites/${siteId}/edit/content/${editorSlug}`;
      } else {
        // This is an edge case for a corrupted manifest.
        toast.error("Error: Site has a structure but no valid homepage found.");
        redirectPath = `/sites/${siteId}/settings`;
      }
    } else {
      // The site has NO pages. Redirect to the generic content editor,
      // which will display the "Create Your Homepage" UI.
      redirectPath = `/sites/${siteId}/edit/content`;
    }

    // Use `replace` to avoid polluting browser history with this redirect page.
    router.replace(redirectPath);

  }, [site, siteId, router, loadingSites]);

  // Display a consistent loading message while waiting for the logic to run.
  return (
    <div className="p-6 flex justify-center items-center h-full">
      <p>Loading Editor...</p>
    </div>
  );
}