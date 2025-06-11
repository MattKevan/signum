// src/app/sites/[siteId]/edit/page.tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// This page acts as a default entry point for the editor.
// It immediately redirects to the editor for the site's homepage (index.md).
export default function SiteEditorRootPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  useEffect(() => {
    if (siteId) {
      // Use `replace` to avoid adding this redirect page to the browser history.
      // This will navigate to the content editor for the file at `content/index.md`.
      router.replace(`/sites/${siteId}/edit/content/`);
    }
  }, [siteId, router]);

  // Return a loading state while the redirect is happening.
  return (
    <div className="p-6 flex justify-center items-center h-full">
      <p>Loading editor...</p>
    </div>
  );
}