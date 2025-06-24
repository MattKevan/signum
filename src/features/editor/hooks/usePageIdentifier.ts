// src/features/editor/hooks/usePageIdentifier.ts (CORRECTED)
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';
// FIX: Import the types needed for the new props interface.
import type { ParsedMarkdownFile, StructureNode } from '@/core/types';

// FIX: Update the props interface to accept granular data.
interface PageIdentifierParams {
  siteStructure: StructureNode[];
  allContentFiles: ParsedMarkdownFile[];
}

/**
 * A data-aware hook that parses the URL to identify the site and the specific
 * file path being targeted for editing.
 */
export function usePageIdentifier({ allContentFiles }: PageIdentifierParams) {
  const params = useParams();
  const siteId = params.siteId as string;
  const slugSegments = useMemo(() => (params.slug as string[]) || [], [params.slug]);

  const isNewFileMode = useMemo(() => slugSegments.includes(NEW_FILE_SLUG_MARKER), [slugSegments]);

  const filePath = useMemo(() => {
    if (isNewFileMode) {
      const parentSlug = slugSegments.slice(0, slugSegments.indexOf(NEW_FILE_SLUG_MARKER)).join('/');
      return parentSlug ? `content/${parentSlug}` : 'content';
    }

    const slug = slugSegments.join('/');
    
    if (slug) {
      return `content/${slug}.md`;
    }

    // Homepage Resolution Logic: Use the passed-in allContentFiles array.
    const homepageFile = allContentFiles.find(f => f.frontmatter.homepage === true);
    if (homepageFile) {
      return homepageFile.path;
    }
    
    return '';

  }, [slugSegments, isNewFileMode, allContentFiles]);

  return { siteId, slugSegments, isNewFileMode, filePath };
}