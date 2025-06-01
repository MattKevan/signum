// src/components/publishing/FileTree.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TreeNode } from '@/lib/fileTreeUtils';
import { ChevronRight, Folder, FileText, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // For conditional class names (from shadcn/ui setup)

interface FileTreeProps {
  nodes: TreeNode[];
  baseEditPath: string; // e.g., /edit/siteId/content
  currentOpenFile?: string; // Full path of the currently open file, e.g., "content/posts/my-post.md"
  onNodeClick?: (node: TreeNode) => void; // For handling clicks if not navigation
  onFileCreate?: (parentPath: string) => void; // Callback to create file in parentPath
  onFolderCreate?: (parentPath: string) => void; // Callback to create folder in parentPath
}

interface FileTreeNodeProps {
  node: TreeNode;
  baseEditPath: string;
  currentOpenFile?: string;
  onNodeClick?: (node: TreeNode) => void;
  onFileCreate?: (parentPath: string) => void;
  onFolderCreate?: (parentPath: string) => void;
  level: number;
}

const FileOrFolderNode: React.FC<FileTreeNodeProps> = ({ 
    node, baseEditPath, currentOpenFile, onNodeClick, onFileCreate, onFolderCreate, level 
}) => {
  const [isOpen, setIsOpen] = useState(node.type === 'folder' ? true : false); // Folders default open for now

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation if clicking on chevron
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    }
  };

  const Icon = node.type === 'folder' ? (isOpen ? FolderOpen : Folder) : FileText;
  const indent = level * 16; // 16px per level

  // Path for editing: remove 'content/' prefix and '.md' suffix for files
  const editSlug = node.path.startsWith('content/') ? node.path.substring('content/'.length) : node.path;
  const finalEditSlug = node.type === 'file' ? editSlug.replace(/\.md$/, '') : editSlug;
  const editHref = node.type === 'file' ? `${baseEditPath}/${finalEditSlug}` : '#'; // Folders are not directly editable via link for now

  const isSelected = node.type === 'file' && node.path === currentOpenFile;

  const handleNodeClick = () => {
    if (onNodeClick) {
      onNodeClick(node);
    }
    if (node.type === 'folder' && !onNodeClick) { // Default behavior if no onNodeClick for folder
        setIsOpen(!isOpen);
    }
  };

  return (
    <div className="text-sm">
      <div
        onClick={handleNodeClick}
        className={cn(
            "flex items-center py-1.5 pr-2 rounded-md hover:bg-muted cursor-pointer group",
            isSelected && "bg-accent text-accent-foreground hover:bg-accent/90"
        )}
        style={{ paddingLeft: `${indent}px` }}
      >
        {node.type === 'folder' && (
          <ChevronRight
            className={cn("h-4 w-4 mr-1 shrink-0 transition-transform duration-200", isOpen && "rotate-90")}
            onClick={handleToggle} // Allow toggling by clicking chevron
          />
        )}
        <Icon className={cn("h-4 w-4 mr-2 shrink-0", node.type === 'folder' ? 'text-blue-500' : 'text-gray-500')} />
        {node.type === 'file' ? (
            <Link href={editHref} className="truncate flex-grow" title={node.name}>
                {node.name.replace(/\.md$/, '')}
            </Link>
        ) : (
            <span className="truncate flex-grow font-medium" title={node.name}>{node.name}</span>
        )}

        {/* Action buttons (visible on hover over the node's div) - Basic Example */}
        {node.type === 'folder' && (
            <div className="ml-auto hidden group-hover:flex items-center gap-1">
                {onFileCreate && (
                    <Button variant="ghost" size="sm" title="New File in Folder" onClick={(e) => { e.stopPropagation(); onFileCreate(node.path); }}>
                        <FileText className="h-3 w-3" />
                    </Button>
                )}
                {onFolderCreate && (
                     <Button variant="ghost" size="sm" title="New Subfolder" onClick={(e) => { e.stopPropagation(); onFolderCreate(node.path); }}>
                        <Folder className="h-3 w-3" />
                    </Button>
                )}
            </div>
        )}
      </div>
      {node.type === 'folder' && isOpen && node.children && node.children.length > 0 && (
        <div className="pl-0"> {/* No extra padding here, handled by node's style */}
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
        <div className="py-1 pr-2 text-xs text-muted-foreground" style={{ paddingLeft: `${indent + 16 + 4 + 16}px` }}>
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