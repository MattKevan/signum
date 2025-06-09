// src/app/(publishing)/edit/[siteId]/content/[[...slug]]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import MarkdownEditor from '@/components/publishing/MarkdownEditor';
import FrontmatterSidebar from '@/components/publishing/FrontmatterSidebar';
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
    const parentSlug = newMarkerIndex > 0 ? slugSegments.slice(0, newMarkerIndex).join('/') : '';
    return parentSlug ? `content/${parentSlug}` : 'content';
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
  const [layoutId, setLayoutId] = useState<string>('');
  const [slug, setSlug] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewFileMode, setIsNewFileMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const frontmatterRef = useRef<MarkdownFrontmatter | null>(null);
  useEffect(() => {
    frontmatterRef.current = currentFrontmatter;
  }, [currentFrontmatter]);

  const handleSaveContent = useCallback(async (isAutosave: boolean = false) => {
    if (!currentFrontmatter || !siteId || !layoutId) {
      if (!isAutosave) toast.error("Cannot save: Critical data is missing.");
      setAutoSaveStatus("error");
      return;
    }
    if (!currentFrontmatter.title || !(currentFrontmatter.title as string).trim()) {
      if (!isAutosave) toast.error("Title is required to save.");
      setAutoSaveStatus(isNewFileMode ? "unsaved" : "error");
      return;
    }

    if (!isAutosave) setIsSaving(true);
    setAutoSaveStatus("saving");

    let filePathToSave = currentFilePath;

    if (isNewFileMode) {
      if (!slug || !slug.trim()) {
        if (!isAutosave) toast.error("A valid slug is required. It is usually generated from the title.");
        setAutoSaveStatus("unsaved");
        if (!isAutosave) setIsSaving(false);
        return;
      }
      
      filePathToSave = `${parentPathForNewFile}/${slug}.md`.replace(/\/\//g, '/');
      
      if (site?.contentFiles.some(f => f.path === filePathToSave)) {
        if (!isAutosave) toast.error(`A file with the slug "${slug}" already exists in this location.`);
        setAutoSaveStatus("error");
        if (!isAutosave) setIsSaving(false);
        return;
      }
    }

    const rawMarkdownToSave = stringifyToMarkdown(currentFrontmatter, currentBodyContent);

    try {
      const success = await addOrUpdateContentFileAction(siteId, filePathToSave, rawMarkdownToSave, layoutId);
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
        if (!isAutosave) toast.error("Failed to save: Invalid data. Check console for details.");
        setAutoSaveStatus("error");
      }
    } catch (error) {
      console.error("Error saving content:", error);
      if (!isAutosave) toast.error(`Failed to save content: ${(error as Error).message}`);
      setAutoSaveStatus("error");
    } finally {
      if (!isAutosave) setIsSaving(false);
    }
  }, [
    currentFrontmatter, siteId, currentFilePath, slug, isNewFileMode, 
    parentPathForNewFile, site?.contentFiles, currentBodyContent, 
    addOrUpdateContentFileAction, router, layoutId
  ]);


  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    if (isNewFileMode && (!(currentFrontmatter?.title as string)?.trim() || !slug.trim())) {
        setAutoSaveStatus("unsaved");
        return;
    }
    if (!hasUnsavedChanges && autoSaveStatus !== "error") {
        setAutoSaveStatus("saved");
        return;
    }

    setAutoSaveStatus("unsaved");
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (isNewFileMode && (!(currentFrontmatter?.title as string)?.trim() || !slug.trim())) {
        console.log("Autosave for new file skipped: title or slug not ready.");
        setAutoSaveStatus("unsaved");
        return;
      }
      await handleSaveContent(true);
    }, AUTOSAVE_DELAY);
  }, [
    isNewFileMode, hasUnsavedChanges, currentFrontmatter?.title, slug,
    autoSaveStatus, handleSaveContent
  ]);


  useEffect(() => {
    setIsLoading(true);
    setHasUnsavedChanges(false);
    setAutoSaveStatus("saved");

    if (site) {
      if (isNewFileIntent) {
        setIsNewFileMode(true);
        const parentNode = findNodeByPath(site.manifest.structure, parentPathForNewFile);
        const newFileLayout = parentNode?.itemLayout as string || 'page';
        setLayoutId(newFileLayout);

        setCurrentFrontmatter({
          title: '',
          date: new Date().toISOString().split('T')[0],
          status: 'draft',
        });
        setCurrentBodyContent('');
        setSlug('');
        setCurrentFilePath('');
        setIsLoading(false);
      } else {
        setIsNewFileMode(false);
        const fileNode = findNodeByPath(site.manifest.structure, targetPathForExistingFile);
        const existingFile = site.contentFiles.find(f => f.path === targetPathForExistingFile);

        if (existingFile && fileNode) {
          setLayoutId(fileNode.layout);
          setCurrentFrontmatter(existingFile.frontmatter);
          setCurrentBodyContent(existingFile.content || '');
          setCurrentFilePath(existingFile.path);
          setSlug(existingFile.slug);
        } else {
          toast.error(`File or its manifest entry not found: ${targetPathForExistingFile}`);
          setCurrentFrontmatter(null);
          setCurrentBodyContent('');
          setLayoutId('');
          setSlug('');
        }
        setIsLoading(false);
      }
    } else if (useAppStore.getState().isInitialized && siteId) {
        toast.error(`Site with ID ${siteId} not found.`);
        setCurrentFrontmatter(null);
        setIsLoading(false);
    }
  }, [site, siteId, targetPathForExistingFile, isNewFileIntent, parentPathForNewFile]);


  useEffect(() => {
    if (!isLoading && hasUnsavedChanges) {
      triggerAutoSave();
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentFrontmatter, currentBodyContent, isLoading, hasUnsavedChanges, triggerAutoSave]);


  const handleFrontmatterChange = useCallback((newFrontmatter: MarkdownFrontmatter) => {
    const oldTitle = (frontmatterRef.current?.title as string) || '';
    const newTitle = (newFrontmatter.title as string) || '';

    if (isNewFileMode && slugify(oldTitle) === slug) {
        setSlug(slugify(newTitle));
    }

    setCurrentFrontmatter(newFrontmatter);
    setHasUnsavedChanges(true);
    setAutoSaveStatus("unsaved");
  }, [isNewFileMode, slug]); // slug is a dependency to ensure we have the latest value

  const handleBodyChange = useCallback((newBody: string) => {
    setCurrentBodyContent(newBody);
    setHasUnsavedChanges(true);
    setAutoSaveStatus("unsaved");
  }, []);

  const handleSlugChange = useCallback((newSlug: string) => {
    if (isNewFileMode) {
        setSlug(slugify(newSlug));
        setHasUnsavedChanges(true);
        setAutoSaveStatus("unsaved");
    }
  }, [isNewFileMode]);


  const handleDeleteContentFile = async () => {
    if (isNewFileMode || !currentFilePath || !site || !currentFrontmatter) {
        toast.info("Cannot delete an unsaved new file.");
        return;
    }
    try {
        await deleteContentFileAction(siteId, currentFilePath);
        toast.success(`File "${currentFrontmatter.title || currentFilePath}" deleted.`);
        const parentNodePath = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
        const parentNode = findNodeByPath(site.manifest.structure, parentNodePath);
        if (parentNode?.type === 'collection') {
            router.push(`/edit/${siteId}/collection/${parentNode.slug}`);
        } else {
            router.push(`/edit/${siteId}/settings/site`);
        }
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

  if (isLoading) {
    return <div className="p-6 flex justify-center items-center min-h-[calc(100vh-128px)]"><p>Loading editor...</p></div>;
  }
  if (!currentFrontmatter && !isNewFileMode && !isLoading) {
    return (
        <div className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Content Not Found</h2>
            <p className="text-muted-foreground mb-4">
            The content for path &quot;{targetPathForExistingFile.replace('content/', '')}&quot; could not be loaded. It may have been deleted or there could be an issue with your site&apos;s manifest.
            </p>
            <Button asChild variant="outline">
                <Link href={`/edit/${siteId}/settings/site`}>Go to Site Editor Home</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="flex flex-row h-full">
      <main className="flex-1 flex flex-col p-6 pr-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2 shrink-0">
          <h1 className="text-xl font-bold truncate">
            {isNewFileMode ? 'Create New Content' : `Edit: ${currentFrontmatter?.title || slug || 'Content'}`}
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground flex items-center min-w-[120px]">
                {renderAutoSaveIndicator()}
            </div>
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
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{currentFrontmatter?.title || currentFilePath}&quot;? This action cannot be undone.
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
              disabled={isSaving || (isNewFileMode && (!(currentFrontmatter?.title as string)?.trim() || !slug.trim()))}
              size="sm"
              title={isNewFileMode && (!(currentFrontmatter?.title as string)?.trim() || !slug.trim()) ? "Enter a title to enable saving" : "Save changes"}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {isSaving ? 'Saving...' : 'Save Now'}
            </Button>
          </div>
        </div>
        {currentFrontmatter ? (
             <div className="flex-grow overflow-y-auto">
                <MarkdownEditor
                    key={currentFilePath || 'new-file-editor'}
                    initialValue={currentBodyContent}
                    onChange={handleBodyChange}
                />
            </div>
        ) : (
            <div className="flex-grow flex items-center justify-center text-muted-foreground">
                <p>Initializing editor...</p>
            </div>
        )}
      </main>
      {currentFrontmatter && site && (
        <FrontmatterSidebar
            frontmatter={currentFrontmatter}
            onFrontmatterChange={handleFrontmatterChange}
            layoutId={layoutId}
            themeId={site.manifest.theme.name}
            themeType={site.manifest.theme.type}
            isNewFileMode={isNewFileMode}
            slug={slug}
            onSlugChange={handleSlugChange}
        />
      )}
    </div>
  );
}