// src/components/publishing/FileTree.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { type TreeNode } from '@/lib/fileTreeUtils';
import { Folder, FileText as FileTextIcon, PlusSquare, GripVertical, ChevronRight, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FileTreeProps {
  nodes: TreeNode[];
  baseEditPath: string;
  activePath?: string;
  onFileCreate: (parentPath: string) => void;
  onStructureChange: (nodes: TreeNode[]) => void;
}

interface FileTreeNodeProps extends FileTreeProps {
  node: TreeNode;
}

const SortableNode: React.FC<FileTreeNodeProps> = ({ node, nodes, baseEditPath, activePath, onFileCreate, onStructureChange }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: node.id });
    const [isOpen, setIsOpen] = useState(true);
    
    const style = { transform: CSS.Transform.toString(transform), transition };

    const isFolderType = node.type === 'folder' || node.type === 'collection';

    const href = node.type === 'collection'
        ? `${baseEditPath}/collection/${node.path.replace('content/', '')}`
        : node.type === 'file'
        ? `${baseEditPath}/content/${node.path.replace('content/', '').replace('.md', '')}`
        : '#';

    const isSelected = activePath === node.path || (isFolderType && activePath?.startsWith(node.path));

    const NodeIcon = node.type === 'collection' ? Folder : (node.type === 'folder' ? FolderGit2 : FileTextIcon);

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col">
            <div className="flex items-center group w-full">
                <div {...attributes} {...listeners} className="p-1 cursor-grab touch-none">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className={cn("flex-grow flex items-center py-1.5 pl-1 pr-1 rounded-md hover:bg-muted relative", isSelected && "bg-accent text-accent-foreground")}>
                    {isFolderType && (
                        <ChevronRight className={cn("h-4 w-4 mr-1 shrink-0 transition-transform duration-200 cursor-pointer", isOpen && "rotate-90", !node.children?.length && "invisible")} onClick={() => setIsOpen(!isOpen)} />
                    )}
                    <NodeIcon className={cn("h-4 w-4 shrink-0", isFolderType ? 'text-amber-500' : 'text-sky-500', !isFolderType && 'ml-5')} />
                    
                    <Link href={href} className="truncate flex-grow mx-1.5" title={node.name} onClick={(e) => { if (href === '#') e.preventDefault() }}>
                        {node.name}
                    </Link>

                    <div className="ml-auto hidden group-hover:flex items-center gap-0.5 absolute right-1 top-1/2 -translate-y-1/2 bg-muted p-0.5 rounded shadow-sm">
                        {isFolderType && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="New File" onClick={(e) => { e.stopPropagation(); onFileCreate(node.path); }}>
                                <PlusSquare className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {isFolderType && isOpen && node.children && node.children.length > 0 && (
                <div className="pl-6">
                    <FileTree nodes={node.children} baseEditPath={baseEditPath} activePath={activePath} onFileCreate={onFileCreate} onStructureChange={(newChildren) => {
                        const newParentNode = { ...node, children: newChildren };
                        const newNodes = nodes.map(n => n.id === node.id ? newParentNode : n);
                        onStructureChange(newNodes);
                    }} />
                </div>
            )}
        </div>
    );
};

export default function FileTree({ nodes, baseEditPath, activePath, onFileCreate, onStructureChange }: FileTreeProps) {
  const nodeIds = useMemo(() => nodes.map(n => n.id), [nodes]);

  if (!nodes || nodes.length === 0) {
    return <p className="p-2 text-sm text-muted-foreground">(No content files yet)</p>;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = nodeIds.indexOf(active.id as string);
        const newIndex = nodeIds.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
            onStructureChange(arrayMove(nodes, oldIndex, newIndex));
        }
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={nodeIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
                {nodes.map(node => (
                    <SortableNode key={node.id} node={node} nodes={nodes} baseEditPath={baseEditPath} activePath={activePath} onFileCreate={onFileCreate} onStructureChange={onStructureChange} />
                ))}
            </div>
        </SortableContext>
    </DndContext>
  );
}