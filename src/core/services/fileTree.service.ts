// src/core/services/fileTree.service.ts

import { StructureNode } from '@/types';

/**
 * Finds a node in a structure tree by its exact `path`.
 * @param nodes The array of nodes to search within.
 * @param path The path of the node to find (e.g., "content/blog/first-post.md").
 * @returns The found StructureNode or undefined.
 */
export function findNodeByPath(nodes: StructureNode[], path: string): StructureNode | undefined {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Recursively traverses the structure tree and collects all nodes that are pages.
 * @param nodes The array of nodes to traverse.
 * @returns A flat array of all page-type StructureNodes.
 */
export function flattenStructureToPages(nodes: StructureNode[]): StructureNode[] {
  let pages: StructureNode[] = [];
  for (const node of nodes) {
    if (node.type === 'page') {
      pages.push(node);
    }
    if (node.children) {
      pages = pages.concat(flattenStructureToPages(node.children));
    }
  }
  return pages;
}

/**
 * Recursively traverses the structure tree and collects all nodes that can be rendered as a page.
 * This includes single pages AND collection listing pages.
 * @param nodes The array of nodes to traverse.
 * @returns A flat array of all renderable StructureNodes.
 */
export function flattenStructureToRenderableNodes(nodes: StructureNode[]): StructureNode[] {
  let renderableNodes: StructureNode[] = [];
  for (const node of nodes) {
    if (node.type === 'page' || node.type === 'collection') {
      renderableNodes.push(node);
    }
    if (node.children) {
      renderableNodes = renderableNodes.concat(flattenStructureToRenderableNodes(node.children));
    }
  }
  return renderableNodes;
}

/**
 * Gets the parent directory path for a given file path.
 * e.g., "content/blog/post.md" -> "content/blog"
 * @param path The full path of a file or folder.
 * @returns The path of the parent directory.
 */
export function getParentPath(path: string): string {
  if (!path.includes('/')) return 'content';
  return path.substring(0, path.lastIndexOf('/'));
}

/**
 * Finds a node by its path and removes it from a tree structure, returning both the found node and the modified tree.
 * This is a pure function; it does not mutate the original array.
 * @param {StructureNode[]} nodes - The array of nodes to search.
 * @param {string} path - The path of the node to remove.
 * @returns An object containing the found node and the updated tree.
 */
export function findAndRemoveNode(nodes: StructureNode[], path: string): { found: StructureNode | null, tree: StructureNode[] } {
  let found: StructureNode | null = null;
  
  const filterRecursively = (currentNodes: StructureNode[]): StructureNode[] => {
    const result: StructureNode[] = [];
    for (const node of currentNodes) {
      if (node.path === path) {
        found = node;
        continue; // Skip adding it to the result, effectively removing it
      }
      if (node.children) {
        const newChildren = filterRecursively(node.children);
        result.push({ ...node, children: newChildren });
      } else {
        result.push(node);
      }
    }
    return result;
  };

  const newTree = filterRecursively(nodes);
  return { found, tree: newTree };
}


/**
 * Recursively updates the path of a node and all of its descendants based on a new parent path.
 * @param {StructureNode} node - The node to start from.
 * @param {string} newParentPath - The new parent path segment (e.g., 'content/about').
 * @returns {StructureNode} The node with all paths and slugs updated.
 */
export function updatePathsRecursively(node: StructureNode, newParentPath: string): StructureNode {
  const oldSlug = node.slug;
  const newPath = `${newParentPath}/${oldSlug}.md`;
  
  const updatedNode: StructureNode = { ...node, path: newPath };

  if (updatedNode.children) {
    // The new parent path for the children is the updated node's path, without the '.md' extension.
    const newChildsParentPath = newPath.replace(/\.md$/, '');
    updatedNode.children = updatedNode.children.map(child => 
      updatePathsRecursively(child, newChildsParentPath)
    );
  }

  return updatedNode;
}