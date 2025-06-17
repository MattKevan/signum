// src/features/editor/hooks/usePageIdentifier.ts
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

/**
 * Parses the URL to identify the site and the specific file being targeted for editing.
 */
export function usePageIdentifier() {
  const params = useParams();
  const siteId = params.siteId as string;
  const slugSegments = useMemo(() => (params.slug as string[]) || [], [params.slug]);

  const isNewFileMode = useMemo(() => slugSegments.includes(NEW_FILE_SLUG_MARKER), [slugSegments]);

  const filePath = useMemo(() => {
    if (isNewFileMode) {
      // For a new file, the path is the parent directory.
      const parentSlug = slugSegments.slice(0, slugSegments.indexOf(NEW_FILE_SLUG_MARKER)).join('/');
      return parentSlug ? `content/${parentSlug}` : 'content';
    }
    // For an existing file, it's the full path.
    return `content/${(slugSegments.length > 0 ? slugSegments.join('/') : 'index')}.md`;
  }, [slugSegments, isNewFileMode]);

  return { siteId, slugSegments, isNewFileMode, filePath };
}