// src/app/(publishing)/[siteId]/edit/page.tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// This page now simply redirects to the site settings page by default.
export default function SiteEditorRootPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  useEffect(() => {
    if (siteId) {
    }
  }, [siteId, router]);

  return (
    <div className="p-6 flex justify-center items-center h-full">
      <p>Redirecting to site settings...</p>
    </div>
  );
}