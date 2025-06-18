// src/features/editor/hooks/useFileContent.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/EditorContext';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { parseMarkdownString } from '@/lib/markdownParser';
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';
import type { MarkdownFrontmatter } from '@/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

// Import the new Blocknote types and conversion service
import { Block } from '@blocknote/core';
import { markdownToBlocks } from '@/core/services/blocknote.service';

export type FileStatus = 'initializing' | 'loading' | 'ready' | 'not_found';

/**
 * Manages the state of a single content file for the editor.
 * It handles loading the raw Markdown, parsing it, converting the body
 * to Blocknote's format, and managing in-memory state for frontmatter and slugs.
 */
export function useFileContent(siteId: string, filePath: string, isNewFileMode: boolean) {
  const router = useRouter();
  const site = useAppStore(state => state.getSiteById(siteId));
  const { setHasUnsavedChanges } = useEditor();

  const [status, setStatus] = useState<FileStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<MarkdownFrontmatter | null>(null);
  const [slug, setSlug] = useState('');
  
  // This state now holds the Blocknote-compatible JSON for the editor.
  const [initialBlocks, setInitialBlocks] = useState<Block[]>([]);

  useEffect(() => {
    const loadData = async () => {
      // Wait until the site's manifest is loaded into the store
      if (!site?.manifest) {
        setStatus('loading');
        return;
      }

      let markdownContent = '';
      if (isNewFileMode) {
        // Setup default state for a brand new, unsaved file
        setFrontmatter({
          title: '',
          layout: DEFAULT_PAGE_LAYOUT_PATH,
          date: new Date().toISOString().split('T')[0],
          status: 'draft',
        });
        markdownContent = '# Start Writing...';
        setSlug('');
      } else {
        // Load an existing file from storage
        const rawContent = await localSiteFs.getContentFileRaw(siteId, filePath);
        if (rawContent === null) {
          setStatus('not_found');
          toast.error(`Content file not found for this URL.`);
          router.push(`/sites/${siteId}/edit`);
          return;
        }
        const { frontmatter: fm, content } = parseMarkdownString(rawContent);
        setFrontmatter(fm);
        markdownContent = content;
        setSlug(filePath.split('/').pop()?.replace('.md', '') || '');
      }

      // Asynchronously convert the loaded markdown string to Blocknote's format
      const blocks = await markdownToBlocks(markdownContent);
      setInitialBlocks(blocks);
      
      setStatus('ready');
      setHasUnsavedChanges(false);
    };

    loadData();
  }, [site?.manifest, filePath, isNewFileMode, siteId, router, setHasUnsavedChanges]);

  /**
   * A callback passed to the editor to signal that its content has changed.
   * This sets the global "unsaved changes" flag.
   */
  const onContentModified = useCallback(() => {
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  /**
   * A callback to handle changes to frontmatter fields. It updates the
   * local frontmatter state and also auto-generates the slug if the title
   * is changed on a new file.
   */
  const handleFrontmatterChange = useCallback((update: Partial<MarkdownFrontmatter>) => {
    setFrontmatter(prev => {
      if (!prev) return null;
      const newFm = { ...prev, ...update };
      if (isNewFileMode && update.title !== undefined) {
        setSlug(slugify(update.title));
      }
      return newFm;
    });
    onContentModified(); // Any frontmatter change is considered an unsaved change
  }, [isNewFileMode, onContentModified]);

  return {
    status,
    site,
    frontmatter,
    initialBlocks,
    slug,
    setSlug,
    handleFrontmatterChange,
    onContentModified,
  };
}