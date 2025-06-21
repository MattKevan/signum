// src/components/publishing/LeftSidebar.tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import { useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import FileTree from '@/features/editor/components/FileTree';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';
import { FilePlus, LayoutGrid, GripVertical } from 'lucide-react';
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

  const site = useAppStore((state) => state.getSiteById(siteId));
  const { repositionNode } = useAppStore.getState();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { setNodeRef: setRootDroppableRef } = useDroppable({ id: '__root_droppable__' });

  const flattenedItems = useMemo(() => {
    if (!site?.manifest.structure || !site.contentFiles) return [];
    return flattenTree(site.manifest.structure, site.contentFiles);
  }, [site?.manifest.structure, site?.contentFiles]);
  
  // --- FIX: Split the items into two distinct groups ---
  const homepageItem = useMemo(() => flattenedItems.find(item => item.frontmatter?.homepage === true), [flattenedItems]);
  const sortableItems = useMemo(() => flattenedItems.filter(item => item.frontmatter?.homepage !== true), [flattenedItems]);

  const activeItem = activeId ? flattenedItems.find(i => i.path === activeId) : null;

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
    if (depth > 1) {
        depth = 1;
    }
    let parentId = null;
    if (depth > 0 && previousItem) {
        if (depth === previousItem.depth) parentId = previousItem.parentId;
        else if (depth > previousItem.depth) parentId = previousItem.path;
        else parentId = newItems.slice(0, overItemIndex).reverse().find((item) => item.depth === depth)?.parentId ?? null;
    }
    return { depth, parentId, index: overItemIndex };
  }, [activeId, overId, offsetLeft, flattenedItems, activeItem]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    setOffsetLeft(event.delta.x);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string ?? null);
  }, []);
  
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

  if (!site || !homepageItem) return null; // Wait for the homepage to be available

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
          {flattenedItems.length > 0 ? (
            <FileTree 
              homepageItem={homepageItem}
              sortableItems={sortableItems}
              activeId={activeId}
              projected={projected}
              baseEditPath={`/sites/${siteId}/edit`}
              activePath={activePathForFileTree}
              onCollapse={() => {}} // Pass a dummy function for now or implement collapse logic
            />
          ) : (
            <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
              <p>No pages created yet.</p>
            </div>
          )}
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