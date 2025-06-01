// src/app/(publishing)/edit/[siteId]/content/[[...slug]]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation'; // useRouter might be useful later
import { useAppStore } from '@/stores/useAppStore';
import MarkdownEditor from '@/components/publishing/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { ParsedMarkdownFile, MarkdownFrontmatter } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { stringifyToMarkdown, parseMarkdownString } from '@/lib/markdownParser';
import { toast } from "sonner";

export default function EditContentPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const slugArray = (params.slug as string[]) || []; // Ensure slugArray is always an array

  // Memoized selectors for store state and actions
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const addOrUpdateContentFileAction = useAppStore(state => state.addOrUpdateContentFile);

  // State for the currently edited file's data (parsed structure)
  const [currentFile, setCurrentFile] = useState<ParsedMarkdownFile | null>(null);
  // State for the raw markdown content in the editor (includes frontmatter + body)
  const [editorContent, setEditorContent] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isNewFileMode, setIsNewFileMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Determine the target path from URL slugs
  const targetPath = `content/${slugArray.join('/')}${slugArray.length > 0 ? '.md' : 'index.md'}`;


  useEffect(() => {
    if (site) {
      const existingFile = site.contentFiles.find(f => f.path === targetPath);
      if (existingFile) {
        setCurrentFile(existingFile);
        setEditorContent(stringifyToMarkdown(existingFile.frontmatter, existingFile.content));
        setIsNewFileMode(false);
      } else {
        // Setup for a new file if no existing file matches the path
        const newSlug = slugArray.length > 0 ? slugArray[slugArray.length - 1] : 'index';
        const defaultFrontmatter: MarkdownFrontmatter = { title: newSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'New Page' };
        const defaultBody = `# ${defaultFrontmatter.title}\n\nStart writing your content here.`;
        
        const newFilePlaceholder: ParsedMarkdownFile = {
            slug: newSlug,
            path: targetPath,
            frontmatter: defaultFrontmatter,
            content: defaultBody, // body content only
        };
        setCurrentFile(newFilePlaceholder);
        setEditorContent(stringifyToMarkdown(newFilePlaceholder.frontmatter, newFilePlaceholder.content));
        setIsNewFileMode(true);
      }
      setHasUnsavedChanges(false); // Reset unsaved changes flag when file loads/changes
    }
  }, [site, targetPath]); // Re-run when site data or targetPath changes

  const handleEditorChange = useCallback((newRawMarkdown: string) => {
    setEditorContent(newRawMarkdown);
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveContent = async () => {
    if (!currentFile || !siteId) {
        toast.error("Cannot save: File or site data is missing.");
        return;
    }
    setIsLoading(true);
    try {
      // The editorContent (rawMarkdown) is passed to the store action
      // The store action calls localSiteFs.saveContentFile, which handles parsing
      await addOrUpdateContentFileAction(siteId, currentFile.path, editorContent);
      
      // After successful save, update currentFile state with potentially parsed data
      // This is important if frontmatter was malformed and fixed by parser, or for new files.
      const { frontmatter, content: bodyContent } = parseMarkdownString(editorContent);
      setCurrentFile(prev => prev ? {...prev, frontmatter, content: bodyContent} : null);

      toast.success(`Content for "${currentFile.frontmatter.title || currentFile.slug}" saved successfully!`);
      setIsNewFileMode(false); // If it was a new file, it's now an existing file
      setHasUnsavedChanges(false);
    } catch (error) {
      // The parseMarkdownString can throw if frontmatter is invalid.
      // The store action might also throw if localSiteFs fails.
      console.error("Error saving content:", error);
      toast.error(`Failed to save content: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!site) {
    return <p className="p-4">Loading site data or site not found...</p>;
  }
  if (!currentFile) {
     // This state occurs while useEffect is setting up currentFile
     return <p className="p-4">Loading file data for {targetPath}...</p>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
        <h1 className="text-2xl font-bold truncate" title={currentFile.frontmatter.title || currentFile.slug}>
          {isNewFileMode ? 'Create: ' : 'Edit: '}
          {currentFile.frontmatter.title || currentFile.slug}
          {hasUnsavedChanges && <span className="text-destructive text-sm ml-2">*</span>}
        </h1>
        <Button onClick={handleSaveContent} disabled={isLoading || !hasUnsavedChanges}>
          {isLoading ? 'Saving...' : 'Save Content'}
        </Button>
      </div>
      <MarkdownEditor
        key={currentFile.path} // Force re-mount if path changes, ensuring editor gets new initialValue
        initialValue={editorContent}
        onChange={handleEditorChange}
      />
    </div>
  );
}