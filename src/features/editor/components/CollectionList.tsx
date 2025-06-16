// src/components/publishing/CollectionList.tsx
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/core/state/useAppStore';
import NewCollectionDialog from '@/features/editor/components/NewCollectionDialog';
import { Button } from '@/core/components/ui/button';
import { FolderPlus, LayoutGrid } from 'lucide-react';
import type { StructureNode } from '@/types';

interface CollectionListProps {
  siteId: string;
}

export default function CollectionList({ siteId }: CollectionListProps) {
  // Subscribe to the site data to get the list of collections
  const site = useAppStore((state) => state.getSiteById(siteId));
  const addNewCollection = useAppStore((state) => state.addNewCollection);

  // Memoize the list of collections for performance
  const collections = useMemo(() => {
    return site?.manifest.structure.filter((node: StructureNode) => node.type === 'collection') || [];
  }, [site?.manifest.structure]);
  
  const existingSlugs = useMemo(() => {
    return site?.manifest.structure.map((node: StructureNode) => node.slug) || [];
  }, [site?.manifest.structure]);

  // Handler for creating a new collection is now self-contained here.
  const handleCreateNewCollection = async (name: string, slug: string) => {
    // --- START OF FIX ---
    // Call the action with the correct number of arguments.
    // The layout argument is no longer needed.
    await addNewCollection(siteId, name, slug);
    // --- END OF FIX ---
  };

  if (!site) {
    return null; // Don't render if site data isn't loaded
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex px-1 py-1 shrink-0 items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2">Collections</h4>
        <NewCollectionDialog
          existingSlugs={existingSlugs}
          // The dialog itself needs to be updated to no longer ask for a layout
          onSubmit={handleCreateNewCollection}
        >
            <Button variant="ghost" className='size-6 p-2 rounded-sm' title="New Collection">
                <FolderPlus className="h-4 w-4" />
            </Button>
        </NewCollectionDialog>
      </div>

      <div className="flex-grow overflow-y-auto px-2 py-2">
        {collections.length > 0 ? (
          <div className="space-y-1">
            {collections.map((collection) => (
              <Link
                key={collection.path}
                // This link will eventually go to a settings page for the collection,
                // not a view page, as per our new architecture.
                href={`/sites/${siteId}/edit/collection/${collection.slug}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={collection.title}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="truncate">{collection.title}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-2 text-xs text-muted-foreground italic">No collections created yet.</p>
        )}
      </div>
    </div>
  );
}