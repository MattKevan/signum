// src/features/editor/hooks/useFilePersistence.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { useEditor } from '@/features/editor/contexts/EditorContext';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';
import { toast } from 'sonner';
import type { MarkdownFrontmatter } from '@/types';
import { useUnloadPrompt } from './useUnloadPrompt';

interface PersistenceParams {
  siteId: string;
  filePath: string;
  isNewFileMode: boolean;
  frontmatter: MarkdownFrontmatter | null;
  slug: string;
  getEditorContent: () => string;
}

/**
 * Handles all "write" operations for a file: saving, autosaving, and deleting.
 */
export function useFilePersistence({
  siteId,
  filePath,
  isNewFileMode,
  frontmatter,
  slug,
  getEditorContent,
}: PersistenceParams) {
  const router = useRouter();
  const { addOrUpdateContentFile, deleteContentFileAndState } = useAppStore.getState();
  const { hasUnsavedChanges, setHasUnsavedChanges, setSaveState, registerSaveAction } = useEditor();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isInitialSaveCompleted, setInitialSaveCompleted] = useState(!isNewFileMode);
  
  const handleSave = useCallback(async () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);

    if (!frontmatter) throw new Error("Frontmatter not ready for saving.");
    if (!frontmatter.title.trim()) {
        toast.error("A title is required before saving.");
        throw new Error("A title is required.");
    }

    const markdownBody = getEditorContent();
    const finalPath = isNewFileMode ? `${filePath}/${slug.trim()}.md`.replace('//', '/') : filePath;
    const rawMarkdown = stringifyToMarkdown(frontmatter, markdownBody);

    await addOrUpdateContentFile(siteId, finalPath, rawMarkdown);

    if (isNewFileMode && !isInitialSaveCompleted) {
      setInitialSaveCompleted(true);
      const newEditPath = finalPath.replace(/^content\//, '').replace(/\.md$/, '');
      router.replace(`/sites/${siteId}/edit/content/${newEditPath}`);
    }
  }, [frontmatter, getEditorContent, isNewFileMode, filePath, slug, addOrUpdateContentFile, siteId, isInitialSaveCompleted, router]);

  const handleDelete = useCallback(async () => {
    if (isNewFileMode || !frontmatter) return;
    try {
      await deleteContentFileAndState(siteId, filePath);
      toast.success(`Page "${frontmatter.title}" deleted.`);
      router.push(`/sites/${siteId}/edit`);
    } catch (error) {
      toast.error(`Failed to delete page: ${(error as Error).message}`);
    }
    // --- FIX 2: Remove store action from dependency array ---
  }, [isNewFileMode, frontmatter, deleteContentFileAndState, siteId, filePath, router]);

  // Register the save action with the EditorContext
  useEffect(() => {
    registerSaveAction(handleSave);
  }, [handleSave, registerSaveAction]);

  // Autosave effect now correctly uses the hasUnsavedChanges from the context
  useEffect(() => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    const canAutosave = !isNewFileMode || isInitialSaveCompleted;
    if (hasUnsavedChanges && canAutosave) {
      autosaveTimeoutRef.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          await handleSave();
          setHasUnsavedChanges(false);
          setSaveState('saved');
          setTimeout(() => setSaveState('no_changes'), 2000);
        } catch (error) {
          console.error("Autosave failed:", error);
          setSaveState('idle');
        }
      }, AUTOSAVE_DELAY);
    }
    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [hasUnsavedChanges, isNewFileMode, isInitialSaveCompleted, handleSave, setSaveState, setHasUnsavedChanges]);

  // Hook to prompt user before unload
  useUnloadPrompt(isNewFileMode && hasUnsavedChanges && !isInitialSaveCompleted);

  return { handleDelete };
}