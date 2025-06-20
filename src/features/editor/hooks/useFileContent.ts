// src/features/editor/hooks/useFileContent.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/EditorContext';
// REMOVED: No longer need to read directly from the file system here.
// import * as localSiteFs from '@/core/services/localFileSystem.service'; 
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';
import type { MarkdownFrontmatter } from '@/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { Block } from '@blocknote/core';
import { markdownToBlocks } from '@/core/services/blocknote.service';

export type FileStatus = 'initializing' | 'loading' | 'ready' | 'not_found';
interface PageFrontmatter extends MarkdownFrontmatter { menuTitle?: string; }

export function useFileContent(siteId: string, filePath: string, isNewFileMode: boolean) {
  const router = useRouter();
  const site = useAppStore(state => state.getSiteById(siteId));
  const { setHasUnsavedChanges } = useEditor();

  const [status, setStatus] = useState<FileStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<PageFrontmatter | null>(null);
  const [slug, setSlug] = useState('');
  const [initialBlocks, setInitialBlocks] = useState<Block[]>([]);

  useEffect(() => {
    const loadData = async () => {
      // Guard clause: wait for the site data to be fully loaded into the store.
      if (!site?.manifest || !site?.contentFiles) {
        setStatus('loading');
        return;
      }

      let markdownContent = '';

      if (isNewFileMode) {
        // Setup for a brand new, unsaved file.
        setFrontmatter({
          title: '',
          layout: DEFAULT_PAGE_LAYOUT_PATH,
          date: new Date().toISOString().split('T')[0],
          status: 'draft',
        });
        markdownContent = '# Start Writing...';
        setSlug('');
      } else {
        // --- FIX: Read directly from the hydrated Zustand store, not IndexedDB ---
        // This eliminates the race condition.
        const fileData = site.contentFiles.find(f => f.path === filePath);

        if (!fileData) {
          setStatus('not_found');
          toast.error(`Content file not found at path: ${filePath}`);
          router.push(`/sites`);
          return;
        }
        
        // Use the data already in the store. No need to re-parse.
        setFrontmatter(fileData.frontmatter);
        markdownContent = fileData.content;
        setSlug(fileData.slug);
      }

      const blocks = await markdownToBlocks(markdownContent);
      setInitialBlocks(blocks);
      setStatus('ready');
      setHasUnsavedChanges(false);
    };

    // Only run if filePath is valid. For a new site, this waits until the redirect happens.
    if (filePath) {
        loadData();
    }
    
  }, [site, filePath, isNewFileMode, siteId, router, setHasUnsavedChanges]);

  const onContentModified = useCallback(() => setHasUnsavedChanges(true), [setHasUnsavedChanges]);

  const handleFrontmatterChange = useCallback((update: Partial<PageFrontmatter>) => {
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

  return { status, site, frontmatter, initialBlocks, slug, setSlug, handleFrontmatterChange, onContentModified };
}