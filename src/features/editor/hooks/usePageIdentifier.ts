// src/features/editor/hooks/usePageIdentifier.ts
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';
import { LocalSiteData } from '@/types'; // Import the site data type

/**
 * The hook now accepts the site data as an argument to make it smarter.
 */
interface PageIdentifierParams {
  site: LocalSiteData | undefined;
}

/**
 * Parses the URL to identify the site and the specific file being targeted for editing.
 * It is now data-aware and can correctly identify the homepage file from the root editor URL.
 */
export function usePageIdentifier({ site }: PageIdentifierParams) {
  const params = useParams();
  const siteId = params.siteId as string;
  const slugSegments = useMemo(() => (params.slug as string[]) || [], [params.slug]);

  const isNewFileMode = useMemo(() => slugSegments.includes(NEW_FILE_SLUG_MARKER), [slugSegments]);

  const filePath = useMemo(() => {
    // For creating a new file, the path is its intended parent directory.
    if (isNewFileMode) {
      const parentSlug = slugSegments.slice(0, slugSegments.indexOf(NEW_FILE_SLUG_MARKER)).join('/');
      return parentSlug ? `content/${parentSlug}` : 'content';
    }

    // --- NEW LOGIC FOR EXISTING FILES ---
    if (slugSegments.length > 0) {
      // If the URL has a slug, derive the path directly from it.
      const slug = slugSegments.join('/');
      return `content/${slug}.md`;
    } else {
      // If the URL has NO slug, it means we are at the editor root.
      // We must find the designated homepage file from the site data.
      if (site?.contentFiles) {
        const homepageFile = site.contentFiles.find(f => f.frontmatter.homepage === true);
        // Return the actual path of the homepage file.
        if (homepageFile) {
          return homepageFile.path;
        }
      }
      // Fallback while data is loading or if no homepage is set.
      return '';
    }
  }, [slugSegments, isNewFileMode, site]);

  return { siteId, slugSegments, isNewFileMode, filePath };
}