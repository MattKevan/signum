// src/lib/fileTreeUtils.ts
import { ParsedMarkdownFile } from '@/types';

export interface TreeNode {
  id: string;
  name: string; // This will now be title or filename
  type: 'file' | 'folder';
  path: string;
  children?: TreeNode[];
  fileData?: ParsedMarkdownFile;
}

export function buildFileTree(files: ParsedMarkdownFile[]): TreeNode[] {
  const root: TreeNode = { id: 'content', name: 'content', type: 'folder', path: 'content', children: [] };

  files.forEach(file => {
    const relativePath = file.path.startsWith('content/') ? file.path.substring('content/'.length) : file.path;
    const segments = relativePath.split('/').filter(s => s !== '');
    
    let currentNode = root;

    segments.forEach((segment, index) => {
      const isLastSegment = index === segments.length - 1;
      const segmentPath = segments.slice(0, index + 1).join('/');
      const fullPath = `content/${segmentPath}`;

      let childNode = currentNode.children?.find(child => child.path === fullPath);

      if (!childNode) {
        const nodeName = (isLastSegment && file.frontmatter?.title) 
          ? file.frontmatter.title // Use title for files if available
          : segment.endsWith('.md') ? segment.replace(/\.md$/, '') : segment; // Fallback to segment name (filename without .md for files)

        if (isLastSegment && segment.endsWith('.md')) {
          childNode = {
            id: fullPath,
            name: nodeName, // Use title or filename
            type: 'file',
            path: fullPath,
            fileData: file,
          };
        } else {
          childNode = {
            id: fullPath,
            name: nodeName, // Folder name
            type: 'folder',
            path: fullPath,
            children: [],
          };
        }
        currentNode.children?.push(childNode);
        currentNode.children?.sort((a,b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
      } else if (childNode.type === 'file' && childNode.fileData?.frontmatter?.title && childNode.name !== childNode.fileData.frontmatter.title) {
        // Update name if title changed
        childNode.name = childNode.fileData.frontmatter.title;
      }


      if (childNode.type === 'folder') {
        currentNode = childNode;
      }
    });
  });

  return root.children || [];
}

// getParentPath, getNameFromPath, isValidName remain the same
export function getParentPath(path: string): string {
  if (!path || path === 'content') return 'content';
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || 'content';
}

export function getNameFromPath(path: string): string {
  if (!path) return '';
  return path.substring(path.lastIndexOf('/') + 1);
}

export function isValidName(name: string): boolean {
    if (!name || name.trim() === '') return false;
    if (name.includes('/') || name.includes('\\')) return false;
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(name)) return false;
    return true;
}