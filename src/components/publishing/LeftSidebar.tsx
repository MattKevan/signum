// src/components/publishing/LeftSidebar.tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import { useMemo, useCallback, useEffect, useState } from 'react';

import { useAppStore } from '@/core/state/useAppStore';
import { useUIStore } from '@/core/state/uiStore';
import { Button } from '@/core/components/ui/button';
import FileTree from '@/features/editor/components/FileTree';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
import CollectionList from '@/features/editor/components/CollectionList';
import NewViewDialog from '@/features/editor/components/NewViewDialog';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/core/components/ui/accordion";
import type { StructureNode } from '@/types';
import { cn } from '@/lib/utils';
import { Home, FilePlus, Newspaper } from 'lucide-react';
import { DndContext, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { Link } from '@/core/components/ui/link';


export default function LeftSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  const isLeftOpen = useUIStore((state) => state.sidebar.isLeftOpen);
  const toggleLeftSidebar = useUIStore((state) => state.sidebar.toggleLeftSidebar);
  const isDesktop = useUIStore((state) => state.screen.isDesktop);
  
  const site = useAppStore((state) => state.getSiteById(siteId));
  const { updateManifest, moveNode } = useAppStore.getState();
  
  const pageStructure = useMemo(() => {
    // Only show top-level pages in the main file tree. Nested pages are handled by the FileTree component itself.
    return site?.manifest.structure.filter((node: StructureNode) => node.type === 'page' && !node.path.includes('/', 'content/'.length)) || [];
  }, [site?.manifest.structure]);

  const [activePath, setActivePath] = useState<string | undefined>();
  useEffect(() => {
    if (!site?.contentFiles) return;

    let currentPath = '';

    if (pathname.includes('/edit/content/')) {
        const contentSlug = pathname.substring(pathname.indexOf('/edit/content/') + 14).replace(/\/$/, '') || 'index';
        currentPath = `content/${contentSlug}.md`;
    } else if (pathname.includes('/edit/collection/')) {
        const collectionSlug = pathname.substring(pathname.indexOf('/edit/collection/') + 17).replace(/\/$/, '');
        currentPath = `content/${collectionSlug}`;
    }
    setActivePath(currentPath);
  }, [pathname, site?.contentFiles]);

  const handleStructureChange = useCallback((reorderedPages: StructureNode[]) => {
      if (!site) return;
      const collections = site.manifest.structure.filter(n => n.type === 'collection');
      const newManifest = { ...site.manifest, structure: [...reorderedPages, ...collections] };
      updateManifest(siteId, newManifest);
  }, [site, siteId, updateManifest]);
  
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
      {!isDesktop && (
        <div
          onClick={toggleLeftSidebar}
          className={cn('fixed inset-0 z-40 bg-black/60 transition-opacity', isLeftOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        />
      )}
      
      <DndContext onDragEnd={handleDragEndInSidebar}>
        <div className="flex h-full flex-col">
          <Accordion type="multiple" defaultValue={['pages', 'collections']} className="w-full flex-grow flex flex-col">
            
            <AccordionItem value="pages" className="border-b-0">
              <div className="flex px-3 py-1 items-center justify-between">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b-0 p-0 hover:no-underline">
                    Pages
                  </AccordionTrigger>
                  <div className="flex items-center gap-1">
                      <NewViewDialog siteId={siteId} onComplete={onCreationComplete}>
                          <Button variant="ghost" className='size-6 p-1 rounded-sm' title="New View Page">
                              <Newspaper className="h-4 w-4" />
                          </Button>
                      </NewViewDialog>
                      <NewPageDialog siteId={siteId} onComplete={onCreationComplete}>
                          <Button variant="ghost" className='size-6 p-1 rounded-sm' title="New Content Page">
                              <FilePlus className="h-4 w-4" />
                          </Button>
                      </NewPageDialog>
                  </div>
              </div>
              <AccordionContent ref={setRootDroppableRef} className={cn("px-2 py-2 transition-colors", unnestDropZoneStyle)}>
                {pageStructure.length > 0 ? (
                  <FileTree 
                      nodes={pageStructure} 
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
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="collections" className="border-t flex-grow flex flex-col min-h-0">
              <AccordionContent className="flex-grow min-h-0 py-0">
                  <CollectionList siteId={siteId} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

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