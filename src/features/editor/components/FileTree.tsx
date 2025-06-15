// src/components/publishing/FileTree.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { type StructureNode } from '@/types';
import { GripVertical, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TbFileDescription, TbLayoutGrid } from "react-icons/tb";
interface FileTreeProps {
  nodes: StructureNode[];
  baseEditPath: string;
  activePath?: string;
  onFileCreate: (parentPath: string) => void;
  onStructureChange: (nodes: StructureNode[]) => void;
}

interface FileTreeNodeProps extends Omit<FileTreeProps, 'nodes'> {
  node: StructureNode;
}

// A single sortable tree node.
const SortableNode: React.FC<FileTreeNodeProps> = ({ node, baseEditPath, activePath, onFileCreate, onStructureChange }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: node.path });
    const [isOpen, setIsOpen] = useState(true);
    
    const style = { transform: CSS.Transform.toString(transform), transition };

    const isFolderType = node.type === 'collection' || (node.type === 'page' && node.children && node.children.length > 0);
    
    // CORRECTED: Generate links robustly using the full relative path for pages.
    const relativeContentPath = node.path.replace(/^content\//, '').replace(/\.md$/, '');
    const href = node.type === 'collection'
        ? `${baseEditPath}/collection/${node.slug}`
        : `${baseEditPath}/content/${relativeContentPath}`;

    const isSelected = activePath === node.path;
    const NodeIcon = node.type === 'collection' ? TbLayoutGrid : (node.type === 'page' && node.children && node.children.length > 0 ? TbLayoutGrid : TbFileDescription);

    const handleChildrenStructureChange = (reorderedChildren: StructureNode[]) => {
        onStructureChange([{ ...node, children: reorderedChildren }]);
    };

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col">
            <div className="flex items-center group w-full my-0.5">
                <div {...attributes} {...listeners} className="p-1 cursor-grab touch-none">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className={cn("flex-grow flex items-center py-1 pl-1 pr-1 rounded-md hover:bg-muted relative", isSelected && "bg-accent text-accent-foreground")}>
                    {isFolderType && (
                        <ChevronRight 
                            className={cn("h-4 w-4 mr-1 shrink-0 transition-transform duration-200 cursor-pointer", isOpen && "rotate-90", !node.children?.length && "invisible")} 
                            onClick={() => setIsOpen(!isOpen)} 
                        />
                    )}
                    <NodeIcon className={cn("h-4 w-4 shrink-0", isFolderType ? 'text-foreground' : 'text-foreground', !isFolderType && 'ml-5')} />
                    
                    <Link href={href} className="truncate flex-grow mx-1.5 text-sm" title={node.title}>
                        {node.title}
                    </Link>

                    
                </div>
            </div>
            {isFolderType && isOpen && node.children && node.children.length > 0 && (
                <div className="pl-6">
                    <FileTree
                        nodes={node.children}
                        baseEditPath={baseEditPath}
                        activePath={activePath}
                        onFileCreate={onFileCreate}
                        onStructureChange={handleChildrenStructureChange}
                    />
                </div>
            )}
        </div>
    );
};

// The main FileTree component that sets up the DndContext.
export default function FileTree({ nodes, baseEditPath, activePath, onFileCreate, onStructureChange }: FileTreeProps) {
  const nodeIds = useMemo(() => nodes.map(n => n.path), [nodes]);

  if (!nodes || nodes.length === 0) {
    return <p className="p-2 text-sm text-muted-foreground">(No content files yet)</p>;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = nodeIds.indexOf(active.id as string);
        const newIndex = nodeIds.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedNodes = arrayMove(nodes, oldIndex, newIndex);
            const updatedNavOrderNodes = reorderedNodes.map((node, index) => {
                if (node.navOrder !== undefined) {
                    return { ...node, navOrder: index };
                }
                return node;
            });
            onStructureChange(updatedNavOrderNodes);
        }
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={nodeIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
                {nodes.map(node => (
                    <SortableNode 
                        key={node.path} 
                        node={node} 
                        baseEditPath={baseEditPath} 
                        activePath={activePath} 
                        onFileCreate={onFileCreate} 
                        onStructureChange={(updatedChildNode) => {
                            const newNodes = nodes.map(n => n.path === updatedChildNode[0].path ? updatedChildNode[0] : n);
                            onStructureChange(newNodes);
                        }}
                    />
                ))}
            </div>
        </SortableContext>
    </DndContext>
  );
}