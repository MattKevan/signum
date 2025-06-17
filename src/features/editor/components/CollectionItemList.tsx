// src/features/editor/components/CollectionItemList.tsx
'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { findChildNodes } from '@/core/services/fileTree.service';
import { Button } from '@/core/components/ui/button';
import { FileText, PlusCircle } from 'lucide-react';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

interface CollectionItemListProps {
  siteId: string;
  collectionPagePath: string; // e.g., 'content/blog.md'
}

export default function CollectionItemList({ siteId, collectionPagePath }: CollectionItemListProps) {
  const site = useAppStore(state => state.getSiteById(siteId));

  const collectionItems = useMemo(() => {
    if (!site?.manifest) return [];
    return findChildNodes(site.manifest.structure, collectionPagePath);
  }, [site?.manifest, collectionPagePath]);

  const newItemPath = `/sites/${siteId}/edit/content/${collectionPagePath.replace('content/', '').replace('.md', '')}/${NEW_FILE_SLUG_MARKER}`;

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex shrink-0 items-center justify-between mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold">Collection Items</h1>
        <Button asChild>
          <Link href={newItemPath}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Item
          </Link>
        </Button>
      </div>
      <div className="flex-grow rounded-lg bg-background p-1 overflow-y-auto">
        {collectionItems.length > 0 ? (
          <ul className="space-y-1">
            {collectionItems.map((item) => {
              // --- THIS IS THE FIX ---
              // Generate the link from the reliable `item.path` instead of `item.slug`.
              const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
              const itemEditorPath = `/sites/${siteId}/edit/content/${editorSlug}`;
              // --- END OF FIX ---

              return (
                <li key={item.path}>
                  <Link href={itemEditorPath} className="flex items-center rounded-md p-2 transition-colors hover:bg-muted">
                    <FileText className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{item.title || item.slug}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center text-muted-foreground py-10">
            <p>No items have been added to this collection yet.</p>
            <Button asChild variant="outline" className="mt-4">
               <Link href={newItemPath}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add your first item
                </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}