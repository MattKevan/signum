// src/app/sites/[siteId]/page.tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// This page now acts as a smart entry point for a site.
// Its only job is to redirect the user to the editor.
export default function SiteRootPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  useEffect(() => {
    if (siteId) {
      // Use `replace` to avoid polluting the browser's history.
      // This sends the user directly to the site editor.
      router.replace(`/sites/${siteId}/edit`);
    }
  }, [siteId, router]);

  // Display a loading message while the redirect is processed.
  return (
    <div className="flex justify-center items-center h-full">
      <p>Redirecting to editor...</p>
    </div>
  );
}