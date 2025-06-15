// src/app/sites/[siteId]/view/[[...slug]]/page.tsx
'use client';

import SitePreview from '@/features/viewer/components/SiteViewer';

export default function ViewSitePage() {
  // This page's only job is to render the master preview component.
  // The component itself will read the URL from the browser.
  return <SitePreview />;
}