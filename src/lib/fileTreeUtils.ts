// src/lib/fileTreeUtils.ts
import { ParsedMarkdownFile } from '@/types';

export interface TreeNode {
  id: string; // Full path, unique
  name: string; // File or folder name
  type: 'file' | 'folder';
  path: string; // Full path from 'content/' root
  children?: TreeNode[];
  fileData?: ParsedMarkdownFile; // Only for 'file' type
}

/**
 * Converts a flat list of ParsedMarkdownFile into a hierarchical TreeNode structure.
 * Assumes paths are relative to a 'content/' root implicitly.
 */
export function buildFileTree(files: ParsedMarkdownFile[]): TreeNode[] {
  const root: TreeNode = { id: 'content', name: 'content', type: 'folder', path: 'content', children: [] };

  files.forEach(file => {
    // file.path is like "content/posts/my-post.md"
    // We want path segments relative to "content/"
    const relativePath = file.path.startsWith('content/') ? file.path.substring('content/'.length) : file.path;
    const segments = relativePath.split('/').filter(s => s !== '');
    
    let currentNode = root;

    segments.forEach((segment, index) => {
      const isLastSegment = index === segments.length - 1;
      const segmentPath = segments.slice(0, index + 1).join('/');
      const fullPath = `content/${segmentPath}`;

      let childNode = currentNode.children?.find(child => child.path === fullPath);

      if (!childNode) {
        if (isLastSegment && segment.endsWith('.md')) { // It's a file
          childNode = {
            id: fullPath,
            name: segment,
            type: 'file',
            path: fullPath,
            fileData: file,
          };
        } else { // It's a folder
          childNode = {
            id: fullPath,
            name: segment,
            type: 'folder',
            path: fullPath,
            children: [],
          };
        }
        currentNode.children?.push(childNode);
        currentNode.children?.sort((a,b) => { // Sort: folders first, then alphabetically
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
      }
      // If it's a folder, move into it for the next segment
      if (childNode.type === 'folder') {
        currentNode = childNode;
      }
    });
  });

  return root.children || []; // Return children of the implicit 'content' root
}

/**
 * Gets the parent path from a given path.
 * e.g., "content/posts/foo.md" -> "content/posts"
 * e.g., "content/posts" -> "content"
 * e.g., "content" -> "" (or a root marker)
 */
export function getParentPath(path: string): string {
  if (!path || path === 'content') return 'content'; // Or handle root differently
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || 'content';
}

/**
 * Gets the name (file or folder name) from a path.
 */
export function getNameFromPath(path: string): string {
  if (!path) return '';
  return path.substring(path.lastIndexOf('/') + 1);
}

/**
 * Validates a new file or folder name.
 * Basic validation: no slashes, not empty, common invalid chars.
 */
export function isValidName(name: string): boolean {
    if (!name || name.trim() === '') return false;
    if (name.includes('/') || name.includes('\\')) return false;
    // Add more checks for invalid characters like < > : " | ? *
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(name)) return false;
    return true;
}