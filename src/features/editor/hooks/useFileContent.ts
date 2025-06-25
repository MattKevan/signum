// src/features/editor/hooks/useFileContent.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/EditorContext';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';
import type { MarkdownFrontmatter } from '@/core/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { Block } from '@blocknote/core';
import { markdownToBlocks } from '@/core/services/blocknote.service';

/** The possible loading states for the file content. */
export type FileStatus = 'initializing' | 'loading' | 'ready' | 'not_found';
interface PageFrontmatter extends MarkdownFrontmatter { menuTitle?: string; }

/**
 * Manages the content state for the editor.
 *
 * This hook is responsible for:
 * 1.  Taking a definitive `filePath` (from `usePageIdentifier`).
 * 2.  Waiting for the global site data to be loaded into the Zustand store.
 * 3.  **Reading the file's content directly from the store, not re-fetching it from storage.**
 * 4.  Preparing the initial state for the editor (frontmatter, Blocknote blocks).
 * 5.  Handling state changes as the user types or modifies frontmatter fields.
 *
 * @param siteId The ID of the current site.
 * @param filePath The unambiguous path to the file to be loaded.
 * @param isNewFileMode A flag indicating if we are creating a new file.
 * @returns An object containing the status, content state, and state handlers.
 */
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
      // **Guard Clause 1:** Wait until `usePageIdentifier` has resolved a valid path.
      // This prevents trying to load content for an empty or resolving path.
      if (!filePath) {
        setStatus('loading');
        return;
      }
      
      // **Guard Clause 2:** Wait for the site's content files to be fully hydrated
      // into the Zustand store from local storage. This is the key to preventing race conditions.
      if (!site?.contentFiles) {
        setStatus('loading');
        return;
      }

      let markdownContent = '';

      if (isNewFileMode) {
        // Check if this is a collection item by looking at the parent directory
        const parentPath = `${filePath}.md`; // Convert parent dir to collection page path
        const parentFile = site.contentFiles.find(f => f.path === parentPath);
        const isCollectionItem = !!parentFile?.frontmatter.collection;
        
        if (isCollectionItem) {
          // Setup for a new collection item - use parent's item_layout or empty string
          const itemLayout = String(parentFile?.frontmatter.collection?.item_layout || '');
          setFrontmatter({
            title: '',
            layout: itemLayout,
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
          });
        } else {
          // Setup for a brand new regular page
          setFrontmatter({
            title: '',
            layout: DEFAULT_PAGE_LAYOUT_PATH,
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
          });
        }
        
        markdownContent = 'Start writing...';
        setSlug('');
      } else {
        // **The Core Fix: Read directly from the hydrated Zustand store.**
        const fileData = site.contentFiles.find(f => f.path === filePath);

        if (!fileData) {
          setStatus('not_found');
          toast.error(`Content file not found at path: ${filePath}`);
          router.replace(`/sites/${siteId}/edit`); // Redirect to a safe page.
          return;
        }
        
        // Use the data already in the store. No re-fetching or re-parsing needed.
        setFrontmatter(fileData.frontmatter);
        markdownContent = fileData.content;
        setSlug(fileData.slug);
      }
      
      // Convert the markdown body into blocks for the editor.
      const blocks = await markdownToBlocks(markdownContent);
      setInitialBlocks(blocks);

      // We are ready to render the editor.
      setStatus('ready');
      setHasUnsavedChanges(false);
    };

    loadData();
    
  }, [site, filePath, isNewFileMode, siteId, router, setHasUnsavedChanges]);

  // Callback to signal that some content (either body or frontmatter) has changed.
  const onContentModified = useCallback(() => {
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  // Handler for frontmatter form changes. It receives a partial update.
  const handleFrontmatterChange = useCallback((update: Partial<PageFrontmatter>) => {
    setFrontmatter(prev => {
      if (!prev) return null;
      const newFm = { ...prev, ...update };
      // Auto-generate the slug from the title, but only for new files.
      if (isNewFileMode && update.title !== undefined) {
        setSlug(slugify(update.title));
      }
      return newFm;
    });
    onContentModified();
  }, [isNewFileMode, onContentModified]);

  return { status, frontmatter, initialBlocks, slug, setSlug, handleFrontmatterChange, onContentModified };
}