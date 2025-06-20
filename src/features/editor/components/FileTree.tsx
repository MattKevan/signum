// src/features/editor/components/FileTree.tsx
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { type ParsedMarkdownFile, type StructureNode } from '@/types';
import { GripVertical, ChevronRight, File as FileIcon, LayoutGrid, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Props for the FileTree container and its nodes.
 * This interface is now complete, including all necessary props for rendering and recursion.
 */
interface FileTreeProps {
  nodes: StructureNode[];
  contentFiles: ParsedMarkdownFile[];
  baseEditPath: string;
  activePath?: string;
  nestingLevel?: number;
  className?: string; // For applying styles to the container
  // DND State Props
  activeId: string | null;
  overId: string | null;
  dropZone: 'nest' | 'reorder-before' | 'reorder-after' | 'root' | null;
}

/**
 * Props for a single draggable node within the tree.
 * It omits props that are specific to the container (`nodes`, `className`).
 */
interface DndNodeProps extends Omit<FileTreeProps, 'nodes' | 'className'> {
  node: StructureNode;
  isHomepage?: boolean; // Explicitly passed to the root node
}

/**
 * Renders a single, draggable node in the file tree.
 */
const DndNode: React.FC<DndNodeProps> = ({ 
  node, 
  contentFiles, 
  baseEditPath, 
  activePath, 
  isHomepage = false,
  nestingLevel = 0,
  activeId, 
  overId, 
  dropZone 
}) => {
  
  const fileForNode = useMemo(() => contentFiles.find(f => f.path === node.path), [contentFiles, node.path]);
  const hasChildren = useMemo(() => !!(node.children && node.children.length > 0), [node.children]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: node.path,
      disabled: isHomepage,
  });

  const isOverThisNode = overId === node.path;
  const showDropLineBefore = isOverThisNode && dropZone === 'reorder-before' && !isHomepage;
  const showDropLineAfter = isOverThisNode && dropZone === 'reorder-after';
  const showNestingHighlight = isOverThisNode && dropZone === 'nest' && !isHomepage;
  
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const editorSlug = node.path.replace(/^content\//, '').replace(/\.md$/, '');
  const href = `${baseEditPath}/content/${editorSlug}`;

  return (
    <div ref={setNodeRef} style={style} className="relative group text-sm">
      {/* Drop Zones for DND interaction */}
      <div data-dnd-zone="reorder-before" data-dnd-target={node.path} className={cn("absolute top-0 left-0 right-0 h-[30%] z-10", isHomepage && "hidden")} />
      <div data-dnd-zone="nest" data-dnd-target={node.path} data-dnd-disabled={isHomepage} className={cn("absolute top-[30%] left-0 right-0 h-[40%] z-10", isHomepage && "cursor-not-allowed")} />
      <div data-dnd-zone="reorder-after" data-dnd-target={node.path} className="absolute bottom-0 left-0 right-0 h-[30%] z-10" />
      
      {/* Visual Feedback for DND */}
      {showDropLineBefore && <div className="absolute -top-0.5 left-6 right-0 h-1 bg-blue-500 rounded-full z-20" />}
      
      <div className={cn("relative flex items-center w-full my-0.5 rounded-md transition-colors", showNestingHighlight ? "bg-blue-100 ring-2 ring-blue-500 ring-inset" : "bg-background")}>
        <div {...attributes} {...listeners} className={cn("p-1 touch-none text-muted-foreground/50", isHomepage ? "cursor-default" : "cursor-grab")}>
          <GripVertical className="h-4 w-4" />
        </div>
        <div className={cn("flex-grow flex items-center py-1 pl-1 pr-1", activePath === node.path && "font-semibold text-primary")}>
          <ChevronRight className={cn("h-4 w-4 mr-1 shrink-0", !hasChildren && "invisible")} />
          {isHomepage ? <Home className="h-4 w-4 shrink-0 text-primary" /> : (fileForNode?.frontmatter.collection ? <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />)}
          <Link href={href} className="truncate flex-grow mx-1.5 hover:underline">{node.menuTitle || node.title}</Link>
        </div>
      </div>

      {showDropLineAfter && <div className="absolute -bottom-0.5 left-6 right-0 h-1 bg-blue-500 rounded-full z-20" />}

      {/* Recursive Rendering for Child Nodes */}
      {hasChildren && (
        <div className="pl-6 border-l ml-4">
          <FileTree
             nodes={node.children!}
             contentFiles={contentFiles}
             baseEditPath={baseEditPath}
             activePath={activePath}
             nestingLevel={nestingLevel + 1}
             activeId={activeId}
             overId={overId}
             dropZone={dropZone}
             className="py-1" // Pass className for consistent styling
          />
        </div>
      )}
    </div>
  );
};

/**
 * The main container component that recursively renders the site's file structure.
 */
export default function FileTree(props: FileTreeProps) {
  const { nodes, ...rest } = props;
  return (
    <div className={cn("w-full", props.className)}>
      <div className="space-y-0.5">
        {nodes.map(node => (
          <DndNode 
            key={node.path} 
            node={node} 
            {...rest} // Pass all props down to each node
          />
        ))}
      </div>
    </div>
  );
}