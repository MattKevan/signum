// src/core/services/fileTree.service.ts
import { StructureNode } from '@/types';

/**
 * Finds a node in a structure tree by its exact `path`.
 */
export function findNodeByPath(nodes: StructureNode[], path: string): StructureNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Recursively traverses the structure tree and collects all nodes.
 */
export function flattenStructureToRenderableNodes(nodes: StructureNode[]): StructureNode[] {
  let renderableNodes: StructureNode[] = [];
  for (const node of nodes) {
    renderableNodes.push(node);
    if (node.children) {
      renderableNodes = renderableNodes.concat(flattenStructureToRenderableNodes(node.children));
    }
  }
  return renderableNodes;
}

/**
 * Gets the parent directory path for a given file path.
 */
export function getParentPath(path: string): string {
  if (!path.includes('/')) return 'content';
  return path.substring(0, path.lastIndexOf('/'));
}

/**
 * Finds and removes a node from a tree structure.
 */
export function findAndRemoveNode(nodes: StructureNode[], path: string): { found: StructureNode | null, tree: StructureNode[] } {
  let found: StructureNode | null = null;
  const filterRecursively = (currentNodes: StructureNode[]): StructureNode[] => currentNodes.reduce((acc: StructureNode[], node) => {
    if (node.path === path) {
      found = node;
      return acc;
    }
    if (node.children) node.children = filterRecursively(node.children);
    acc.push(node);
    return acc;
  }, []);
  const newTree = filterRecursively(nodes);
  return { found, tree: newTree };
}

/**
 * Recursively updates the path of a node and all of its descendants.
 */
export function updatePathsRecursively(node: StructureNode, newParentPath: string): StructureNode {
  const oldFileName = node.path.substring(node.path.lastIndexOf('/'));
  const newPath = `${newParentPath}${oldFileName}`;
  const newSlug = newPath.replace(/^content\//, '').replace(/\.md$/, '');
  const updatedNode: StructureNode = { ...node, path: newPath, slug: newSlug };
  if (updatedNode.children) {
    const newChildsParentPath = newPath.replace(/\.md$/, '');
    updatedNode.children = updatedNode.children.map(child => updatePathsRecursively(child, newChildsParentPath));
  }
  return updatedNode;
}

/**
 * Finds all direct child nodes of a given parent node path.
 */
export function findChildNodes(nodes: StructureNode[], parentPath: string): StructureNode[] {
    const parentNode = findNodeByPath(nodes, parentPath);
    return parentNode?.children || [];
}

/**
 * Finds the parent of a node in the structure tree.
 * FIX: This function is now properly exported.
 */
export function findParentOfNode(nodes: StructureNode[], path: string, parent: StructureNode | null = null): StructureNode | null {
    for (const node of nodes) {
        if (node.path === path) return parent;
        if (node.children) {
            const found = findParentOfNode(node.children, path, node);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Updates a specific node's children within a larger tree structure.
 * FIX: This function is now properly exported.
 */
export function updateNodeInChildren(nodes: StructureNode[], parentPath: string, newChildren: StructureNode[]): StructureNode[] {
    return nodes.map(node => {
        if (node.path === parentPath) {
            return { ...node, children: newChildren };
        }
        if (node.children) {
            return { ...node, children: updateNodeInChildren(node.children, parentPath, newChildren) };
        }
        return node;
    });
}