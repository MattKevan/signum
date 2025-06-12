'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import MarkdownEditor, { type MarkdownEditorRef } from '@/components/publishing/MarkdownEditor';
import FrontmatterSidebar from '@/components/publishing/FrontmatterSidebar';
import PrimaryContentFields from '@/components/publishing/PrimaryContentFields';
import { Button } from '@/components/ui/button';
import type { MarkdownFrontmatter } from '@/types';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { slugify } from '@/lib/utils';
import { toast } from "sonner";
import { Trash2, Save, Cloud, AlertCircle, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from '@/components/ui/link';
import { findNodeByPath } from '@/lib/fileTreeUtils';
import { NEW_FILE_SLUG_MARKER, AUTOSAVE_DELAY, DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

type AutoSaveStatus = "unsaved" | "saving" | "saved" | "error";

export default function EditContentPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  
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
    if (pathParts.length === 0 && siteId) return 'content/index.md';
    return `content/${pathParts.join('/')}.md`;
  }, [slugSegments, isNewFileIntent, siteId]);

  const site = useAppStore(state => state.getSiteById(siteId));
  const addOrUpdateContentFileAction = useAppStore(state => state.addOrUpdateContentFile);
  const deleteContentFileAction = useAppStore(state => state.deleteContentFileAndState);

  const [currentFrontmatter, setCurrentFrontmatter] = useState<MarkdownFrontmatter | null>(null);
  const [currentBodyContent, setCurrentBodyContent] = useState<string>('');
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  const [layoutPath, setLayoutPath] = useState<string>('');
  const [slug, setSlug] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewFileMode, setIsNewFileMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);

  const frontmatterRef = useRef<MarkdownFrontmatter | null>(null);
  useEffect(() => {
    frontmatterRef.current = currentFrontmatter;
  }, [currentFrontmatter]);

  const updateSlugFromTitle = useCallback((title: string) => {
    if (isNewFileMode) {
      setSlug(slugify(title));
    }
  }, [isNewFileMode]);

  // =========================================================================
  // --- MODIFIED SECTION 1: The Save Handler ---
  // =========================================================================
  const handleSaveContent = useCallback(async (isAutosave: boolean = false) => {
    // Revert to getting the latest content from the ref at the moment of saving.
    const latestBodyContent = editorRef.current?.getMarkdown();

    if (typeof latestBodyContent !== 'string') {
        if (!isAutosave) toast.warning("Editor is not ready, please wait a moment.");
        return;
    }

    if (!currentFrontmatter || !siteId || !layoutPath) {
      if (!isAutosave) toast.error("Cannot save: Critical data is missing.");
      setAutoSaveStatus("error");
      return;
    }
    const title = (currentFrontmatter.title as string)?.trim();
    if (!title) {
      if (!isAutosave) toast.error("A title is required to save.");
      setAutoSaveStatus(isNewFileMode ? "unsaved" : "error");
      return;
    }

    if (!isAutosave) setIsSaving(true);
    setAutoSaveStatus("saving");

    let filePathToSave = currentFilePath;

    if (isNewFileMode) {
      const currentSlug = slug.trim();
      if (!currentSlug) {
        if (!isAutosave) toast.error("A valid URL slug is required for a new file.");
        setAutoSaveStatus("unsaved");
        if (!isAutosave) setIsSaving(false);
        return;
      }
      
      filePathToSave = `${parentPathForNewFile}/${currentSlug}.md`.replace(/\/\//g, '/');
      
      if (site?.contentFiles.some(f => f.path === filePathToSave)) {
        if (!isAutosave) toast.error(`A file with the slug "${currentSlug}" already exists here.`);
        setAutoSaveStatus("error");
        if (!isAutosave) setIsSaving(false);
        return;
      }
    }

    // Use the content fetched from the ref.
    const rawMarkdownToSave = stringifyToMarkdown(currentFrontmatter, latestBodyContent);
    
    try {
      await addOrUpdateContentFileAction(siteId, filePathToSave, rawMarkdownToSave, layoutPath);
      
      // After a successful save, update the component's state to match.
      setCurrentBodyContent(latestBodyContent);

      if (!isAutosave) toast.success(`Content "${title}" saved successfully!`);
      setHasUnsavedChanges(false);
      setAutoSaveStatus("saved");
      
      if (isNewFileMode) {
        setIsNewFileMode(false);
        setCurrentFilePath(filePathToSave);
        const newEditPathSegments = filePathToSave.replace(/^content\//, '').replace(/\.md$/, '');
        router.replace(`/edit/${siteId}/content/${newEditPathSegments}`);
      }
    } catch (error) {
      console.error("Error saving content:", error);
      const errorMessage = (error as Error).message || "An unknown error occurred.";
      toast.error(`Failed to save: ${errorMessage}`);
      setAutoSaveStatus("error");
    } finally {
      if (!isAutosave) setIsSaving(false);
    }
  }, [
    // Remove currentBodyContent from the dependency array, as the ref provides the value.
    currentFrontmatter, siteId, currentFilePath, slug, isNewFileMode,
    parentPathForNewFile, site?.contentFiles, addOrUpdateContentFileAction,
    router, layoutPath
  ]);


  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    const title = (frontmatterRef.current?.title as string)?.trim();
    if (isNewFileMode && (!title || !slug.trim())) {
        setAutoSaveStatus("unsaved");
        return;
    }
    if (!hasUnsavedChanges && autoSaveStatus !== "error") {
        setAutoSaveStatus("saved");
        return;
    }

    setAutoSaveStatus("unsaved");
    autoSaveTimeoutRef.current = setTimeout(async () => {
      await handleSaveContent(true);
    }, AUTOSAVE_DELAY);
  }, [isNewFileMode, hasUnsavedChanges, slug, autoSaveStatus, handleSaveContent]);

  useEffect(() => {
    setIsLoading(true);
    setHasUnsavedChanges(false);
    setAutoSaveStatus("saved");

    if (site) {
      if (isNewFileIntent) {
        setIsNewFileMode(true);
        const parentNode = findNodeByPath(site.manifest.structure, parentPathForNewFile);
        const newFileLayout = parentNode?.itemLayout || DEFAULT_PAGE_LAYOUT_PATH;
        setLayoutPath(newFileLayout);

        setCurrentFrontmatter({ title: '', date: new Date().toISOString().split('T')[0], status: 'draft' });
        setCurrentBodyContent('# Start writing...');
        setSlug('');
        setCurrentFilePath('');
      } else {
        setIsNewFileMode(false);
        const fileNode = findNodeByPath(site.manifest.structure, targetPathForExistingFile);
        const existingFile = site.contentFiles.find(f => f.path === targetPathForExistingFile);
        if (existingFile && fileNode) {
          setLayoutPath(fileNode.layout);
          setCurrentFrontmatter(existingFile.frontmatter);
          setCurrentBodyContent(existingFile.content || '');
          setCurrentFilePath(existingFile.path);
          setSlug(existingFile.slug);
        } else {
          toast.error(`Content not found.`);
          router.push(`/edit/${siteId}`);
        }
      }
    }
    setIsLoading(false);
  }, [site, siteId, targetPathForExistingFile, isNewFileIntent, parentPathForNewFile, router]);

  // =========================================================================
  // --- MODIFIED SECTION 2: The Autosave Trigger ---
  // =========================================================================
  // The `useEffect` that triggers autosave no longer needs to depend on `currentBodyContent`.
  // It only cares about the frontmatter changing or the `hasUnsavedChanges` flag.
  useEffect(() => {
    if (!isLoading && hasUnsavedChanges) {
      triggerAutoSave();
    }
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [currentFrontmatter, isLoading, hasUnsavedChanges, triggerAutoSave]);


  const handleFrontmatterChange = useCallback((newData: Partial<MarkdownFrontmatter>) => {
    setCurrentFrontmatter(prev => ({ ...(prev || { title: '' }), ...newData }));
    if (newData.title !== undefined) {
        updateSlugFromTitle(newData.title);
    }
    setHasUnsavedChanges(true);
    setAutoSaveStatus("unsaved");
  }, [updateSlugFromTitle]);

  // =========================================================================
  // --- MODIFIED SECTION 3: The New Change Handler ---
  // =========================================================================
  // This function will be passed to the new MarkdownEditor's onContentChange prop.
  // Its only job is to signal that the content has changed and an autosave is needed.
  const handleEditorContentChange = useCallback(() => {
    setHasUnsavedChanges(true);
    setAutoSaveStatus("unsaved");
  }, []);


  const handleDeleteContentFile = async () => {
    if (isNewFileMode || !currentFilePath || !site || !currentFrontmatter) return;
    try {
        await deleteContentFileAction(siteId, currentFilePath);
        toast.success(`File "${currentFrontmatter.title || currentFilePath}" deleted.`);
        const parentNodePath = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
        const parentNode = findNodeByPath(site.manifest.structure, parentNodePath);
        if (parentNode?.type === 'collection') {
            router.push(`/edit/${siteId}/collection/${parentNode.slug}`);
        } else {
            router.push(`/edit/${siteId}`);
        }
    } catch (error) {
        toast.error(`Failed to delete file: ${(error as Error).message}`);
    }
  };

  const renderAutoSaveIndicator = () => {
    switch (autoSaveStatus) {
      case "saving": return <><Cloud className="h-4 w-4 mr-1.5 animate-pulse text-blue-500" /> Saving...</>;
      case "saved": return <><CheckCircle className="h-4 w-4 mr-1.5 text-green-500" /> Saved</>;
      case "unsaved": return <><Save className="h-4 w-4 mr-1.5 text-amber-500" /> Unsaved</>;
      case "error": return <><AlertCircle className="h-4 w-4 mr-1.5 text-red-500" /> Save error!</>;
      default: return null;
    }
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center items-center h-full"><p>Loading editor...</p></div>;
  }
  if (!currentFrontmatter && !isNewFileMode && !isLoading) {
    return (
        <div className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Content Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested content could not be loaded.</p>
            <Button asChild variant="outline">
                <Link href={`/edit/${siteId}`}>Go to Site Editor Home</Link>
            </Button>
        </div>
    );
  }

  const isSaveDisabled = isSaving || (isNewFileMode && (!(currentFrontmatter?.title as string)?.trim() || !slug.trim()));

  return (
    <div className='flex flex-row'>

      <div className=" p-6 flex-grow">

        <div className='container max-w-[900px] mx-auto'>

          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4  max-w-4xl mx-auto">
            <h1 className="text-xl font-bold truncate">
              {isNewFileMode ? 'Create New Content' : `Edit: ${currentFrontmatter?.title || slug || 'Content'}`}
            </h1>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground flex items-center min-w-[120px]">{renderAutoSaveIndicator()}</div>
              {!isNewFileMode && (
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/50">
                              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent> 
                          <AlertDialogHeader>
                              <AlertDialogTitle>Delete this content file?</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete &quot;{currentFrontmatter?.title || currentFilePath}&quot;?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteContentFile} className="bg-destructive hover:bg-destructive/90">Yes, Delete</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              )}
              <Button onClick={() => handleSaveContent(false)} disabled={isSaveDisabled} size="sm" title={isSaveDisabled ? "Enter a title to enable saving" : "Save changes"}>
                <Save className="h-4 w-4 mr-1.5" />{isSaving ? 'Saving...' : 'Save Now'}
              </Button>
            </div>
          </div>
        
          {currentFrontmatter ? (
            <>
                <PrimaryContentFields
                    frontmatter={currentFrontmatter}
                    onFrontmatterChange={handleFrontmatterChange}
                    showDescription={true}
                />
                <div className="flex-grow mt-6 h-full">
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
      
      {currentFrontmatter && site && layoutPath && (
        <div className='flex-none  sticky top-0 h-full right-0 bg-background overflow-y-auto'>
        <FrontmatterSidebar
            site={site}
            layoutPath={layoutPath}
            frontmatter={currentFrontmatter}
            onFrontmatterChange={handleFrontmatterChange}
            isNewFileMode={isNewFileMode}
            slug={slug}
            onSlugChange={(newSlug: string) => {
                if(isNewFileMode) {
                    setSlug(slugify(newSlug));
                    setHasUnsavedChanges(true);
                    setAutoSaveStatus("unsaved");
                }
            }}
        />
        </div>
      )}
    </div>
  );
}