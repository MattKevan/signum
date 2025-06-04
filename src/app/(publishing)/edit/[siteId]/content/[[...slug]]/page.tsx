// src/app/(publishing)/edit/[siteId]/content/[[...slug]]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import MarkdownEditor from '@/components/publishing/MarkdownEditor';
import FrontmatterSidebar from '@/components/publishing/FrontmatterSidebar';
import { Button } from '@/components/ui/button';
import type { MarkdownFrontmatter } from '@/types';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { stringifyToMarkdown } from '@/lib/markdownParser'; // Removed unused: parseMarkdownString
import { slugify } from '@/lib/utils';
import { toast } from "sonner";
import { Trash2, Save, Cloud, AlertCircle, CheckCircle } from 'lucide-react';
// import Link from 'next/link'; // Not used directly in this version of UI
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

const NEW_FILE_SLUG_MARKER = '_new';
const AUTOSAVE_DELAY = 2500;

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
    return newMarkerIndex > 0 ? `content/${slugSegments.slice(0, newMarkerIndex).join('/')}` : 'content';
  }, [slugSegments, isNewFileIntent]);

  const targetPathForExistingFile = useMemo(() => {
    if (isNewFileIntent) return '';
    const pathParts = slugSegments.filter(s => s !== NEW_FILE_SLUG_MARKER);
    if (pathParts.length === 0 && siteId) return 'content/index.md';
    return `content/${pathParts.join('/')}.md`;
  }, [slugSegments, isNewFileIntent, siteId]);

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const addOrUpdateContentFileAction = useAppStore(state => state.addOrUpdateContentFile);
  const deleteContentFileAction = useAppStore(state => state.deleteContentFileAndState);

  const [currentFrontmatter, setCurrentFrontmatter] = useState<MarkdownFrontmatter | null>(null);
  const [currentBodyContent, setCurrentBodyContent] = useState<string>('');
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewFileMode, setIsNewFileMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [proposedSlugForNewFile, setProposedSlugForNewFile] = useState<string>('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSaveContent = useCallback(async (isAutosave: boolean = false) => {
    // This function needs access to component state like currentFrontmatter, siteId, etc.
    // So, it's defined inside the component.
    // The dependency array for its own useCallback will be crucial.

    if (!currentFrontmatter || !siteId) {
      if (!isAutosave) toast.error("Cannot save: Critical data is missing.");
      setAutoSaveStatus("error");
      return;
    }
    if (!currentFrontmatter.title || !currentFrontmatter.title.trim()) {
      if (!isAutosave) toast.error("Title is required to save.");
      setAutoSaveStatus(isNewFileMode ? "unsaved" : "error");
      return;
    }

    if (!isAutosave) setIsSaving(true);
    setAutoSaveStatus("saving");

    let filePathToSave = currentFilePath;
    let finalSlug = proposedSlugForNewFile;

    if (isNewFileMode) {
      if (!finalSlug || !finalSlug.trim()) {
        finalSlug = slugify(currentFrontmatter.title);
      }
      if (!finalSlug || !finalSlug.trim()) {
        if (!isAutosave) toast.error("A valid slug could not be generated. Please provide a valid title or manually enter a slug.");
        setAutoSaveStatus("unsaved");
        if (!isAutosave) setIsSaving(false);
        return;
      }
      
      filePathToSave = `${parentPathForNewFile}/${finalSlug}.md`.replace(/\/\//g, '/');
      
      if (site?.contentFiles.some(f => f.path === filePathToSave)) {
        if (!isAutosave) toast.error(`A file named "${finalSlug}.md" already exists. Please choose a different title or slug.`);
        setAutoSaveStatus("error");
        if (!isAutosave) setIsSaving(false);
        return;
      }
    }

    const rawMarkdownToSave = stringifyToMarkdown(currentFrontmatter, currentBodyContent);

    try {
      const success = await addOrUpdateContentFileAction(siteId, filePathToSave, rawMarkdownToSave);
      if (success) {
        if (!isAutosave) toast.success(`Content "${currentFrontmatter.title}" saved successfully!`);
        setHasUnsavedChanges(false);
        setAutoSaveStatus("saved");
        
        if (isNewFileMode) {
          setIsNewFileMode(false);
          setCurrentFilePath(filePathToSave);
          const newEditPathSegments = filePathToSave.replace(/^content\//, '').replace(/\.md$/, '');
          router.replace(`/edit/${siteId}/content/${newEditPathSegments}`);
        }
      } else {
        if (!isAutosave) toast.error("Failed to save: Invalid frontmatter. Check console.");
        setAutoSaveStatus("error");
      }
    } catch (error) {
      console.error("Error saving content:", error);
      if (!isAutosave) toast.error(`Failed to save content: ${(error as Error).message}`);
      setAutoSaveStatus("error");
    } finally {
      if (!isAutosave) setIsSaving(false);
    }
  }, [ // Dependencies for handleSaveContent
    currentFrontmatter, siteId, currentFilePath, proposedSlugForNewFile, isNewFileMode, 
    parentPathForNewFile, site?.contentFiles, currentBodyContent, 
    addOrUpdateContentFileAction, router // Note: `site` can be just `site?.contentFiles` if that's all that's needed
  ]);


  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    if (isNewFileMode && (!currentFrontmatter?.title?.trim() || !proposedSlugForNewFile.trim())) {
        setAutoSaveStatus("unsaved");
        return;
    }
    if (!hasUnsavedChanges && autoSaveStatus !== "error") {
        setAutoSaveStatus("saved");
        return;
    }

    setAutoSaveStatus("unsaved");
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (isNewFileMode && (!currentFrontmatter?.title?.trim() || !proposedSlugForNewFile.trim())) {
        console.log("Autosave for new file skipped: title or slug not ready.");
        setAutoSaveStatus("unsaved");
        return;
      }
      await handleSaveContent(true);
    }, AUTOSAVE_DELAY);
  }, [ // Dependencies for triggerAutoSave
    isNewFileMode, hasUnsavedChanges, currentFrontmatter?.title, proposedSlugForNewFile, 
    autoSaveStatus, handleSaveContent // Added autoSaveStatus and handleSaveContent
  ]);


  useEffect(() => {
    setIsLoading(true);
    setHasUnsavedChanges(false);
    setAutoSaveStatus("saved");

    if (site) {
      if (isNewFileIntent) {
        setIsNewFileMode(true);
        setCurrentFrontmatter({
          title: '',
          date: new Date().toISOString().split('T')[0],
          status: 'draft',
          summary: '',
          tags: [],
        });
        setCurrentBodyContent('');
        setProposedSlugForNewFile('');
        setCurrentFilePath('');
        setIsLoading(false);
      } else {
        setIsNewFileMode(false);
        const existingFile = site.contentFiles.find(f => f.path === targetPathForExistingFile);
        if (existingFile) {
          const fm = typeof existingFile.frontmatter === 'object' && existingFile.frontmatter !== null 
                       ? existingFile.frontmatter 
                       : { title: existingFile.slug };
          setCurrentFrontmatter(fm as MarkdownFrontmatter);
          setCurrentBodyContent(existingFile.content || '');
          setCurrentFilePath(existingFile.path);
          setProposedSlugForNewFile(existingFile.slug);
        } else {
          toast.error(`File not found: ${targetPathForExistingFile}`);
          setCurrentFrontmatter(null);
          setCurrentBodyContent('');
        }
        setIsLoading(false);
      }
    } else if (useAppStore.getState().isInitialized && siteId) {
        toast.error(`Site with ID ${siteId} not found.`);
        setCurrentFrontmatter(null);
        setIsLoading(false);
    }
  }, [site, siteId, targetPathForExistingFile, isNewFileIntent]);


  useEffect(() => {
    // This effect should run whenever content changes that needs to be autosaved.
    if (!isLoading && (currentFrontmatter || currentBodyContent) && hasUnsavedChanges) {
      triggerAutoSave();
    }
    // Cleanup timeout on component unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentFrontmatter, currentBodyContent, isLoading, hasUnsavedChanges, triggerAutoSave]);


  const handleFrontmatterChange = useCallback((newFrontmatter: MarkdownFrontmatter) => {
    setCurrentFrontmatter(newFrontmatter);
    setHasUnsavedChanges(true);
    setAutoSaveStatus("unsaved");
    if (isNewFileMode && typeof newFrontmatter.title === 'string') {
        setProposedSlugForNewFile(slugify(newFrontmatter.title));
    }
  }, [isNewFileMode]);

  const handleBodyChange = useCallback((newBody: string) => {
    setCurrentBodyContent(newBody);
    setHasUnsavedChanges(true);
    setAutoSaveStatus("unsaved");
  }, []);

  const handleProposedSlugChange = useCallback((newSlug: string) => {
    if (isNewFileMode) {
        setProposedSlugForNewFile(slugify(newSlug));
        setHasUnsavedChanges(true);
        setAutoSaveStatus("unsaved");
    }
  }, [isNewFileMode]);


  const handleDeleteContentFile = async () => {
    if (isNewFileMode || !currentFilePath || !site || !currentFrontmatter) {
        toast.info("Cannot delete an unsaved new file or if file path is missing.");
        return;
    }
    try {
        await deleteContentFileAction(siteId, currentFilePath);
        toast.success(`File "${currentFrontmatter.title || currentFilePath}" deleted.`);
        router.push(`/edit/${siteId}`); 
    } catch (error) {
        toast.error(`Failed to delete file: ${(error as Error).message}`);
        console.error("Error deleting file:", error);
    }
  };

  const renderAutoSaveIndicator = () => {
    switch (autoSaveStatus) {
      case "saving":
        return <><Cloud className="h-4 w-4 mr-1.5 animate-pulse text-blue-500" /> Saving...</>;
      case "saved":
        return <><CheckCircle className="h-4 w-4 mr-1.5 text-green-500" /> Saved</>;
      case "unsaved":
        return <><Save className="h-4 w-4 mr-1.5 text-amber-500" /> Unsaved changes</>;
      case "error":
        return <><AlertCircle className="h-4 w-4 mr-1.5 text-red-500" /> Save error!</>;
      default:
        return null;
    }
  };

  // MOVED LOADING/ERROR RETURNS HERE, INSIDE THE FUNCTION BODY
  if (isLoading) {
    return <div className="p-6 flex justify-center items-center min-h-[calc(100vh-128px)]"><p>Loading editor...</p></div>;
  }
  if (!currentFrontmatter && !isNewFileMode && !isLoading) {
    return (
        <div className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Content Not Found</h2>
            <p className="text-muted-foreground mb-4">
            The content for path &quot;{targetPathForExistingFile.replace('content/', '')}&quot; could not be loaded.
            </p>
            <Button asChild variant="outline">
                <Link href={`/edit/${siteId}`}>Go to Site Editor Home</Link>
            </Button>
        </div>
    );
  }
   if (!site && siteId && !isLoading) { 
    return <div className="p-6 text-center"><p>Site data for ID &quot;{siteId}&quot; not available.</p></div>;
  }

  return (
    <div className="flex flex-row h-full">
      <main className="flex-1 flex flex-col p-6 pr-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2 shrink-0">
          <h1 className="text-xl font-bold truncate">
            {isNewFileMode ? 'Create New Content' : `Edit: ${currentFrontmatter?.title || proposedSlugForNewFile || 'Content'}`}
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground flex items-center min-w-[120px]">
                {renderAutoSaveIndicator()}
            </div>
            {!isNewFileMode && currentFilePath && currentFrontmatter && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/50">
                            <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent> 
                        <AlertDialogHeader>
                        <AlertDialogTitle>Delete this content file?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{currentFrontmatter.title || currentFilePath}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteContentFile} className="bg-destructive hover:bg-destructive/90">
                            Yes, Delete File
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            <Button 
              onClick={() => handleSaveContent(false)}
              disabled={isSaving || (isNewFileMode && (!currentFrontmatter?.title?.trim() || !proposedSlugForNewFile.trim()))}
              size="sm"
              title={isNewFileMode && (!currentFrontmatter?.title?.trim() || !proposedSlugForNewFile.trim()) ? "Enter a title to enable saving" : "Save changes"}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {isSaving ? 'Saving...' : 'Save Now'}
            </Button>
          </div>
        </div>
        {currentFrontmatter && (
             <div className="flex-grow overflow-y-auto">
                <MarkdownEditor
                    key={currentFilePath || 'new-file-editor'}
                    initialValue={currentBodyContent}
                    onChange={handleBodyChange}
                />
            </div>
        )}
         {!currentFrontmatter && isNewFileMode && (
            <div className="flex-grow flex items-center justify-center text-muted-foreground">
                <p>Initializing new content editor...</p>
            </div>
        )}
      </main>
      {currentFrontmatter && (
        <FrontmatterSidebar
            frontmatter={currentFrontmatter}
            onFrontmatterChange={handleFrontmatterChange}
            isNewFileMode={isNewFileMode}
            proposedSlug={proposedSlugForNewFile}
            onProposedSlugChange={handleProposedSlugChange}
        />
      )}
    </div>
  );
}