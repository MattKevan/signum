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
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, DragOverEvent } from '@dnd-kit/core';
import { Link } from '@/core/components/ui/link';
import { getDescendantIds } from '@/core/services/fileTree.service';

type DndIndicator = {
    path: string;
    intent: 'reorder-before' | 'reorder-after' | 'nest';
} | null;

export default function LeftSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));
  // --- FIX: Use a single, powerful store action ---
  const { repositionNode } = useAppStore.getState(); 
  const { isLeftOpen, toggleLeftSidebar } = useUIStore((state) => state.sidebar);
  const isDesktop = useUIStore((state) => state.screen.isDesktop);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dndIndicator, setDndIndicator] = useState<DndIndicator>(null);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(event.active.id as string), []);
  
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, delta } = event;
    if (!over) {
      setDndIndicator(null);
      return;
    }
    const overId = over.id as string;
    const overData = over.data?.current;

    const isNestingTarget = overData?.type === 'container' && !overData.isCollection;
    const nestingZoneHeight = over.rect.height * 0.6; // 60% of height is the nest zone
    const nestingZoneTop = over.rect.height * 0.2;
    
    // --- INTENT CALCULATION ---
    if (isNestingTarget && delta.y > nestingZoneTop && delta.y < (nestingZoneTop + nestingZoneHeight)) {
      setDndIndicator({ path: overId, intent: 'nest' });
    } else {
      const position = delta.y < over.rect.height / 2 ? 'reorder-before' : 'reorder-after';
      setDndIndicator({ path: overId, intent: position });
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const activePath = activeId;
    const overPath = event.over?.id as string | undefined;
    const finalIndicator = dndIndicator;

    setActiveId(null);
    setDndIndicator(null);

    if (!site || !activePath || !overPath || !finalIndicator || activePath === overPath) return;

    // --- DELEGATE ALL LOGIC TO THE STORE ACTION ---
    repositionNode(siteId, activePath, overPath, finalIndicator.intent);

  }, [siteId, activeId, dndIndicator, site, repositionNode]);

  const allNodeIds = useMemo(() => site ? getDescendantIds(site.manifest.structure) : [], [site]);
  const homepagePath = useMemo(() => site?.manifest.structure[0]?.path, [site]);

  const activePathForFileTree = useMemo(() => {
    if (!site?.manifest) return undefined;
    const editorRootPath = `/sites/${siteId}/edit/content`;
    if (pathname === editorRootPath || pathname.startsWith(`${editorRootPath}/`)) {
        const slug = pathname.replace(editorRootPath, '').replace(/^\//, '');
        return slug ? `content/${slug}.md` : homepagePath;
    }
    return undefined;
  }, [pathname, site, siteId, homepagePath]);

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
          <div className="flex-grow overflow-y-auto p-2">
            {site.manifest.structure.length > 0 ? (
                <FileTree 
                    nodes={site.manifest.structure} 
                    contentFiles={site.contentFiles || []}
                    baseEditPath={`/sites/${siteId}/edit`}
                    activePath={activePathForFileTree}
                    homepagePath={homepagePath}
                    dndIndicator={dndIndicator}
                />
            ) : (
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