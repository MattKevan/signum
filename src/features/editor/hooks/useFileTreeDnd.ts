// src/features/editor/hooks/useFileTreeDnd.ts
'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import type { LocalSiteData, StructureNode } from '@/types';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';

// Helper functions can be co-located or moved to a service
function findNodeByPath(nodes: StructureNode[], path: string): StructureNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

function findParentOfNode(nodes: StructureNode[], path: string, parent: StructureNode | null = null): StructureNode | null {
    for (const node of nodes) {
        if (node.path === path) return parent;
        if (node.children) {
            const found = findParentOfNode(node.children, path, node);
            if (found) return found;
        }
    }
    return null;
}

function updateNodeInChildren(nodes: StructureNode[], parentPath: string, newChildren: StructureNode[]): StructureNode[] {
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

/**
 * A custom hook to manage all drag-and-drop logic for the site's file tree.
 */
export function useFileTreeDnd(site: LocalSiteData | undefined) {
  const { updateManifest, moveNode } = useAppStore.getState();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over, delta } = event;

    if (!site || !over || active.id === over.id) return;
    const siteId = site.siteId;
    const structure = site.manifest.structure;

    const activePath = active.id as string;
    const overPath = over.id as string;

    // --- SCENARIO 1: UN-NESTING ---
    // This is the most definite action, so we check it first.
    if (over.id === '__sidebar_root_droppable__') {
      const parent = findParentOfNode(structure, activePath);
      if (parent) { // Ensure it was actually nested
        moveNode(siteId, activePath, null);
      }
      return;
    }

    const parentOfActive = findParentOfNode(structure, activePath);
    const parentOfOver = findParentOfNode(structure, overPath);
    const targetNode = findNodeByPath(structure, overPath);

    // --- INTENT-BASED LOGIC ---
    // `delta.y` is the vertical distance the mouse moved.
    // `over.rect` is the bounding box of the target item.
    const isDroppingInTopHalf = delta.y < over.rect.height / 2;
    const isDroppingInBottomHalf = delta.y >= over.rect.height / 2;
    
    // --- SCENARIO 2: NESTING (User dropped squarely on a valid target) ---
    // A nesting action is now more explicit. We check if the dragged item is being
    // dropped somewhere in the middle of the target, not near the edges.
    const isNestingAttempt = over.rect.height > 30 && delta.y > 10 && delta.y < (over.rect.height - 10);

    if (isNestingAttempt) {
        if (!parentOfActive && targetNode && !parentOfOver) { // Dragging a root item onto another root item
            const isTargetCollection = !!site.contentFiles?.find(f => f.path === targetNode.path)?.frontmatter.collection;
            if (isTargetCollection) {
                toast.error("Cannot nest pages under a Collection Page.");
                return;
            }
            moveNode(siteId, activePath, overPath);
            return;
        }
    }
    
    // --- SCENARIO 3: REORDERING ---
    // This now covers all other cases. The user is dropping near the top or bottom
    // edge of an item, indicating they want to reorder.
    if (parentOfActive?.path === parentOfOver?.path) {
        const listToReorder = parentOfActive ? parentOfActive.children! : structure;
        const oldIndex = listToReorder.findIndex(n => n.path === activePath);
        let newIndex = listToReorder.findIndex(n => n.path === overPath);

        if (oldIndex === -1 || newIndex === -1) return;
        
        // Adjust index for dropping before/after
        if (isDroppingInBottomHalf && oldIndex < newIndex) {
            // No change needed when dragging down past an item
        } else if (isDroppingInTopHalf && oldIndex > newIndex) {
            // No change needed when dragging up past an item
        } else if (isDroppingInTopHalf) {
            newIndex = newIndex;
        } else if (isDroppingInBottomHalf) {
            newIndex = newIndex + 1;
        }

        const reorderedList = arrayMove(listToReorder, oldIndex, newIndex);
        let newStructure: StructureNode[];

        if (parentOfActive) {
            newStructure = updateNodeInChildren(structure, parentOfActive.path, reorderedList);
        } else {
            newStructure = reorderedList;
        }
        updateManifest(siteId, { ...site.manifest, structure: newStructure });
    } else {
        // This handles moving an item from nested to root, or root to another list (if we allowed it).
        // For un-nesting, the user must drop on the dedicated root zone.
        // This prevents accidental un-nesting when trying to reorder.
    }

  }, [site, moveNode, updateManifest]);

  return {
    activeDragId,
    handleDragStart,
    handleDragEnd,
  };
}