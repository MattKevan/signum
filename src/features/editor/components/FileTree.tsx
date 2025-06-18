// src/features/editor/components/FileTree.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { type ParsedMarkdownFile, type StructureNode } from '@/types';
import { toast } from 'sonner';
import { GripVertical, ChevronRight, File as FileIcon, LayoutGrid, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, useDroppable, DragOverlay } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';
import { Button } from '@/core/components/ui/button';

// --- Type Definitions ---
interface FileTreeProps {
  nodes: StructureNode[];
  contentFiles: ParsedMarkdownFile[];
  baseEditPath: string;
  activePath?: string;
  onStructureChange: (nodes: StructureNode[]) => void;
  className?: string;
}

interface FileTreeNodeProps extends Omit<FileTreeProps, 'nodes' | 'onStructureChange' | 'className'> {
  node: StructureNode;
  activeDragId: string | null;
  onStructureChange: (reorderedChildren: StructureNode[]) => void;
}

// --- Draggable & Droppable Node Component ---
const DndNode: React.FC<FileTreeNodeProps> = ({ node, contentFiles, baseEditPath, activePath, activeDragId, onStructureChange }) => {
    const { attributes, listeners, setNodeRef: setSortableNodeRef, transform, transition } = useSortable({
        id: node.path,
    });
    
    const [isOpen, setIsOpen] = useState(true);
    const displayLabel = node.menuTitle || node.title || node.slug;

    // --- NEW: Determine if this node represents a Collection Page ---
    const isCollectionPage = useMemo(() => {
        const file = contentFiles.find(f => f.path === node.path);
        return !!file?.frontmatter.collection;
    }, [contentFiles, node.path]);

    // A page is a valid drop target if it's NOT a collection page.
    const isNestableTarget = !isCollectionPage && !!activeDragId;

    const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
        id: node.path,
        disabled: !isNestableTarget,
    });
    
    const setNodeRef = (el: HTMLElement | null) => {
        setSortableNodeRef(el);
        setDroppableNodeRef(el);
    };

    const style = { transform: CSS.Transform.toString(transform), transition };
    const dropIndicatorStyle = isOver && isNestableTarget ? 'bg-blue-100 dark:bg-blue-900/50 outline outline-1 outline-blue-500' : '';
    const hasChildren = node.children && node.children.length > 0;

    // The editor link is the same for both page types
    const href = `${baseEditPath}/content/${node.slug}`;
    const newItemHref = `${href}/${NEW_FILE_SLUG_MARKER}`;

    const handleChildrenStructureChange = (reorderedChildren: StructureNode[]) => {
        const newParentNode = { ...node, children: reorderedChildren };
        onStructureChange([newParentNode]);
    };

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col">
            <div className={cn("flex items-center group w-full my-0.5 rounded-md transition-colors", dropIndicatorStyle)}>
                <div {...attributes} {...listeners} className="p-1 cursor-grab touch-none text-muted-foreground/50">
                    <GripVertical className="h-4 w-4" />
                </div>
                <div className={cn("flex-grow flex items-center py-1 pl-1 pr-1 rounded-md hover:bg-muted", activePath === node.path && "bg-accent text-accent-foreground")}>
                    <ChevronRight 
                        className={cn("h-4 w-4 mr-1 shrink-0 transition-transform duration-200", hasChildren && !isCollectionPage ? 'cursor-pointer' : 'invisible', isOpen && "rotate-90")} 
                        onClick={() => hasChildren && setIsOpen(!isOpen)}
                    />
                    {isCollectionPage ? <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <Link href={href} className="truncate flex-grow mx-1.5 text-sm" title={displayLabel}>
                                                {displayLabel}
                                            </Link>
                    {isCollectionPage && (
                        <Button asChild variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={newItemHref} title={`New item in ${node.title}`}>
                                <Plus className="h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
            {hasChildren && !isCollectionPage && isOpen && (
                <div className="pl-6 border-l ml-4">
                    <FileTree
                        nodes={node.children!}
                        contentFiles={contentFiles}
                        baseEditPath={baseEditPath}
                        activePath={activePath}
                        onStructureChange={handleChildrenStructureChange}
                        className="py-1"
                    />
                </div>
            )}
        </div>
    );
};

// --- Main FileTree Component ---
export default function FileTree({ nodes, contentFiles, baseEditPath, activePath, onStructureChange, className }: FileTreeProps) {
  const { moveNode } = useAppStore.getState();
  const siteId = useParams().siteId as string;
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const nodeIds = useMemo(() => nodes.map(n => n.path), [nodes]);

  const handleDragStart = (event: DragStartEvent) => {
      setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // --- NEW: Find if the target is a collection page ---
    const overNodeFile = contentFiles.find(f => f.path === over.id);
    const isOverNodeCollection = !!overNodeFile?.frontmatter.collection;

    if (isOverNodeCollection) {
        toast.error("Cannot nest pages under a Collection Page.");
        return;
    }
    
    // If over.id exists, it's a nesting attempt.
    if (nodes.some(n => n.path === over.id)) {
        moveNode(siteId, active.id as string, over.id as string);
    } else {
        // Otherwise, it's a reordering attempt.
        const oldIndex = nodeIds.indexOf(active.id as string);
        const newIndex = nodeIds.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
            onStructureChange(arrayMove(nodes, oldIndex, newIndex));
        }
    }
  };

  return (
    <div className={cn("w-full", className)}>
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <SortableContext items={nodeIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                    {nodes.map(node => (
                        <DndNode 
                            key={node.path} 
                            node={node} 
                            contentFiles={contentFiles}
                            baseEditPath={baseEditPath} 
                            activePath={activePath} 
                            onStructureChange={(updatedChildList) => {
                                const newNodes = nodes.map(n => 
                                    n.path === updatedChildList[0].path ? updatedChildList[0] : n
                                );
                                onStructureChange(newNodes);
                            }}
                            activeDragId={activeDragId}
                        />
                    ))}
                </div>
            </SortableContext>
            <DragOverlay>
                {activeDragId ? <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-md shadow-lg text-sm">Moving page...</div> : null}
            </DragOverlay>
        </DndContext>
    </div>
  );
}