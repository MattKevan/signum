// src/features/editor/hooks/usePageIdentifier.ts
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';
import type { LocalSiteData } from '@/types';

interface PageIdentifierParams {
  /** The fully loaded site data object from the Zustand store. */
  site: LocalSiteData | undefined;
}

/**
 * A data-aware hook that parses the URL to identify the site and the specific
 * file path being targeted for editing.
 *
 * Its primary responsibilities are:
 * 1.  Identifying when the user is creating a new file.
 * 2.  Resolving a URL with a slug (e.g., `/edit/content/about-us`) to a file path (`content/about-us.md`).
 * 3.  **Crucially, resolving the editor's root URL (`/edit/content`) to the site's designated homepage file path.**
 *
 * @param {PageIdentifierParams} props - Contains the loaded site data.
 * @returns An object containing the resolved `siteId`, `filePath`, and other contextual flags.
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

    // --- Logic for an existing file ---
    const slug = slugSegments.join('/');
    
    // If the URL has a specific slug, the file path is derived directly from it.
    if (slug) {
      return `content/${slug}.md`;
    }

    // **Homepage Resolution Logic**
    // If the URL has NO slug, we are at the editor's root. We must find the
    // designated homepage file from the loaded site data.
    if (site?.contentFiles) {
      const homepageFile = site.contentFiles.find(f => f.frontmatter.homepage === true);
      // Return the actual path of the homepage file.
      if (homepageFile) {
        return homepageFile.path;
      }
    }
    
    // Fallback: If data is not yet loaded or if the site is brand new and has no
    // pages (and therefore no homepage), return an empty path. The UI will handle this state.
    return '';

  }, [slugSegments, isNewFileMode, site]);

  return { siteId, slugSegments, isNewFileMode, filePath };
}