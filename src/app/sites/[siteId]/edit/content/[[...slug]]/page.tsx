'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/useAppStore';

// --- Component Imports ---
import MarkdownEditor, { type MarkdownEditorRef } from '@/components/publishing/MarkdownEditor';
import PrimaryContentFields from '@/components/publishing/PrimaryContentFields';
import LeftSidebar from '@/components/publishing/LeftSidebar';
import FrontmatterSidebar from '@/components/publishing/FrontmatterSidebar';

// --- Type and Util Imports ---
import type { LocalSiteData, MarkdownFrontmatter } from '@/types';
import { stringifyToMarkdown, parseMarkdownString } from '@/lib/markdownParser';
import { slugify } from '@/lib/utils';
import { findNodeByPath } from '@/lib/fileTreeUtils';
import * as localSiteFs from '@/lib/localSiteFs';
import { toast } from "sonner";
import { NEW_FILE_SLUG_MARKER, AUTOSAVE_DELAY, DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

// A helper type for the stable data we need for the sidebar
type StableSiteDataForSidebar = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;

  // --- Store and Context Hooks ---
  const { setLeftSidebar, setRightSidebar } = useLayout();
  
  // --- START OF FIX: Select actions and state individually for stability ---
  const setLeftAvailable = useUIStore((state) => state.sidebar.setLeftAvailable);
  const setRightAvailable = useUIStore((state) => state.sidebar.setRightAvailable);

  // Select each piece of stable data needed for rendering. This prevents
  // re-renders when other parts of the site object (like contentFiles) change.
  const manifest = useAppStore(state => state.getSiteById(siteId)?.manifest);
  const layoutFiles = useAppStore(state => state.getSiteById(siteId)?.layoutFiles);
  const themeFiles = useAppStore(state => state.getSiteById(siteId)?.themeFiles);

  // Get actions separately. getState() does not subscribe to changes.
  const { addOrUpdateContentFile, updateContentFileOnly, deleteContentFileAndState } = useAppStore.getState();
  // --- END OF FIX ---

  // --- State Management ---
  const [currentFrontmatter, setCurrentFrontmatter] = useState<MarkdownFrontmatter | null>(null);
  const [currentBodyContent, setCurrentBodyContent] = useState<string>('');
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  const [layoutPath, setLayoutPath] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isNewFileMode, setIsNewFileMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // --- Refs ---
  const editorRef = useRef<MarkdownEditorRef>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const frontmatterRef = useRef(currentFrontmatter);
  useEffect(() => { frontmatterRef.current = currentFrontmatter; }, [currentFrontmatter]);
  
  // --- Memoized URL Parsing ---
  const slugSegments = useMemo(() => (params.slug as string[]) || [], [params.slug]);
  const isNewFileIntent = useMemo(() => slugSegments.includes(NEW_FILE_SLUG_MARKER), [slugSegments]);
  const parentPathForNewFile = useMemo(() => {
    if (!isNewFileIntent) return 'content';
    const newMarkerIndex = slugSegments.indexOf(NEW_FILE_SLUG_MARKER);
    const parentSlug = newMarkerIndex > 0 ? slugSegments.slice(0, newMarkerIndex).join('/') : '';
    return parentSlug ? `content/${parentSlug}` : 'content';
  }, [slugSegments, isNewFileIntent]);
  const targetPathForExistingFile = useMemo(() => {
    if (isNewFileIntent) return '';
    const pathParts = slugSegments.filter(s => s !== NEW_FILE_SLUG_MARKER);
    return pathParts.length === 0 ? 'content/index.md' : `content/${pathParts.join('/')}.md`;
  }, [slugSegments, isNewFileIntent]);

  // --- Callbacks ---
  const handleFrontmatterChange = useCallback((newData: Partial<MarkdownFrontmatter>) => {
    setCurrentFrontmatter(prev => {
        const newFm = { ...(prev || { title: '' }), ...newData };
        if (newData.title !== undefined && isNewFileMode) {
            setSlug(slugify(newData.title));
        }
        return newFm;
    });
    setHasUnsavedChanges(true);
  }, [isNewFileMode]);

  const handleEditorContentChange = useCallback(() => { setHasUnsavedChanges(true); }, []);

  const handleAutoSave = useCallback(async () => {
    if (isNewFileMode || !hasUnsavedChanges) return;
    const latestBodyContent = editorRef.current?.getMarkdown();
    const frontmatter = frontmatterRef.current;
    if (typeof latestBodyContent !== 'string' || !frontmatter || !currentFilePath) return;

    const rawMarkdownToSave = stringifyToMarkdown(frontmatter, latestBodyContent);
    const savedFile = await localSiteFs.saveContentFile(siteId, currentFilePath, rawMarkdownToSave);
    updateContentFileOnly(siteId, savedFile); 
    setHasUnsavedChanges(false);
    toast.success("Autosaved", { duration: 1500 });
  }, [isNewFileMode, hasUnsavedChanges, currentFilePath, siteId, updateContentFileOnly]);

  const handleManualSave = useCallback(async () => {
    const latestBodyContent = editorRef.current?.getMarkdown();
    const frontmatter = frontmatterRef.current;
    if (typeof latestBodyContent !== 'string' || !frontmatter) {
        toast.error("Cannot save, content data is missing.");
        return;
    }
    const title = (frontmatter.title as string)?.trim();
    if (!title) { toast.error("A title is required to save."); return; }
    
    let filePathToSave = currentFilePath;
    if (isNewFileMode) {
        if (!slug.trim()) { toast.error("A valid URL slug is required for a new file."); return; }
        filePathToSave = `${parentPathForNewFile}/${slug.trim()}.md`.replace(/\/\//g, '/');
    }
    if (!filePathToSave) { toast.error("Cannot save, file path is missing."); return; }
    
    const rawMarkdownToSave = stringifyToMarkdown(frontmatter, latestBodyContent);
    try {
      await addOrUpdateContentFile(siteId, filePathToSave, rawMarkdownToSave, layoutPath);
      setHasUnsavedChanges(false);
      toast.success(`File "${title}" saved successfully!`);
      if (isNewFileMode) {
        const newEditPathSegments = filePathToSave.replace(/^content\//, '').replace(/\.md$/, '');
        router.replace(`/sites/${siteId}/edit/content/${newEditPathSegments}`);
      }
    } catch (error) { toast.error(`Failed to save: ${(error as Error).message}`); }
  }, [currentFilePath, isNewFileMode, slug, parentPathForNewFile, layoutPath, siteId, addOrUpdateContentFile, router]);

  const handleDeleteContentFile = useCallback(async () => {
    if (isNewFileMode || !currentFilePath) return;
    try {
      await deleteContentFileAndState(siteId, currentFilePath);
      toast.success(`File "${currentFrontmatter?.title || currentFilePath}" deleted.`);
      router.push(`/sites/${siteId}/edit`);
    } catch (error) { toast.error(`Failed to delete file: ${(error as Error).message}`); }
  }, [isNewFileMode, currentFilePath, siteId, currentFrontmatter?.title, deleteContentFileAndState, router]);

  // --- Effects ---
  useEffect(() => {
    setIsLoading(true); setHasUnsavedChanges(false);
    async function loadContent() {
      if(!manifest) return; // Use the individually selected stable data
      if (isNewFileIntent) {
        const parentNode = findNodeByPath(manifest.structure, parentPathForNewFile);
        setLayoutPath(parentNode?.itemLayout || DEFAULT_PAGE_LAYOUT_PATH);
        setCurrentFrontmatter({ title: '', date: new Date().toISOString().split('T')[0], status: 'draft' });
        setCurrentBodyContent('# Start writing...');
        setSlug(''); setCurrentFilePath('');
        setIsNewFileMode(true);
      } else {
        const fileNode = findNodeByPath(manifest.structure, targetPathForExistingFile);
        const rawContent = await localSiteFs.getContentFileRaw(siteId, targetPathForExistingFile);
        if (fileNode && rawContent !== null) {
          const { frontmatter, content } = parseMarkdownString(rawContent);
          setLayoutPath(fileNode.layout);
          setCurrentFrontmatter(frontmatter);
          setCurrentBodyContent(content);
          setCurrentFilePath(targetPathForExistingFile);
          setSlug(fileNode.slug);
          setIsNewFileMode(false);
        } else {
          toast.error(`Content not found at path: ${targetPathForExistingFile}`);
          router.push(`/sites/${siteId}/edit`);
        }
      }
    }
    loadContent().finally(() => setIsLoading(false));
  }, [manifest, siteId, targetPathForExistingFile, isNewFileIntent, parentPathForNewFile, router]);
  
  useEffect(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    if (!isLoading && hasUnsavedChanges) {
      autoSaveTimeoutRef.current = setTimeout(handleAutoSave, AUTOSAVE_DELAY);
    }
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [hasUnsavedChanges, isLoading, handleAutoSave]);

  useEffect(() => {
    setLeftAvailable(true);
    // The availability check now uses stable dependencies
    const rightIsAvailable = !!(currentFrontmatter && manifest && layoutFiles && themeFiles && layoutPath);
    setRightAvailable(rightIsAvailable);

    setLeftSidebar(<LeftSidebar />);
    if (rightIsAvailable) {
      // Construct the object to pass to the sidebar here
      const siteForSidebar: StableSiteDataForSidebar = { manifest, layoutFiles, themeFiles };
      setRightSidebar(
        <FrontmatterSidebar
          site={siteForSidebar}
          layoutPath={layoutPath}
          frontmatter={currentFrontmatter}
          onFrontmatterChange={handleFrontmatterChange}
          isNewFileMode={isNewFileMode}
          slug={slug}
          onSlugChange={(newSlug) => {
            if (isNewFileMode) { setSlug(slugify(newSlug)); setHasUnsavedChanges(true); }
          }}
          onDelete={handleDeleteContentFile}
          onSave={handleManualSave}
        />
      );
    } else {
      setRightSidebar(null);
    }

    return () => {
      setLeftAvailable(false);
      setRightAvailable(false);
      setLeftSidebar(null);
      setRightSidebar(null);
    };
  }, [
    manifest, layoutFiles, themeFiles, layoutPath, currentFrontmatter, isNewFileMode, slug,
    handleFrontmatterChange, handleDeleteContentFile, handleManualSave,
    setLeftSidebar, setRightSidebar, setLeftAvailable, setRightAvailable
  ]);

  // --- Render Logic ---
  if (isLoading || !manifest) { return <div className="p-6 flex justify-center items-center h-full"><p>Loading editor...</p></div>; }
  if (!currentFrontmatter && !isNewFileMode && !isLoading) { return (<div className="p-6 text-center"><h2 className="text-xl font-semibold mb-4">Content Not Found</h2></div>); }
  
  return (
    <div className='flex h-full w-full flex-col p-6'>
      <div className='container mx-auto flex h-full max-w-[900px] flex-col'>
        {currentFrontmatter ? (
          <>
            {/* 2. The Title fields are a fixed-height header */}
            <div className="shrink-0">
                <PrimaryContentFields frontmatter={currentFrontmatter} onFrontmatterChange={handleFrontmatterChange} showDescription={false} />
            </div>

            {/* 3. This wrapper will grow to fill all remaining vertical space */}
            <div className="mt-6 flex-grow">
              <MarkdownEditor 
                ref={editorRef} 
                key={currentFilePath || 'new-file-editor'} 
                initialValue={currentBodyContent} 
                onContentChange={handleEditorContentChange}
              />
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center text-muted-foreground"><p>Initializing editor...</p></div>
        )}
      </div>
    </div>
  );
}