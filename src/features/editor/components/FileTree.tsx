// src/features/editor/components/FileTree.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import FileTreeNode from './FileTreeNode';
import type { FlattenedNode } from '@/core/services/fileTree.service';

/**
 * Defines the shape of the visual drop indicator state, passed from the parent.
 */
interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

/**
 * Defines the props accepted by the FileTree component.
 * It now receives the homepage and sortable items as separate collections.
 */
interface FileTreeProps {
  homepageItem: FlattenedNode;
  sortableItems: FlattenedNode[];
  activeId: string | null;
  projected: DndProjection | null;
  baseEditPath: string;
  activePath: string | undefined;
  onCollapse: (id: string) => void;
}

/**
 * The main container for the sortable file tree.
 * It now renders the homepage separately and wraps only the sortable items
 * in the dnd-kit context, making the homepage inert to DND interactions.
 */
export default function FileTree({
  homepageItem,
  sortableItems,
  activeId,
  projected,
  baseEditPath,
  activePath,
  onCollapse,
}: FileTreeProps) {
  /**
   * Memoize the list of sortable IDs to provide to `SortableContext`.
   */
  const sortedIds = useMemo(() => sortableItems.map(({ path }) => path), [sortableItems]);

  return (
    <ul className="space-y-0.5">
      {/* Render the homepage statically, OUTSIDE of the SortableContext. */}
      <FileTreeNode
        item={homepageItem}
        activeId={activeId}
        projected={projected}
        baseEditPath={baseEditPath}
        activePath={activePath}
        homepagePath={homepageItem.path}
        onCollapse={onCollapse}
      />

      {/* The SortableContext only contains items that are actually sortable. */}
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {sortableItems.map((item) => (
          <FileTreeNode
            key={item.path}
            item={item}
            activeId={activeId}
            projected={projected}
            baseEditPath={baseEditPath}
            activePath={activePath}
            homepagePath={homepageItem.path}
            onCollapse={onCollapse}
          />
        ))}
      </SortableContext>
    </ul>
  );
}