// src/components/publishing/LeftSidebar.tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import { useMemo, useCallback, useState } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { useUIStore } from '@/core/state/uiStore';
import { Button } from '@/core/components/ui/button';
import FileTree from '@/features/editor/components/FileTree';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';
import type { StructureNode } from '@/types';
import { cn } from '@/lib/utils';
import { Home, FilePlus, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Link } from '@/core/components/ui/link';

const findParentOfNode = (nodes: StructureNode[], path: string, parent: StructureNode | null = null): StructureNode | null => {
  for (const node of nodes) {
    if (node.path === path) return parent;
    if (node.children) {
      const found = findParentOfNode(node.children, path, node);
      if (found) return found;
    }
  }
  return null;
};

export default function LeftSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));
  const { moveNode, reorderNodeAction, unNestNodeAction } = useAppStore.getState();
  const { isLeftOpen, toggleLeftSidebar } = useUIStore((state) => state.sidebar);
  const isDesktop = useUIStore((state) => state.screen.isDesktop);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<'nest' | 'reorder-before' | 'reorder-after' | 'root' | null>(null);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(event.active.id as string), []);
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    const overNode = over?.data?.current;
    setOverId(over ? over.id as string : null);
    if (!overNode) return setDropZone(null);
    const zoneAttr = overNode.dndZone as string | undefined;
    const isDisabled = overNode.dndDisabled === true;
    if (over.id === '__sidebar_root_droppable__') setDropZone('root');
    else if (zoneAttr && !isDisabled) setDropZone(zoneAttr as typeof dropZone);
    else setDropZone(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const activePath = activeId, targetPath = overId, finalDropZone = dropZone;
    setActiveId(null); setOverId(null); setDropZone(null);
    if (!site || !activePath || !targetPath || !finalDropZone || activePath === targetPath) return;

    const homepagePath = site.manifest.structure[0]?.path;
    if (homepagePath && targetPath === homepagePath && (finalDropZone === 'reorder-before' || finalDropZone === 'nest')) {
      toast.error("Cannot move a page above or into the homepage.");
      return;
    }

    switch (finalDropZone) {
      case 'root': unNestNodeAction(siteId, activePath); break;
      case 'nest': moveNode(siteId, activePath, targetPath); break;
      case 'reorder-before': case 'reorder-after':
        reorderNodeAction(siteId, activePath, targetPath, finalDropZone); break;
    }
  }, [activeId, overId, dropZone, site, siteId, unNestNodeAction, moveNode, reorderNodeAction]);

  const { homeNode, otherNodes, sortableIds } = useMemo(() => {
    if (!site?.manifest.structure || site.manifest.structure.length === 0) return { homeNode: null, otherNodes: [], sortableIds: [] };
    const home = site.manifest.structure[0];
    const others = site.manifest.structure.slice(1);
    const ids = others.flatMap(node => [node.path, ...(node.children?.map(child => child.path) ?? [])]);
    return { homeNode: home, otherNodes: others, sortableIds: ids };
  }, [site?.manifest.structure]);

  const activePathForFileTree = useMemo(() => {
    if (!site?.manifest) return undefined;
    const slugSegments = pathname.split('/').slice(pathname.split('/').indexOf('content') + 1);
    if (slugSegments.length === 0 || slugSegments[0] === '') return site.manifest.structure[0]?.path;
    return `content/${slugSegments.join('/')}.md`;
  }, [pathname, site]);

  const { setNodeRef: setRootDroppableRef, isOver } = useDroppable({ id: '__sidebar_root_droppable__'});
  const isUnNestingTarget = isOver && activeId && findParentOfNode(site?.manifest.structure || [], activeId);

  if (!site) return null;

  return (
    <>
      {!isDesktop && (<div onClick={toggleLeftSidebar} className={cn('fixed inset-0 z-40 bg-black/60', isLeftOpen ? 'opacity-100' : 'pointer-events-none opacity-0')} /> )}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b p-2">
            <h3 className="px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Site Content</h3>
            <div className="flex items-center gap-1">
              <CreateCollectionPageDialog siteId={siteId}><Button variant="ghost" className='size-7 p-1' title="New Collection"><LayoutGrid className="h-4 w-4" /></Button></CreateCollectionPageDialog>
              <NewPageDialog siteId={siteId}><Button variant="ghost" className='size-7 p-1' title="New Page"><FilePlus className="h-4 w-4" /></Button></NewPageDialog>
            </div>
          </div>
          <div ref={setRootDroppableRef} className={cn("flex-grow overflow-y-auto p-2 transition-colors", isUnNestingTarget && 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 ring-inset')}>
            {homeNode && (
              // --- FIX: Pass `contentFiles` and remove incorrect `isHomepage` prop ---
              <FileTree nodes={[homeNode]} contentFiles={site.contentFiles || []} baseEditPath={`/sites/${siteId}/edit`} activePath={activePathForFileTree} activeId={activeId} overId={overId} dropZone={dropZone} />
            )}
            {otherNodes.length > 0 && (
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {/* --- FIX: Pass `contentFiles` --- */}
                  <FileTree nodes={otherNodes} contentFiles={site.contentFiles || []} baseEditPath={`/sites/${siteId}/edit`} activePath={activePathForFileTree} activeId={activeId} overId={overId} dropZone={dropZone} />
              </SortableContext>
            )}
            {(!homeNode && !otherNodes.length) && (
              <div className="px-2 py-4 text-xs text-center text-muted-foreground italic"><p>No pages created yet.</p></div>
            )}
          </div>
          <div className="mt-auto shrink-0 border-t p-2">
            <Button variant="ghost" asChild className="w-full justify-start gap-2"><Link href="/sites"><Home className="h-4 w-4" /> App Dashboard</Link></Button>
          </div>
        </div>
        <DragOverlay>{activeId ? <div className="p-2 bg-background border rounded-md shadow-lg text-sm font-semibold">Moving page...</div> : null}</DragOverlay>
      </DndContext>
    </>
  );
}