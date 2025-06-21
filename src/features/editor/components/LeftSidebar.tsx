// src/components/publishing/LeftSidebar.tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';

import { useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import FileTree from '@/features/editor/components/FileTree';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';
import { FilePlus, LayoutGrid, GripVertical, Archive, Home } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  DragMoveEvent,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { flattenTree, FlattenedNode } from '@/core/services/fileTree.service';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { exportSiteBackup } from '@/core/services/siteBackup.service';
import { slugify } from '@/lib/utils';

interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

function DragOverlayItem({ id, items }: { id: string, items: FlattenedNode[] }) {
    const item = items.find(i => i.path === id);
    if (!item) return null;
    return (
        <div className="flex items-center gap-2 p-2 bg-background border rounded-md shadow-lg text-sm font-semibold">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span>{item.title}</span>
        </div>
    );
}

export default function LeftSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;
  const { getSiteById, loadSite } = useAppStore();

  const site = useAppStore((state) => state.getSiteById(siteId));
  const { repositionNode } = useAppStore.getState();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { setNodeRef: setRootDroppableRef } = useDroppable({ id: '__root_droppable__' });

  const flattenedItems = useMemo(() => {
    if (!site?.manifest.structure || !site.contentFiles) return [];
    return flattenTree(site.manifest.structure, site.contentFiles);
  }, [site?.manifest.structure, site?.contentFiles]);
  
  const homepageItem = useMemo(() => flattenedItems.find(item => item.frontmatter?.homepage === true), [flattenedItems]);
  const sortableItems = useMemo(() => flattenedItems.filter(item => item.frontmatter?.homepage !== true), [flattenedItems]);
  const sortableIds = useMemo(() => sortableItems.map(i => i.path), [sortableItems]);
  
  const activeItem = activeId ? flattenedItems.find(i => i.path === activeId) : null;

  const handleExportBackup = async () => {
    toast.info("Preparing site backup...");
    try {
        await loadSite(siteId);
        const siteToExport = getSiteById(siteId);
        if (!siteToExport) throw new Error("Could not load site data for export.");
        const blob = await exportSiteBackup(siteToExport);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${slugify(siteToExport.manifest.title || 'signum-backup')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success("Site backup downloaded!");
    } catch (error) {
        console.error("Failed to export site:", error);
        toast.error(`Export failed: ${(error as Error).message}`);
    }
  };

  const itemsToRender = useMemo(() => {
    // This logic correctly filters children of collapsed parents.
    return flattenedItems.filter(item => {
        if (item.depth === 0) return true;
        if (item.parentId && collapsedIds.has(item.parentId)) return false;
        // Also check grandparents for level 2 items
        const parent = flattenedItems.find(p => p.path === item.parentId);
        if (parent?.parentId && collapsedIds.has(parent.parentId)) return false;
        return true;
    });
  }, [flattenedItems, collapsedIds]);
  
  const projected = useMemo((): DndProjection | null => {
    if (!activeItem || !overId) return null;
    const indentationWidth = 24;
    const dragDepth = Math.round(offsetLeft / indentationWidth);
    const projectedDepth = activeItem.depth + dragDepth;
    const overItemIndex = flattenedItems.findIndex(({ path }) => path === overId);
    const activeItemIndex = flattenedItems.findIndex(({ path }) => path === activeId);
    const newItems = arrayMove(flattenedItems, activeItemIndex, overItemIndex);
    const previousItem = newItems[overItemIndex - 1];
    const nextItem = newItems[overItemIndex + 1];
    const maxDepth = previousItem ? previousItem.depth + 1 : 0;
    const minDepth = nextItem ? nextItem.depth : 0;
    let depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth));

    // --- FIX: Update the hard cap on visual depth to allow up to level 2. ---
    if (depth > 2) {
      depth = 2;
    }
    
    let parentId = null;
    if (depth > 0 && previousItem) {
        if (depth === previousItem.depth) parentId = previousItem.parentId;
        else if (depth > previousItem.depth) parentId = previousItem.path;
        else parentId = newItems.slice(0, overItemIndex).reverse().find((item) => item.depth === depth)?.parentId ?? null;
    }
    return { depth, parentId, index: overItemIndex };
  }, [activeId, overId, offsetLeft, flattenedItems, activeItem]);

  const handleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => setOffsetLeft(event.delta.x), []);
  const handleDragOver = useCallback((event: DragOverEvent) => setOverId(event.over?.id as string ?? null), []);
  
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!projected) {
        resetState();
        return;
    }
    const { active, over } = event;
    if (site && active.id && over?.id) {
        if (over.id === '__root_droppable__') {
            repositionNode(siteId, active.id as string, null, flattenedItems.length - 1);
        } else {
            repositionNode(siteId, active.id as string, projected.parentId, projected.index);
        }
    }
    resetState();
  }, [projected, site, siteId, repositionNode, flattenedItems.length]);

  
  
  const resetState = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }, []);

  const activePathForFileTree = useMemo(() => {
    if (!site?.manifest) return undefined;
    const editorRootPath = `/sites/${siteId}/edit/content`;
    if (pathname.startsWith(editorRootPath)) {
        const slug = pathname.substring(editorRootPath.length).replace(/^\//, '');
        return slug ? `content/${slug}.md` : homepageItem?.path;
    }
    return undefined;
  }, [pathname, site, siteId, homepageItem]);

  if (!site) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetState}
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b p-2">
          <h3 className="px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Site Content</h3>
          <div className="flex items-center gap-1">
            <CreateCollectionPageDialog siteId={siteId}>
                <Button variant="ghost" className='size-7 p-1' title="New Collection">
                    <LayoutGrid className="h-4 w-4" />
                </Button>
            </CreateCollectionPageDialog>
            <NewPageDialog siteId={siteId}>
                <Button variant="ghost" className='size-7 p-1' title="New Page">
                    <FilePlus className="h-4 w-4" />
                </Button>
            </NewPageDialog>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto p-2" ref={setRootDroppableRef}>
          {homepageItem && itemsToRender.length > 0 ? (
            <FileTree 
              itemsToRender={itemsToRender.map(item => ({...item, collapsed: collapsedIds.has(item.path)}))}
              sortableIds={sortableIds}
              activeId={activeId}
              projected={projected}
              baseEditPath={`/sites/${siteId}/edit`}
              activePath={activePathForFileTree}
              homepagePath={homepageItem.path}
              onCollapse={handleCollapse}
            />
          ) : (
            <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
              <p>No pages created yet. Click the buttons above to add one.</p>
            </div>
          )}
        </div>

        <div className="mt-auto shrink-0 border-t p-2 space-y-1">
            <Button variant="ghost" onClick={handleExportBackup} className="w-full justify-start gap-2">
                <Archive className="h-4 w-4" /> Export site backup
            </Button>
            
        </div>
      </div>
      
      {createPortal(
        <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
          {activeId ? <DragOverlayItem id={activeId} items={flattenedItems} /> : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}