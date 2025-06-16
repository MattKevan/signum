// src/features/editor/hooks/useContentEditorState.ts
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/EditorContext';
import type { MarkdownFrontmatter } from '@/types';
import { findNodeByPath } from '@/core/services/fileTree.service';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { parseMarkdownString, stringifyToMarkdown } from '@/lib/markdownParser';
import { slugify } from '@/lib/utils';
import { NEW_FILE_SLUG_MARKER, AUTOSAVE_DELAY, DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { toast } from 'sonner';

export type EditorStatus = 'initializing' | 'loading' | 'ready' | 'not_found' | 'error';

export function useContentEditorState(siteId: string, slugSegments: string[]) {
  const router = useRouter();
  
  // --- Global State & Contexts ---
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const { addOrUpdateContentFile, updateContentFileOnly, deleteContentFileAndState } = useAppStore.getState();
  const { setHasUnsavedChanges, registerSaveAction, setSaveState } = useEditor();
  
  // --- Local State ---
  const [status, setStatus] = useState<EditorStatus>('initializing');
  const [frontmatter, setFrontmatter] = useState<MarkdownFrontmatter | null>(null);
  const [bodyContent, setBodyContent] = useState<string>('');
  const [slug, setSlug] = useState('');

  // --- Refs for managing side effects ---
  const editorRef = useRef<{ getMarkdown: () => string } | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // --- Memoized Derived State ---
  const isNewFileMode = useMemo(() => slugSegments.includes(NEW_FILE_SLUG_MARKER), [slugSegments]);
  const currentFilePath = useMemo(() => {
    if (isNewFileMode) {
      const parentSlug = slugSegments.slice(0, slugSegments.indexOf(NEW_FILE_SLUG_MARKER)).join('/');
      return parentSlug ? `content/${parentSlug}` : 'content';
    }
    return `content/${(slugSegments.length > 0 ? slugSegments.join('/') : 'index')}.md`;
  }, [slugSegments, isNewFileMode]);

  // --- Core Actions ---

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

   const handleViewModeToggle = useCallback((isView: boolean) => {
        setFrontmatter(prev => {
            if (!prev) return null;
            if (isView) {
                // Return a new state with a default view object added
                return {
                    ...prev,
                    view: {
                        template: 'list',
                        item_layout: 'post-card',
                        sort_by: 'date',
                        sort_order: 'desc',
                    }
                };
            } else {
                // Return a new state with the view object removed
                const { view, ...rest } = prev;
                return rest;
            }
        });
        onContentModified();
    }, [onContentModified]); 

  const handleSave = useCallback(async () => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    
    const markdownBody = editorRef.current?.getMarkdown() ?? bodyContent;
    if (!frontmatter || !siteId) throw new Error("Editor not ready.");
    if (!frontmatter.title.trim()) throw new Error("A title is required.");

    const finalPath = isNewFileMode ? `${currentFilePath}/${slug.trim()}.md`.replace('//', '/') : currentFilePath;
    const rawMarkdown = stringifyToMarkdown(frontmatter, markdownBody);
    
    await addOrUpdateContentFile(siteId, finalPath, rawMarkdown, frontmatter.layout);

    if (isNewFileMode) {
      const newEditPath = finalPath.replace(/^content\//, '').replace(/\.md$/, '');
      router.replace(`/sites/${siteId}/edit/content/${newEditPath}`);
    }
  }, [frontmatter, bodyContent, siteId, isNewFileMode, currentFilePath, slug, addOrUpdateContentFile, router]);

  

  const handleDelete = useCallback(async () => {
      if(isNewFileMode) return;
      try {
        await deleteContentFileAndState(siteId, currentFilePath);
        toast.success(`Page "${frontmatter?.title}" deleted.`);
        router.push(`/sites/${siteId}/edit`);
      } catch (error) { toast.error(`Failed to delete page: ${(error as Error).message}`); }
  }, [isNewFileMode, currentFilePath, siteId, frontmatter, deleteContentFileAndState, router]);

const actions = useMemo(() => ({
    onContentModified,
    handleFrontmatterChange,
    handleDelete,
    handleViewModeToggle,
    setSlug
  }), [
    onContentModified, 
    handleFrontmatterChange, 
    handleDelete, 
    handleViewModeToggle,
    setSlug
  ]);
  // --- Side Effects ---

  // Main data loading effect
  useEffect(() => {
    const loadData = async () => {
      if (!site?.contentFiles) {
        setStatus('loading');
        return;
      }

      if (isNewFileMode) {
        setFrontmatter({
          title: '',
          layout: DEFAULT_PAGE_LAYOUT_PATH,
          date: new Date().toISOString().split('T')[0],
          status: 'draft'
        });
        setBodyContent('# Start Writing...');
        setSlug('');
      } else {
        const rawContent = await localSiteFs.getContentFileRaw(siteId, currentFilePath);
        if (rawContent === null) {
          setStatus('not_found');
          toast.error(`Content not found for this URL.`);
          router.push(`/sites/${siteId}/edit`);
          return;
        }
        const { frontmatter: fm, content } = parseMarkdownString(rawContent);
        setFrontmatter(fm);
        setBodyContent(content);
        setSlug(currentFilePath.split('/').pop()?.replace('.md', '') || '');
      }
      setStatus('ready');
      setHasUnsavedChanges(false);
    };
    loadData();
  }, [site?.contentFiles, currentFilePath, isNewFileMode, siteId, router, setHasUnsavedChanges]);

  // Register the save action with the global editor context
  useEffect(() => {
    registerSaveAction(handleSave);
  }, [handleSave, registerSaveAction]);

  // Return the public API of the hook
  return {
    status,
    site,
    isNewFileMode,
    frontmatter,
    bodyContent,
    currentFilePath,
    slug,
    editorRef,
    actions,
    
  };
}