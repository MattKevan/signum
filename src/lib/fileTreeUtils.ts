// src/lib/fileTreeUtils.ts
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