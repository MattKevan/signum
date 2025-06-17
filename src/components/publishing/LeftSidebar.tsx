// src/components/publishing/LeftSidebar.tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import { useMemo, useCallback, useEffect, useState } from 'react';

import { useAppStore } from '@/core/state/useAppStore';
import { useUIStore } from '@/core/state/uiStore';
import { Button } from '@/core/components/ui/button';
import FileTree from '@/features/editor/components/FileTree';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
// Import the renamed dialog for creating collection pages
import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';

import type { StructureNode } from '@/types';
import { cn } from '@/lib/utils';
import { Home, FilePlus, LayoutGrid } from 'lucide-react';
import { DndContext, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { Link } from '@/core/components/ui/link';

export default function LeftSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  // --- UI State Hooks ---
  const isLeftOpen = useUIStore((state) => state.sidebar.isLeftOpen);
  const toggleLeftSidebar = useUIStore((state) => state.sidebar.toggleLeftSidebar);
  const isDesktop = useUIStore((state) => state.screen.isDesktop);

  // --- App State Hooks ---
  const site = useAppStore((state) => state.getSiteById(siteId));
  const { updateManifest, moveNode } = useAppStore.getState();

  // --- Local State for Active Path ---
  const [activePath, setActivePath] = useState<string | undefined>();

  // This memoized value now gets ALL top-level pages. The old 'collection' filter is gone.
  const topLevelPages = useMemo(() => {
    return site?.manifest.structure.filter((node: StructureNode) => !node.path.includes('/', 'content/'.length)) || [];
  }, [site?.manifest.structure]);

  // Determine the currently active file path from the URL
  useEffect(() => {
    if (!site?.manifest) return;
    const contentSlug = pathname.substring(pathname.indexOf('/edit/content/') + 14).replace(/\/$/, '') || 'index';
    setActivePath(`content/${contentSlug}.md`);
  }, [pathname, site?.manifest]);

  // Callback for when the FileTree component reports a reordering
  const handleStructureChange = useCallback((reorderedPages: StructureNode[]) => {
      if (!site) return;
      // We rebuild the manifest from the reordered top-level pages.
      // This is simpler as we no longer need to merge back a separate collections array.
      const newManifest = { ...site.manifest, structure: reorderedPages };
      updateManifest(siteId, newManifest);
  }, [site, siteId, updateManifest]);

  // Callback for when a drag operation ends over the root droppable area (for un-nesting)
  const handleDragEndInSidebar = (event: DragEndEvent) => {
    const { over, active } = event;
    if (over && over.id === '__sidebar_root_droppable__') {
      const draggedNodePath = active.id as string;
      moveNode(siteId, draggedNodePath, null);
    }
  };

  const onCreationComplete = () => {
    if (!isDesktop) toggleLeftSidebar();
  };

  const { setNodeRef: setRootDroppableRef, isOver } = useDroppable({
    id: '__sidebar_root_droppable__',
  });

  const unnestDropZoneStyle = isOver ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 ring-inset' : '';

  if (!site) return null;

  return (
    <>
      {/* Mobile overlay */}
      {!isDesktop && (
        <div
          onClick={toggleLeftSidebar}
          className={cn('fixed inset-0 z-40 bg-black/60 transition-opacity', isLeftOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        />
      )}

      <DndContext onDragEnd={handleDragEndInSidebar}>
        <div className="flex h-full flex-col">
          {/* --- Header with Create Buttons --- */}
          <div className="flex shrink-0 items-center justify-between border-b p-2">
            <h3 className="px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Site Content
            </h3>
            <div className="flex items-center gap-1">
              {/* Button to create a new Collection Page */}
              <CreateCollectionPageDialog siteId={siteId} onComplete={onCreationComplete}>
                  <Button variant="ghost" className='size-7 p-1' title="New Collection Page">
                      <LayoutGrid className="h-4 w-4" />
                  </Button>
              </CreateCollectionPageDialog>
              {/* Button to create a new Standard Page */}
              <NewPageDialog siteId={siteId} onComplete={onCreationComplete}>
                  <Button variant="ghost" className='size-7 p-1' title="New Standard Page">
                      <FilePlus className="h-4 w-4" />
                  </Button>
              </NewPageDialog>
            </div>
          </div>

          {/* --- Main File Tree Area --- */}
          <div
            ref={setRootDroppableRef}
            className={cn("flex-grow overflow-y-auto p-2 transition-colors", unnestDropZoneStyle)}
          >
            {topLevelPages.length > 0 ? (
              <FileTree
                  nodes={topLevelPages}
                  baseEditPath={`/sites/${siteId}/edit`}
                  activePath={activePath}
                  onStructureChange={handleStructureChange}
              />
            ) : (
              <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
                <p>No pages created yet.</p>
                <p className="mt-2">Drag a nested page here to make it top-level.</p>
              </div>
            )}
          </div>

          {/* --- Footer Link --- */}
          <div className="mt-auto shrink-0 border-t p-2">
              <Button variant="ghost" asChild className="w-full justify-start gap-2">
                  <Link href="/sites">
                      <Home className="h-4 w-4" /> App Dashboard
                  </Link>
              </Button>
          </div>
        </div>
      </DndContext>
    </>
  );
}