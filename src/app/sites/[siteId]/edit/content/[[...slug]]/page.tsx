// src/app/sites/[siteId]/edit/content/[[...slug]]/page.tsx (FULLY CORRECTED)
'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { EditorProvider } from '@/features/editor/contexts/EditorContext';

// Component Imports
import { Button } from '@/core/components/ui/button';
import { FilePlus, LayoutGrid } from 'lucide-react';
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import LeftSidebar from '@/features/editor/components/LeftSidebar';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';
import BlocknoteEditor, { type BlocknoteEditorRef } from '@/features/editor/components/BlocknoteEditor';
import FrontmatterSidebar from '@/features/editor/components/FrontmatterSidebar';
import PrimaryContentFields from '@/features/editor/components/PrimaryContentFields';
import CollectionItemList from '@/features/editor/components/CollectionItemList';
import SaveButton from '@/features/editor/components/SaveButton';

// Modular Hooks
import { usePageIdentifier } from '@/features/editor/hooks/usePageIdentifier';
import { useFileContent } from '@/features/editor/hooks/useFileContent';
import { useFilePersistence } from '@/features/editor/hooks/useFilePersistence';

function EditContentPageInternal() {
  const editorRef = useRef<BlocknoteEditorRef>(null);

  const activeSiteId = useAppStore(state => state.activeSiteId);
  const site = useAppStore(state => activeSiteId ? state.getSiteById(activeSiteId) : undefined);
  
  const siteStructure = site?.manifest.structure || [];
  const allContentFiles = useMemo(() => site?.contentFiles || [], [site?.contentFiles]);
  const siteManifest = site?.manifest;
  const siteLayoutFiles = site?.layoutFiles;
  const siteThemeFiles = site?.themeFiles;
  // Pass the new granular props to the hook.
  const { siteId, isNewFileMode, filePath } = usePageIdentifier({ siteStructure, allContentFiles });
  
  const { status, frontmatter, initialBlocks, slug, setSlug, handleFrontmatterChange, onContentModified } = useFileContent(siteId, filePath, isNewFileMode);
  const { handleDelete } = useFilePersistence({ siteId, filePath, isNewFileMode, frontmatter, slug, getEditorContent: () => editorRef.current?.getBlocks() ?? [] });
  const { leftSidebarContent, rightSidebarContent, setLeftAvailable, setRightAvailable, setLeftSidebarContent, setRightSidebarContent } = useUIStore(state => state.sidebar);

  const isCollectionPage = useMemo(() => !!frontmatter?.collection, [frontmatter]);

  const rightSidebarComponent = useMemo(() => {
    // We add a guard to ensure siteId is available before rendering.
  if (status !== 'ready' || !frontmatter || !siteId || !siteManifest) {
      return null;
    }    
    
  return (
      <FrontmatterSidebar
        siteId={siteId}
        filePath={filePath}
        manifest={siteManifest}
        layoutFiles={siteLayoutFiles}
        themeFiles={siteThemeFiles}
        allContentFiles={allContentFiles}
        frontmatter={frontmatter}
        onFrontmatterChange={handleFrontmatterChange}
        isNewFileMode={isNewFileMode}
        slug={slug}
        onSlugChange={setSlug}
        onDelete={handleDelete}
      />
    );
  // Update the dependency array to use the new granular variables.
  }, [status, frontmatter, siteId, filePath, allContentFiles, handleFrontmatterChange, isNewFileMode, slug, setSlug, handleDelete, siteLayoutFiles, siteManifest, siteThemeFiles]);

  useEffect(() => {
    setLeftAvailable(true);
    setLeftSidebarContent(<LeftSidebar />);
    return () => { setLeftAvailable(false); setLeftSidebarContent(null); };
  }, [setLeftAvailable, setLeftSidebarContent]);

  useEffect(() => {
    if (rightSidebarComponent) {
      setRightAvailable(true);
      setRightSidebarContent(rightSidebarComponent);
    } else {
      setRightAvailable(false);
      setRightSidebarContent(null);
    }
    return () => { setRightAvailable(false); setRightSidebarContent(null); };
  }, [rightSidebarComponent, setRightAvailable, setRightSidebarContent]);

  // Use the derived `siteId` here for the check.
  const isSiteEmpty = siteId && siteStructure.length === 0 && !isNewFileMode;

  return (
    <ThreeColumnLayout
        leftSidebar={leftSidebarContent}
        rightSidebar={isSiteEmpty ? null : rightSidebarContent}
        headerActions={isSiteEmpty ? null : <SaveButton />}
    >
      {isSiteEmpty ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-background">
          <h2 className="text-2xl font-bold mb-2">Create Your Homepage</h2>
          <p className="text-muted-foreground mb-6 max-w-md">Your site is empty. The first page you create will become your site&apos;s permanent homepage.</p>
          <div className="flex gap-4">
            <NewPageDialog siteId={siteId}><Button size="lg"><FilePlus className="mr-2 h-5 w-5" /> Create Content Page</Button></NewPageDialog>
            <CreateCollectionPageDialog siteId={siteId}><Button size="lg" variant="outline"><LayoutGrid className="mr-2 h-5 w-5" /> Create Collection Page</Button></CreateCollectionPageDialog>
          </div>
        </div>
      ) : (
        (() => {
          if (status !== 'ready' || !frontmatter || !filePath) {
            return <div className="p-6 flex justify-center items-center h-full"><p>Loading Editor...</p></div>;
          }
          return (
            <div className='flex h-full w-full flex-col'>
              <div className='container mx-auto flex h-full max-w-[900px] flex-col p-6'>
                <div className="shrink-0"><PrimaryContentFields frontmatter={frontmatter} onFrontmatterChange={handleFrontmatterChange} /></div>
                <div className="mt-6 flex-grow min-h-0">
                  {isCollectionPage ? (
                    <CollectionItemList siteId={siteId} collectionPagePath={filePath} />
                  ) : (
                    <BlocknoteEditor ref={editorRef} key={filePath} initialContent={initialBlocks} onContentChange={onContentModified} />
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}
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