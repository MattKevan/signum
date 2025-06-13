// src/app/sites/[siteId]/edit/content/[[...slug]]/page.tsx
'use client';

import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/useAppStore';
import { useEditor } from '@/contexts/EditorContext';
import { useContentEditorState } from '@/hooks/useContentEditorState';
import { useAutosave } from '@/hooks/useAutosave';
import { getParentPath } from '@/lib/fileTreeUtils'; 
import MarkdownEditor, { type MarkdownEditorRef } from '@/components/publishing/MarkdownEditor';
import PrimaryContentFields from '@/components/publishing/PrimaryContentFields';
import LeftSidebar from '@/components/publishing/LeftSidebar';
import FrontmatterSidebar from '@/components/publishing/FrontmatterSidebar';
import * as localSiteFs from '@/lib/localSiteFs';
import type { LocalSiteData, MarkdownFrontmatter } from '@/types';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { slugify } from '@/lib/utils';
import { toast } from "sonner";

type StableSiteDataForSidebar = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  const slugSegments = useMemo(() => (params.slug as string[]) || [], [params.slug]);

  const { setLeftAvailable, setRightAvailable } = useUIStore(state => state.sidebar);
  const site = useAppStore(state => state.getSiteById(siteId));
  const { addOrUpdateContentFile, updateContentFileOnly, deleteContentFileAndState } = useAppStore.getState();
  const { setLeftSidebar, setRightSidebar, setHasUnsavedChanges, registerSaveAction } = useEditor();

  // The hook now cleanly provides the status and data, abstracting away all loading complexity.
  const { status, editorState, setEditorState, isNewFileMode, currentFilePath } = useContentEditorState(siteId, slugSegments);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const handleFrontmatterUpdate = useCallback((update: Partial<MarkdownFrontmatter>) => {
    setEditorState(current => {
      if (!current || !current.frontmatter) return current;
      const newFrontmatter: MarkdownFrontmatter = { ...current.frontmatter, ...update };
      return { ...current, frontmatter: newFrontmatter };
    });
    setHasUnsavedChanges(true);
  }, [setEditorState, setHasUnsavedChanges]);

  const handleSlugUpdate = useCallback((newSlug: string) => {
    setEditorState(current => (current ? { ...current, slug: newSlug } : null));
    setHasUnsavedChanges(true);
  }, [setEditorState, setHasUnsavedChanges]);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (isNewFileMode) {
      handleFrontmatterUpdate({ title: newTitle });
      handleSlugUpdate(slugify(newTitle));
    } else {
      handleFrontmatterUpdate({ title: newTitle });
    }
  }, [isNewFileMode, handleFrontmatterUpdate, handleSlugUpdate]);

  const handleAutoSaveAction = useCallback(async (dataToSave: { frontmatter: MarkdownFrontmatter | null, bodyContent: string }) => {
    if (!dataToSave.frontmatter || !currentFilePath.endsWith('.md')) return;
    const rawMarkdownToSave = stringifyToMarkdown(dataToSave.frontmatter, dataToSave.bodyContent);
    const savedFile = await localSiteFs.saveContentFile(siteId, currentFilePath, rawMarkdownToSave);
    updateContentFileOnly(siteId, savedFile);
    setHasUnsavedChanges(false);
    toast.success("Autosaved", { duration: 1500 });
  }, [siteId, currentFilePath, updateContentFileOnly, setHasUnsavedChanges]);

  const handleManualSave = useCallback(async () => {
    if (!editorState || !editorState.frontmatter) throw new Error("State not ready for save");
    const bodyContent = editorRef.current?.getMarkdown() ?? editorState.bodyContent;
    const { frontmatter, slug, layoutPath } = editorState;
    const title = frontmatter.title.trim();
    if (!title) { toast.error("A title is required."); throw new Error("Title required"); }
    const parentPath = getParentPath(currentFilePath);
    const filePathToSave = isNewFileMode ? `${parentPath}/${slug.trim()}.md`.replace(/\/\//g, '/') : currentFilePath;
    if (!filePathToSave.endsWith('.md')) throw new Error("Invalid file path");
    const rawMarkdownToSave = stringifyToMarkdown(frontmatter, bodyContent);
    await addOrUpdateContentFile(siteId, filePathToSave, rawMarkdownToSave, layoutPath);
    toast.success(`File "${title}" saved!`);
    if (isNewFileMode) router.replace(`/sites/${siteId}/edit/content/${filePathToSave.replace(/^content\//, '').replace(/\.md$/, '')}`);
  }, [editorState, currentFilePath, isNewFileMode, siteId, addOrUpdateContentFile, router]);

  const handleDelete = useCallback(async () => {
    if (isNewFileMode || !currentFilePath.endsWith('.md')) return;
    try {
      await deleteContentFileAndState(siteId, currentFilePath);
      toast.success(`File "${editorState?.frontmatter?.title}" deleted.`);
      router.push(`/sites/${siteId}/edit`);
    } catch (error) { toast.error(`Failed to delete file: ${(error as Error).message}`); }
  }, [isNewFileMode, currentFilePath, siteId, editorState, deleteContentFileAndState, router]);
  
  useEffect(() => { registerSaveAction(handleManualSave) }, [handleManualSave, registerSaveAction]);

  useAutosave({
    dataToSave: { frontmatter: editorState?.frontmatter || null, bodyContent: editorRef.current?.getMarkdown() || editorState?.bodyContent || '' },
    hasUnsavedChanges: true,
    isSaveable: status === 'ready' && !isNewFileMode && currentFilePath.endsWith('.md'),
    onSave: handleAutoSaveAction,
  });

  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebar(<LeftSidebar />);
    const rightIsAvailable = status === 'ready' && !!editorState;
    setRightAvailable(rightIsAvailable);

    if (rightIsAvailable && site && editorState?.frontmatter) {
      const siteForSidebar: StableSiteDataForSidebar = { manifest: site.manifest, layoutFiles: site.layoutFiles ?? [], themeFiles: site.themeFiles ?? [] };
      setRightSidebar(
        <FrontmatterSidebar
          site={siteForSidebar}
          layoutPath={editorState.layoutPath}
          frontmatter={editorState.frontmatter}
          onFrontmatterChange={handleFrontmatterUpdate}
          isNewFileMode={isNewFileMode}
          slug={editorState.slug}
          onSlugChange={handleSlugUpdate}
          onDelete={handleDelete}
        />
      );
    } else {
      setRightSidebar(null);
    }
  }, [status, editorState, site, isNewFileMode, handleFrontmatterUpdate, handleSlugUpdate, handleDelete, setLeftAvailable, setRightAvailable, setLeftSidebar, setRightSidebar]);

  // --- Render Guards ---
  // This UI logic is now simple and reliable, driven entirely by the hook's status.
  if (status === 'initializing' || status === 'loading_content') {
    return <div className="p-6 flex justify-center items-center h-full"><p>Loading Site Content...</p></div>;
  }
  
  if (status === 'not_found' || !editorState) {
    return <div className="p-6 text-center"><h2 className="text-xl font-semibold mb-4">Content Not Found</h2></div>;
  }
  
  // If we reach here, status is 'ready' and editorState is guaranteed to be non-null.
  return (
    <div className='flex h-full w-full flex-col p-6'>
      <div className='container mx-auto flex h-full max-w-[900px] flex-col'>
          <div className="shrink-0">
              <PrimaryContentFields frontmatter={{ title: editorState.frontmatter.title }} onFrontmatterChange={(fm) => handleTitleChange(fm.title ?? '')} showDescription={false} />
          </div>
          <div className="mt-6 flex-grow">
            <MarkdownEditor ref={editorRef} key={currentFilePath} initialValue={editorState.bodyContent} onContentChange={() => setHasUnsavedChanges(true)} />
          </div>
      </div>
    </div>
  );
}