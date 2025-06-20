// src/features/editor/hooks/useFilePersistence.ts
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/EditorContext';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';
import { toast } from 'sonner';
import type { MarkdownFrontmatter } from '@/types';
import { useUnloadPrompt } from './useUnloadPrompt';
import { Block } from '@blocknote/core';
import { blocksToMarkdown } from '@/core/services/blocknote.service';

interface PersistenceParams {
  siteId: string;
  filePath: string;
  isNewFileMode: boolean;
  frontmatter: MarkdownFrontmatter | null;
  slug: string;
  getEditorContent: () => Block[]; 
}

export function useFilePersistence({
  siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent,
}: PersistenceParams) {
  const router = useRouter();
  const { addOrUpdateContentFile, deleteContentFileAndState, getSiteById } = useAppStore.getState();
  const { hasUnsavedChanges, setHasUnsavedChanges, setSaveState, registerSaveAction } = useEditor();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSave = useCallback(async () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (!frontmatter) throw new Error("Frontmatter not ready for saving.");
    if (!frontmatter.title.trim()) throw new Error("A title is required before saving.");

    const currentBlocks = getEditorContent();
    const markdownBody = await blocksToMarkdown(currentBlocks);
    
    // --- FIX: Logic is now split for Create vs. Update ---
    if (isNewFileMode) {
      // --- CREATION LOGIC (First Save) ---
      if (!slug.trim()) throw new Error("A URL slug is required for a new page.");
      
      const site = getSiteById(siteId);
      const finalPath = `${filePath}/${slug.trim()}.md`.replace('//', '/');

      // Check for path conflicts before saving
      if (site?.contentFiles?.some(f => f.path === finalPath)) {
        throw new Error(`A page with the path "${slug}" already exists.`);
      }

      const rawMarkdown = stringifyToMarkdown(frontmatter, markdownBody);
      await addOrUpdateContentFile(siteId, finalPath, rawMarkdown);

      // Transition from "creation mode" to "editing mode" by updating the URL
      const newEditPath = finalPath.replace(/^content\//, '').replace(/\.md$/, '');
      router.replace(`/sites/${siteId}/edit/content/${newEditPath}`);

    } else {
      // --- UPDATE LOGIC (Subsequent Saves) ---
      const rawMarkdown = stringifyToMarkdown(frontmatter, markdownBody);
      await addOrUpdateContentFile(siteId, filePath, rawMarkdown);
    }
  }, [siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent, addOrUpdateContentFile, getSiteById, router]);

  const handleDelete = useCallback(async () => {
    if (isNewFileMode || !frontmatter) return;
    try {
      await deleteContentFileAndState(siteId, filePath);
      toast.success(`Page "${frontmatter.title}" deleted.`);
      router.push(`/sites/${siteId}/edit`);
    } catch (error) {
      toast.error(`Failed to delete page: ${(error as Error).message}`);
    }
  }, [isNewFileMode, frontmatter, deleteContentFileAndState, siteId, filePath, router]);

  useEffect(() => {
    registerSaveAction(handleSave);
  }, [handleSave, registerSaveAction]);

  useEffect(() => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    // Autosave is disabled in new file mode until the first manual save.
    if (hasUnsavedChanges && !isNewFileMode) {
      autosaveTimeoutRef.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          await handleSave();
          setHasUnsavedChanges(false);
          setSaveState('saved');
          setTimeout(() => setSaveState('no_changes'), 2000);
        } catch (error) { console.error("Autosave failed:", error); setSaveState('idle'); }
      }, AUTOSAVE_DELAY);
    }
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [hasUnsavedChanges, isNewFileMode, handleSave, setSaveState, setHasUnsavedChanges]);

  useUnloadPrompt(hasUnsavedChanges);

  return { handleDelete };
}