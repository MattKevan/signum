// src/app/sites/[siteId]/edit/content/[[...slug]]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useMemo, useEffect, useRef } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { useContentEditorState } from '@/features/editor/hooks/useContentEditorState';
import { EditorProvider } from '@/features/editor/contexts/EditorContext';

// --- Component Imports ---
import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';
import MarkdownEditor, { type MarkdownEditorRef } from '@/components/publishing/MarkdownEditor';
import ViewEditor from '@/features/editor/components/ViewEditor';
import FrontmatterSidebar from '@/features/editor/components/FrontmatterSidebar';
import PrimaryContentFields from '@/features/editor/components/PrimaryContentFields';
import LeftSidebar from '@/components/publishing/LeftSidebar';
import type { LocalSiteData } from '@/types';
import { slugify } from '@/lib/utils';


function EditContentPageInternal() {
  const params = useParams();
  const siteId = params.siteId as string;
  const slugSegments = useMemo(() => (params.slug as string[]) || [], [params.slug]);

  const { 
    status, 
    site,
    isNewFileMode, 
    frontmatter, 
    bodyContent, 
    slug, 
    currentFilePath,
    editorRef,
    actions 
  } = useContentEditorState(siteId, slugSegments);

  // --- START OF FIX: Select each piece of state individually ---
  const leftSidebarContent = useUIStore(state => state.sidebar.leftSidebarContent);
  const rightSidebarContent = useUIStore(state => state.sidebar.rightSidebarContent);
  const setLeftAvailable = useUIStore(state => state.sidebar.setLeftAvailable);
  const setRightAvailable = useUIStore(state => state.sidebar.setRightAvailable);
  const setLeftSidebarContent = useUIStore(state => state.sidebar.setLeftSidebarContent);
  const setRightSidebarContent = useUIStore(state => state.sidebar.setRightSidebarContent);
  // --- END OF FIX ---

  // Effect 1: Manages the static layout of the left sidebar.
  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    
    // Cleanup function
    return () => {
        setLeftAvailable(false);
        setLeftSidebarContent(null);
    }
  }, [setLeftAvailable, setLeftSidebarContent]); // This effect now has stable dependencies.


  // Effect 2: Manages the dynamic content of the right sidebar.
  useEffect(() => {
    if (status === 'ready' && frontmatter && site) {
      setRightAvailable(true);
      setRightSidebarContent(
        <FrontmatterSidebar
          site={site as LocalSiteData}
          frontmatter={frontmatter}
          onFrontmatterChange={actions.handleFrontmatterChange}
          isNewFileMode={isNewFileMode}
          slug={slug}
          onSlugChange={(newSlug) => actions.setSlug(slugify(newSlug))}
          onDelete={actions.handleDelete}
          onViewModeToggle={actions.handleViewModeToggle}
        />
      );
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }

    return () => {
        setRightAvailable(false);
    }
  }, [
    status, site, frontmatter, isNewFileMode, slug, actions,
    setRightAvailable, setRightSidebarContent
  ]);

  const isViewMode = useMemo(() => !!frontmatter?.view, [frontmatter]);

  const pageContent = useMemo(() => {
    if (status !== 'ready' || !frontmatter) {
      return <div className="p-6 flex justify-center items-center h-full"><p>Loading Editor...</p></div>;
    }
    
    return (
      <div className='flex h-full w-full flex-col p-6'>
        <div className='container mx-auto flex h-full max-w-[900px] flex-col'>
            <div className="shrink-0">
                <PrimaryContentFields
                    frontmatter={frontmatter}
                    onFrontmatterChange={actions.handleFrontmatterChange}
                />
            </div>
            <div className="mt-6 flex-grow">
              {isViewMode ? (
                <ViewEditor 
                  siteId={siteId}
                  frontmatter={frontmatter}
                  onFrontmatterChange={actions.handleFrontmatterChange}
                />
              ) : (
                <MarkdownEditor
                  ref={editorRef}
                  key={currentFilePath}
                  initialValue={bodyContent}
                  onContentChange={actions.onContentModified}
                />
              )}
            </div>
        </div>
      </div>
    );
  }, [status, frontmatter, bodyContent, currentFilePath, editorRef, actions, isViewMode, siteId]);
  
  return (
    <ThreeColumnLayout
        leftSidebar={leftSidebarContent}
        rightSidebar={rightSidebarContent}
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