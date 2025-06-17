// src/features/editor/hooks/useFileContent.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/EditorContext';
import * as localSiteFs from '@/core/services/localFileSystem.service'; // <-- This is now USED
import { parseMarkdownString } from '@/lib/markdownParser'; // <-- This is now USED
import { slugify } from '@/lib/utils';
import { toast } from 'sonner'; // <-- This is now USED
import type { MarkdownFrontmatter } from '@/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig'; // <-- This is now USED

export type FileStatus = 'initializing' | 'loading' | 'ready' | 'not_found';

/**
 * Manages the state of a single content file: loading it from storage
 * and handling in-memory state changes for its frontmatter and body.
 */
export function useFileContent(siteId: string, filePath: string, isNewFileMode: boolean) {
  const router = useRouter();
  const site = useAppStore(state => state.getSiteById(siteId));
  const { setHasUnsavedChanges } = useEditor();

  const [status, setStatus] = useState<FileStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<MarkdownFrontmatter | null>(null);
  const [bodyContent, setBodyContent] = useState<string>('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!site?.manifest) { // <-- Check for manifest to ensure site is at least partially loaded
        setStatus('loading');
        return;
      }

      if (isNewFileMode) {
        setFrontmatter({
          title: '',
          layout: DEFAULT_PAGE_LAYOUT_PATH, // <-- USED HERE
          date: new Date().toISOString().split('T')[0],
        });
        setBodyContent('# Start Writing...'); // <-- 'setBodyContent' IS USED HERE
        setSlug('');
      } else {
        const rawContent = await localSiteFs.getContentFileRaw(siteId, filePath); // <-- USED HERE
        if (rawContent === null) {
          setStatus('not_found');
          toast.error(`Content not found for this URL.`); // <-- USED HERE
          router.push(`/sites/${siteId}/edit`);
          return;
        }
        const { frontmatter: fm, content } = parseMarkdownString(rawContent); // <-- USED HERE
        setFrontmatter(fm);
        setBodyContent(content);
        setSlug(filePath.split('/').pop()?.replace('.md', '') || '');
      }
      setStatus('ready');
      setHasUnsavedChanges(false);
    };

    loadData();
  }, [site?.manifest, filePath, isNewFileMode, siteId, router, setHasUnsavedChanges]);

  const onContentModified = useCallback(() => {
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  const handleFrontmatterChange = useCallback((update: Partial<MarkdownFrontmatter>) => {
    setFrontmatter(prev => {
      if (!prev) return null;
      const newFm = { ...prev, ...update };
      if (isNewFileMode && update.title !== undefined) {
        setSlug(slugify(update.title));
      }
      return newFm;
    });
    onContentModified();
  }, [isNewFileMode, onContentModified]);

  return {
    status,
    site,
    frontmatter,
    bodyContent,
    slug,
    setSlug,
    handleFrontmatterChange,
    onContentModified,
  };
}