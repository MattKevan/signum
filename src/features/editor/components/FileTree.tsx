// src/features/editor/components/FileTree.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { type ParsedMarkdownFile, type StructureNode } from '@/types';
import { GripVertical, ChevronRight, File as FileIcon, LayoutGrid, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { getDescendantIds } from '@/core/services/fileTree.service'; // <-- FIX: ADD THIS IMPORT

// --- Type Definitions ---
type DndIndicator = {
    path: string;
    intent: 'reorder-before' | 'reorder-after' | 'nest';
} | null;

interface FileTreeProps {
  nodes: StructureNode[];
  contentFiles: ParsedMarkdownFile[];
  baseEditPath: string;
  activePath: string | undefined;
  homepagePath: string | undefined;
  dndIndicator: DndIndicator;
  nestingLevel?: number;
}

interface FileTreeNodeProps extends Omit<FileTreeProps, 'nodes'> {
  node: StructureNode;
}

// --- Single Tree Node Component ---
const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, contentFiles, baseEditPath, activePath, homepagePath, dndIndicator, nestingLevel = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  
  const isHomepage = node.path === homepagePath;
  const fileForNode = useMemo(() => contentFiles.find(f => f.path === node.path), [contentFiles, node.path]);
  const isCollection = !!fileForNode?.frontmatter.collection;
  const hasChildren = node.children && node.children.length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.path,
    disabled: isHomepage,
  });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: node.path,
    data: { type: 'container', isCollection },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${nestingLevel * 1.25}rem`,
    opacity: isDragging ? 0.5 : 1,
  };

  const editorSlug = node.path.replace(/^content\//, '').replace(/\.md$/, '');
  const href = `${baseEditPath}/content/${editorSlug}`;

  const isDropTarget = dndIndicator?.path === node.path;
  const showDropLineBefore = isDropTarget && dndIndicator.intent === 'reorder-before';
  const showDropLineAfter = isDropTarget && dndIndicator.intent === 'reorder-after';
  const showNestingHighlight = isDropTarget && dndIndicator.intent === 'nest';

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {showDropLineBefore && <div className="absolute -top-0.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20" />}
      
      <div
        ref={setDroppableRef}
        className={cn(
          "flex items-center group w-full my-0.5 rounded-md relative transition-colors",
          showNestingHighlight && "bg-blue-100 dark:bg-blue-900/40",
          activePath === node.path && !showNestingHighlight && "bg-accent text-accent-foreground"
        )}
      >
        <button {...listeners} {...attributes} disabled={isHomepage} className={cn("p-1 touch-none", isHomepage ? "cursor-default text-muted-foreground/30" : "cursor-grab text-muted-foreground/50 hover:text-muted-foreground")}>
          <GripVertical className="h-4 w-4" />
        </button>
        
        <div className="flex-grow flex items-center py-1 pl-1 pr-1">
          {hasChildren ? (<ChevronRight className={cn("h-4 w-4 mr-1 shrink-0 transition-transform duration-200 cursor-pointer", isOpen && "rotate-90")} onClick={() => setIsOpen(!isOpen)} />) : (<span className="w-4 h-4 mr-1 shrink-0" />)}

          {isHomepage ? <Home className="h-4 w-4 shrink-0 text-primary" /> : isCollection ? <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          
          <Link href={href} className="truncate flex-grow mx-1.5 text-sm hover:underline" title={node.title}>{node.menuTitle || node.title}</Link>
        </div>
      </div>
      
      {showDropLineAfter && <div className="absolute -bottom-0.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20" />}
      
      {hasChildren && isOpen && (
        <FileTree
          nodes={node.children!}
          {...{ contentFiles, baseEditPath, activePath, homepagePath, dndIndicator }}
          nestingLevel={nestingLevel + 1}
        />
      )}
    </div>
  );
};

// --- Main File Tree Container ---
export default function FileTree({ nodes, contentFiles, baseEditPath, activePath, homepagePath, dndIndicator }: FileTreeProps) {
  const nodeIds = useMemo(() => getDescendantIds(nodes), [nodes]);

  if (!nodes || nodes.length === 0) return null;

  return (
    <SortableContext items={nodeIds} strategy={verticalListSortingStrategy}>
      <div className="space-y-0.5">
        {nodes.map(node => (
          <FileTreeNode key={node.path} node={node} {...{ contentFiles, baseEditPath, activePath, homepagePath, dndIndicator }}/>
        ))}
      </div>
    </SortableContext>
  );
}