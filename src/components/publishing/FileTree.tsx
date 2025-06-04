// src/components/publishing/FileTree.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { type TreeNode } from '@/lib/fileTreeUtils';
import { ChevronRight, Folder, FileText as FileTextIcon, FolderOpen, PlusSquare, FolderPlus as FolderPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// import { useRouter } from 'next/navigation'; // Can be used if needed

interface FileTreeProps {
  nodes: TreeNode[];
  baseEditPath: string;
  currentOpenFile?: string;
  onNodeClick?: (node: TreeNode) => void;
  onFileCreate: (parentPath: string) => void;
  onFolderCreate: (parentPath: string) => void;
}

interface FileTreeNodeProps {
  node: TreeNode;
  baseEditPath: string;
  currentOpenFile?: string;
  onNodeClick?: (node: TreeNode) => void;
  onFileCreate: (parentPath: string) => void;
  onFolderCreate: (parentPath: string) => void;
  level: number;
}

const FileOrFolderNode: React.FC<FileTreeNodeProps> = ({ 
    node, baseEditPath, currentOpenFile, onNodeClick, onFileCreate, onFolderCreate, level 
}) => {
  const [isOpen, setIsOpen] = useState(node.type === 'folder' ? true : false); 
  // const router = useRouter(); // Use if direct navigation is needed beyond Link

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    }
  };

  const NodeIcon = node.type === 'folder' ? (isOpen ? FolderOpen : Folder) : FileTextIcon;
  const indent = level * 16;

  const editSlugOrPathSegment = node.path.startsWith('content/') 
    ? node.path.substring('content/'.length) 
    : node.path;
  
  const finalEditSlug = node.type === 'file' 
    ? editSlugOrPathSegment.replace(/\.md$/, '') 
    : editSlugOrPathSegment; // For folders, this is the path segment

  const editHref = `${baseEditPath}/${finalEditSlug}`;

  const isSelected = node.type === 'file' && node.path === currentOpenFile;

  // Removed unused handleNodeClickInternal

  return (
    <div className="text-sm">
      <div
        className={cn(
            "flex items-center py-1.5 pr-1 rounded-md hover:bg-muted group relative",
            isSelected && "bg-accent text-accent-foreground hover:bg-accent/90"
        )}
        style={{ paddingLeft: `${indent}px` }}
      >
        {node.type === 'folder' && (
          <ChevronRight
            className={cn("h-4 w-4 mr-1 shrink-0 transition-transform duration-200 cursor-pointer", isOpen && "rotate-90")}
            onClick={handleToggle}
          />
        )}
        {!node.type && <div className="w-5 shrink-0"></div>} {/* Adjusted for alignment */}
        
        <NodeIcon className={cn("h-4 w-4 mr-1.5 shrink-0", node.type === 'folder' ? 'text-amber-500' : 'text-sky-500')} />
        
        <Link href={editHref} className="truncate flex-grow" title={node.name}>
            {node.name}
        </Link>

        <div className="ml-auto hidden group-hover:flex items-center gap-0.5 absolute right-1 top-1/2 -translate-y-1/2 bg-muted p-0.5 rounded shadow-sm">
            {node.type === 'folder' && (
                <>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="New File in Folder" onClick={(e) => { e.stopPropagation(); onFileCreate(node.path); }}>
                        <PlusSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="New Subfolder" onClick={(e) => { e.stopPropagation(); onFolderCreate(node.path); }}>
                        <FolderPlusIcon className="h-3.5 w-3.5" />
                    </Button>
                </>
            )}
            {/* Example for file actions (e.g., delete)
            {node.type === 'file' && (
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete File" onClick={(e) => { e.stopPropagation(); console.log('delete file:', node.path); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
            )}
            */}
        </div>
      </div>
      {node.type === 'folder' && isOpen && node.children && node.children.length > 0 && (
        <div className="pl-0">
          {node.children.map(childNode => (
            <FileOrFolderNode 
                key={childNode.id} 
                node={childNode} 
                baseEditPath={baseEditPath}
                currentOpenFile={currentOpenFile}
                onNodeClick={onNodeClick}
                onFileCreate={onFileCreate}
                onFolderCreate={onFolderCreate}
                level={level + 1}
            />
          ))}
        </div>
      )}
      {node.type === 'folder' && isOpen && (!node.children || node.children.length === 0) && (
        <div className="py-1 pr-2 text-xs text-muted-foreground" style={{ paddingLeft: `${indent + 16 + 4 + 16 + 4}px` }}> {/* Adjusted padding */}
            (empty)
        </div>
      )}
    </div>
  );
};

export default function FileTree({ nodes, baseEditPath, currentOpenFile, onFileCreate, onFolderCreate, onNodeClick }: FileTreeProps) {
  if (!nodes || nodes.length === 0) {
    return <p className="p-2 text-sm text-muted-foreground">(No content files yet)</p>;
  }

  return (
    <div className="space-y-0.5">
      {nodes.map(node => (
        <FileOrFolderNode 
            key={node.id} 
            node={node} 
            baseEditPath={baseEditPath}
            currentOpenFile={currentOpenFile}
            onNodeClick={onNodeClick}
            onFileCreate={onFileCreate}
            onFolderCreate={onFolderCreate}
            level={0} 
        />
      ))}
    </div>
  );
}