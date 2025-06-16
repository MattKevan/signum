// src/components/publishing/FileTree.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { type StructureNode } from '@/types';
import { findNodeByPath } from '@/core/services/fileTree.service';
import { toast } from 'sonner';

import { GripVertical, ChevronRight, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
    DndContext, 
    closestCenter, 
    DragEndEvent, 
    DragStartEvent, 
    useDroppable,
    DragOverlay
} from '@dnd-kit/core';
import { 
    SortableContext, 
    useSortable, 
    verticalListSortingStrategy, 
    arrayMove 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Type Definitions ---
interface FileTreeProps {
  nodes: StructureNode[];
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
const DndNode: React.FC<FileTreeNodeProps> = ({ node, baseEditPath, activePath, activeDragId, onStructureChange }) => {
    const { attributes, listeners, setNodeRef: setSortableNodeRef, transform, transition } = useSortable({
        id: node.path,
        disabled: node.type !== 'page', // Only pages can be sorted/dragged
    });
    
    const [isOpen, setIsOpen] = useState(true);

    const isPage = node.type === 'page';
    // An item is only a valid drop target if it's a page and something is being dragged.
    const isNestableTarget = isPage && !!activeDragId;

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

    const href = `${baseEditPath}/content/${node.path.replace(/^content\//, '').replace(/\.md$/, '')}`;

    const handleChildrenStructureChange = (reorderedChildren: StructureNode[]) => {
        const newParentNode = { ...node, children: reorderedChildren };
        // This bubbles up the change to the parent FileTree instance
        onStructureChange([newParentNode]);
    };

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col">
            <div className={cn("flex items-center group w-full my-0.5 rounded-md transition-colors", dropIndicatorStyle)}>
                <div 
                    {...attributes} 
                    {...listeners} 
                    className={cn(
                        "p-1 cursor-grab touch-none text-muted-foreground/50",
                        !isPage && "cursor-not-allowed opacity-50" // Visual cue for non-draggable items
                    )}
                >
                    <GripVertical className="h-4 w-4" />
                </div>
                <div className={cn("flex-grow flex items-center py-1 pl-1 pr-1 rounded-md hover:bg-muted", activePath === node.path && "bg-accent text-accent-foreground")}>
                    <ChevronRight 
                        className={cn("h-4 w-4 mr-1 shrink-0 transition-transform duration-200", hasChildren ? 'cursor-pointer' : 'invisible', isOpen && "rotate-90")} 
                        onClick={() => hasChildren && setIsOpen(!isOpen)}
                    />
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Link href={href} className="truncate flex-grow mx-1.5 text-sm" title={node.title}>{node.title}</Link>
                </div>
            </div>
            {hasChildren && isOpen && (
                <div className="pl-6 border-l ml-4">
                    <FileTree
                        nodes={node.children!}
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
export default function FileTree({ nodes, baseEditPath, activePath, onStructureChange, className }: FileTreeProps) {
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

    const draggedNode = findNodeByPath(nodes, active.id as string);
    if (!draggedNode || draggedNode.type !== 'page') {
        toast.info("Collections cannot be re-ordered in this view.");
        return;
    }
    
    const overNode = findNodeByPath(nodes, over.id as string);

    // If overNode exists and is a page, it's a nesting attempt.
    if (overNode && overNode.type === 'page') {
        moveNode(siteId, active.id as string, over.id as string);
    } else {
        // Otherwise, it's a reordering attempt within the current list.
        const oldIndex = nodeIds.indexOf(active.id as string);
        const newIndex = nodeIds.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
            onStructureChange(arrayMove(nodes, oldIndex, newIndex));
        }
    }
  };

  return (
    <div className={cn("w-full", className)}>
        <DndContext 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd} 
            collisionDetection={closestCenter}
        >
            <SortableContext items={nodeIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                    {nodes.map(node => (
                        <DndNode 
                            key={node.path} 
                            node={node} 
                            baseEditPath={baseEditPath} 
                            activePath={activePath} 
                            // This callback is complex. It ensures that when a child's structure changes,
                            // the change is propagated up to the main list.
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