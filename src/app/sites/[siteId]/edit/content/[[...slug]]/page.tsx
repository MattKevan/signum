// src/app/sites/[siteId]/edit/content/[[...slug]]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useUIStore } from '@/stores/uiStore';
import { useEditor } from '@/contexts/EditorContext';
import { useAutosave } from '@/hooks/useAutosave'; // This import will now be used

// --- Component Imports ---
import MarkdownEditor, { type MarkdownEditorRef } from '@/components/publishing/MarkdownEditor';
import FrontmatterSidebar from '@/components/publishing/FrontmatterSidebar';
import PrimaryContentFields from '@/components/publishing/PrimaryContentFields';
import LeftSidebar from '@/components/publishing/LeftSidebar';

// --- Type Imports ---
import type { LocalSiteData, MarkdownFrontmatter } from '@/types';

// --- Util & Library Imports ---
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { slugify } from '@/lib/utils';
import { findNodeByPath } from '@/lib/fileTreeUtils';
import { toast } from "sonner";
import * as localSiteFs from '@/lib/localSiteFs';
import { NEW_FILE_SLUG_MARKER, DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

type StableSiteDataForSidebar = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

/**
 * The main page for editing markdown content. This component uses a robust,
 * local state management pattern to prevent common state synchronization issues.
 */
export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  const slugSegments = useMemo(() => (params.slug as string[]) || [], [params.slug]);

  // --- Store and Context Hooks ---
  const site = useAppStore(state => state.getSiteById(siteId));
  const { addOrUpdateContentFile, updateContentFileOnly, deleteContentFileAndState } = useAppStore.getState();
  const { setLeftAvailable, setRightAvailable } = useUIStore(state => state.sidebar);
  const { setHasUnsavedChanges, registerSaveAction, hasUnsavedChanges, setLeftSidebar, setRightSidebar } = useEditor();

  // --- Local State Management ---
  const [currentFrontmatter, setCurrentFrontmatter] = useState<MarkdownFrontmatter | null>(null);
  const [currentBodyContent, setCurrentBodyContent] = useState<string>(''); // Used for INITIAL value only
  const [slug, setSlug] = useState('');
  const [layoutPath, setLayoutPath] = useState('');
  const [isDataReady, setIsDataReady] = useState(false);
  const isNewFileMode = useMemo(() => slugSegments.includes(NEW_FILE_SLUG_MARKER), [slugSegments]);

  // --- Ref for Uncontrolled Data ---
  const editorRef = useRef<MarkdownEditorRef>(null);

  const currentFilePath = useMemo(() => {
    if (isNewFileMode) {
      const newMarkerIndex = slugSegments.indexOf(NEW_FILE_SLUG_MARKER);
      const parentSlug = newMarkerIndex > 0 ? slugSegments.slice(0, newMarkerIndex).join('/') : '';
      return parentSlug ? `content/${parentSlug}` : 'content';
    }
    const pathParts = slugSegments.length > 0 ? slugSegments.join('/') : 'index';
    return `content/${pathParts}.md`;
  }, [slugSegments, isNewFileMode]);

  const handleSave = useCallback(async () => {
    const bodyContent = editorRef.current?.getMarkdown();
    if (typeof bodyContent !== 'string' || !currentFrontmatter || !siteId || !layoutPath) {
      throw new Error("Cannot save: component is not ready or data is missing.");
    }
    const title = currentFrontmatter.title.trim();
    if (!title) {
      throw new Error("A title is required to save.");
    }

    const filePathToSave = isNewFileMode
      ? `${currentFilePath}/${slug.trim()}.md`.replace(/\/\//g, '/') 
      : currentFilePath;

    if (!filePathToSave.endsWith('.md')) throw new Error("Invalid file path for saving.");
    
    const rawMarkdownToSave = stringifyToMarkdown(currentFrontmatter, bodyContent);
    await addOrUpdateContentFile(siteId, filePathToSave, rawMarkdownToSave, layoutPath);

    if (isNewFileMode) {
      const newEditPath = filePathToSave.replace(/^content\//, '').replace(/\.md$/, '');
      router.replace(`/sites/${siteId}/edit/content/${newEditPath}`);
    }
  }, [currentFrontmatter, siteId, layoutPath, isNewFileMode, currentFilePath, slug, addOrUpdateContentFile, router]);
  
  const handleAutoSave = useCallback(async () => {
    const bodyContent = editorRef.current?.getMarkdown();
    if (typeof bodyContent !== 'string' || !currentFrontmatter || !currentFilePath.endsWith('.md')) return;

    const rawMarkdownToSave = stringifyToMarkdown(currentFrontmatter, bodyContent);
    const savedFile = await localSiteFs.saveContentFile(siteId, currentFilePath, rawMarkdownToSave);
    updateContentFileOnly(siteId, savedFile);
    setHasUnsavedChanges(false);
    toast.success("Autosaved", { duration: 1500 });
  }, [siteId, currentFilePath, currentFrontmatter, updateContentFileOnly, setHasUnsavedChanges]);
  
  const handleFrontmatterChange = useCallback((update: Partial<MarkdownFrontmatter>) => {
    setCurrentFrontmatter(prev => ({ ...(prev || { title: '' }), ...update }));
    if (update.title !== undefined && isNewFileMode) {
      setSlug(slugify(update.title));
    }
    setHasUnsavedChanges(true);
  }, [isNewFileMode, setHasUnsavedChanges]);

  const handleSlugChange = useCallback((newSlug: string) => {
    if (isNewFileMode) {
      setSlug(slugify(newSlug));
      setHasUnsavedChanges(true);
    }
  }, [isNewFileMode, setHasUnsavedChanges]);
  
  const handleEditorContentChange = useCallback(() => {
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  const handleDelete = useCallback(async () => {
    if (isNewFileMode || !currentFilePath.endsWith('.md')) return;
    try {
      await deleteContentFileAndState(siteId, currentFilePath);
      toast.success(`File "${currentFrontmatter?.title}" deleted.`);
      router.push(`/sites/${siteId}/edit`);
    } catch (error) { toast.error(`Failed to delete file: ${(error as Error).message}`); }
  }, [isNewFileMode, currentFilePath, siteId, currentFrontmatter, deleteContentFileAndState, router]);

  // --- Main data loading effect ---
  useEffect(() => {
    if (site?.contentFiles && !isDataReady) {
      if (isNewFileMode) {
        const parentNode = findNodeByPath(site.manifest.structure, currentFilePath);
        setLayoutPath(parentNode?.itemLayout || DEFAULT_PAGE_LAYOUT_PATH);
        setCurrentFrontmatter({ title: '', date: new Date().toISOString().split('T')[0], status: 'draft' });
        setCurrentBodyContent('# Start writing...');
        setSlug('');
      } else {
        const fileNode = findNodeByPath(site.manifest.structure, currentFilePath);
        const existingFile = site.contentFiles.find(f => f.path === currentFilePath);
        if (existingFile && fileNode) {
          setLayoutPath(fileNode.layout);
          setCurrentFrontmatter(existingFile.frontmatter);
          setCurrentBodyContent(existingFile.content || '');
          setSlug(existingFile.slug);
        } else {
          toast.error(`Content not found for this URL.`);
          router.push(`/sites/${siteId}/edit`);
          return;
        }
      }
      setIsDataReady(true);
      setHasUnsavedChanges(false);
    }
  }, [site, isDataReady, currentFilePath, isNewFileMode, router, siteId, setHasUnsavedChanges]);
  
  // --- Effect to register the manual save action ---
  useEffect(() => {
    registerSaveAction(handleSave);
  }, [handleSave, registerSaveAction]);

  // --- THIS IS THE FIX ---
  // Reinstated the call to the useAutosave hook and removed the manual timer.
  // The hook's `onSave` callback is given a function that calls `handleAutoSave`.
  // This is the clean, correct, and reusable pattern.
  useAutosave({
    dataToSave: { // The data object passed to the onSave callback if it were used
      frontmatter: currentFrontmatter,
      bodyContent: editorRef.current?.getMarkdown() || ''
    },
    hasUnsavedChanges,
    isSaveable: isDataReady && !isNewFileMode,
    onSave: () => handleAutoSave(),
  });
  // -----------------------

  // --- Effect to manage the sidebar content ---
  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebar(<LeftSidebar />);
    
    if (isDataReady && currentFrontmatter && site) {
      setRightAvailable(true);
      const siteForSidebar: StableSiteDataForSidebar = { manifest: site.manifest, layoutFiles: site.layoutFiles ?? [], themeFiles: site.themeFiles ?? [] };
      setRightSidebar(
        <FrontmatterSidebar
          site={siteForSidebar}
          layoutPath={layoutPath}
          frontmatter={currentFrontmatter}
          onFrontmatterChange={handleFrontmatterChange}
          isNewFileMode={isNewFileMode}
          slug={slug}
          onSlugChange={handleSlugChange}
          onDelete={handleDelete}
        />
      );
    } else {
      setRightAvailable(false);
      setRightSidebar(null);
    }
  }, [isDataReady, currentFrontmatter, site, layoutPath, isNewFileMode, slug, handleDelete, handleFrontmatterChange, handleSlugChange, setLeftAvailable, setRightAvailable, setLeftSidebar, setRightSidebar]);
  
  if (!isDataReady) {
    return <div className="p-6 flex justify-center items-center h-full"><p>Loading Editor...</p></div>;
  }
  
  return (
    <div className='flex h-full w-full flex-col p-6'>
      <div className='container mx-auto flex h-full max-w-[900px] flex-col'>
          <div className="shrink-0">
              <PrimaryContentFields
                  frontmatter={currentFrontmatter!}
                  onFrontmatterChange={handleFrontmatterChange}
                  showDescription={true}
              />
          </div>
          <div className="mt-6 flex-grow">
            <MarkdownEditor
              ref={editorRef}
              key={currentFilePath}
              initialValue={currentBodyContent}
              onContentChange={handleEditorContentChange}
            />
          </div>
      </div>
    </div>
  );
}