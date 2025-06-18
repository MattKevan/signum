// src/app/sites/[siteId]/edit/content/[[...slug]]/page.tsx
'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { EditorProvider } from '@/features/editor/contexts/EditorContext';
import { slugify } from '@/lib/utils';
import type { LocalSiteData } from '@/types';

// --- Component Imports ---
import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';
import MarkdownEditor, { type MarkdownEditorRef } from '@/components/publishing/MarkdownEditor';
import FrontmatterSidebar from '@/features/editor/components/FrontmatterSidebar';
import PrimaryContentFields from '@/features/editor/components/PrimaryContentFields';
import LeftSidebar from '@/components/publishing/LeftSidebar';
import CollectionItemList from '@/features/editor/components/CollectionItemList';
import SaveButton from '@/features/editor/components/SaveButton'; // Import the extracted button

// --- Modular Hooks ---
import { usePageIdentifier } from '@/features/editor/hooks/usePageIdentifier';
import { useFileContent } from '@/features/editor/hooks/useFileContent';
import { useFilePersistence } from '@/features/editor/hooks/useFilePersistence';

function EditContentPageInternal() {
  const editorRef = useRef<MarkdownEditorRef>(null);

  // 1. Identify the page from the URL
  const { siteId, isNewFileMode, filePath } = usePageIdentifier();

  // 2. Manage the file's content state (this hook no longer provides hasUnsavedChanges)
  const {
    status,
    site,
    frontmatter,
    bodyContent,
    slug,
    setSlug,
    handleFrontmatterChange,
    onContentModified,
  } = useFileContent(siteId, filePath, isNewFileMode);


  // 3. Manage file persistence. It now gets its state from the context, so we pass fewer props.
  const { handleDelete } = useFilePersistence({
    siteId,
    filePath,
    isNewFileMode,
    frontmatter,
    slug,
    getEditorContent: () => editorRef.current?.getMarkdown() ?? '',
  });

  // 4. Manage UI state (sidebars)
  const {
    leftSidebarContent, rightSidebarContent,
    setLeftAvailable, setRightAvailable,
    setLeftSidebarContent, setRightSidebarContent
  } = useUIStore(state => state.sidebar);

  // Determine if the current page is a collection page
  const isCollectionPage = useMemo(() => !!frontmatter?.collection, [frontmatter]);

  // Effect to manage the Left Sidebar (File Tree)
  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => {
        setLeftAvailable(false);
        setLeftSidebarContent(null);
    }
  }, [setLeftAvailable, setLeftSidebarContent]);

  // Effect to manage the Right Sidebar (Settings)
  useEffect(() => {
    if (status === 'ready' && frontmatter && site) {
      setRightAvailable(true);
      setRightSidebarContent(
        <FrontmatterSidebar
          siteId={siteId}
          site={site as LocalSiteData}
          frontmatter={frontmatter}
          onFrontmatterChange={handleFrontmatterChange}
          isNewFileMode={isNewFileMode}
          slug={slug}
          onSlugChange={(newSlug) => setSlug(slugify(newSlug))}
          onDelete={handleDelete}
        />
      );
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
    return () => { setRightAvailable(false); }
  }, [status, site, frontmatter, isNewFileMode, slug, siteId, handleFrontmatterChange, handleDelete, setSlug, setRightAvailable, setRightSidebarContent]);


  // --- Main Content Rendering Logic ---
  const pageContent = useMemo(() => {
    if (status !== 'ready' || !frontmatter) {
      return <div className="p-6 flex justify-center items-center h-full"><p>Loading Editor...</p></div>;
    }

    return (
      <div className='flex h-full w-full flex-col'>
        <div className='container mx-auto flex h-full max-w-[900px] flex-col p-6'>
            {/* Title and Description are ALWAYS shown */}
            <div className="shrink-0">
                <PrimaryContentFields
                    frontmatter={frontmatter}
                    onFrontmatterChange={handleFrontmatterChange}
                />
            </div>
            <div className="mt-6 flex-grow min-h-0">
              {isCollectionPage ? (
                // If it's a collection, show the item list table.
                <CollectionItemList
                  siteId={siteId}
                  collectionPagePath={filePath}
                />
              ) : (
                // Otherwise, show the Markdown editor for the body.
                <MarkdownEditor
                  ref={editorRef}
                  key={filePath}
                  initialValue={bodyContent}
                  onContentChange={onContentModified}
                />
              )}
            </div>
        </div>
      </div>
    );
  }, [status, frontmatter, bodyContent, filePath, editorRef, onContentModified, isCollectionPage, siteId, handleFrontmatterChange]);

  return (
    <ThreeColumnLayout
        leftSidebar={leftSidebarContent}
        rightSidebar={rightSidebarContent}
        headerActions={<SaveButton />}
    >
        {pageContent}
    </ThreeColumnLayout>
  );
}

export default function EditContentPage() {
    return (
        <EditorProvider>
            <EditContentPageInternal />
        </EditorProvider>
    );
}