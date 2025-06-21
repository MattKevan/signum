// src/features/editor/components/CollectionSettings.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarkdownFrontmatter, CollectionConfig } from '@/types';
import { getAvailableLayouts, LayoutManifest } from '@/core/services/configHelpers.service';
import { useAppStore } from '@/core/state/useAppStore';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";

interface ViewEditorProps {
  siteId: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

export default function ViewEditor({ siteId, frontmatter, onFrontmatterChange }: ViewEditorProps) {
  const site = useAppStore(state => state.getSiteById(siteId));

  // State for the dropdown options
  const [itemLayouts, setItemLayouts] = useState<LayoutManifest[]>([]);
  const [pageLayouts, setPageLayouts] = useState<LayoutManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch available layouts when the component mounts
  useEffect(() => {
    async function fetchData() {
      if (!site) return;
      setIsLoading(true);
      const allLayouts = await getAvailableLayouts(site);
      // Filter layouts by their new, specific types
      setItemLayouts(allLayouts.filter(l => l.layoutType === 'item'));
      setPageLayouts(allLayouts.filter(l => l.layoutType === 'page'));
      setIsLoading(false);
    }
    fetchData();
  }, [site]);

  // A generic handler to update a specific property within the 'collection' object
  const handleCollectionConfigChange = useCallback((key: keyof CollectionConfig, value: string | number) => {
    // We update the entire 'collection' object in the parent's frontmatter state
    const updatedCollectionConfig = { ...(frontmatter.collection!), [key]: value };
    onFrontmatterChange({
      collection: updatedCollectionConfig
    });
  }, [frontmatter.collection, onFrontmatterChange]);

  const collectionConfig = frontmatter.collection;

  if (isLoading) return <div className="p-6">Loading collection settings...</div>;

  // This component should not render if the page isn't a collection page.
  if (!collectionConfig) {
      return (
           <div className="p-6 text-center text-destructive-foreground bg-destructive/20 border border-destructive rounded-lg">
              <h3 className="font-semibold">Not a Collection Page</h3>
              <p className="text-sm">To enable collection settings, add a `collection` block to this page&apos;s frontmatter.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
             <h4 className='font-bold'>Collection layouts</h4>

      <p className="text-sm text-muted-foreground -mt-4">
        Configure how the list of child pages is displayed on this page.
      </p>

      {/* --- Layout Selection --- */}
      <div className="gap-4">
       
        <div className="space-y-2">
  <Label htmlFor="item-layout">Item layout (in list)</Label>
  <div className="w-full">
    <Select value={collectionConfig.item_layout} onValueChange={(v) => handleCollectionConfigChange('item_layout', v)}>
      <SelectTrigger id="item-layout" className="!w-full">
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {itemLayouts.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
  <p className="text-xs text-muted-foreground">Appearance of each item teaser.</p>
</div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="item-page-layout">Full page layout (for items)</Label>
        <Select value={collectionConfig.item_page_layout} onValueChange={(v) => handleCollectionConfigChange('item_page_layout', v)}>
            <SelectTrigger id="item-page-layout" className='!w-full'><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{pageLayouts.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
        </Select>
         <p className="text-xs text-muted-foreground">The default layout when a user clicks to view a single item from this collection.</p>
      </div>

      {/* --- Sorting & Pagination --- */}
       <h4 className='font-bold'>Sorting & pagination</h4>
              <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="sort-by">Sort items by</Label>
                      <Select value={collectionConfig.sort_by} onValueChange={(v) => handleCollectionConfigChange('sort_by', v)}>
                        <SelectTrigger id="sort-by" className='!w-full'><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="title">Title</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="sort-order">Sort order</Label>
                       <Select value={collectionConfig.sort_order} onValueChange={(v) => handleCollectionConfigChange('sort_order', v)}>
                        <SelectTrigger id="sort-order"  className='!w-full'><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="desc">Descending</SelectItem>
                            <SelectItem value="asc">Ascending</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                   <div className="space-y-2">
                        <Label htmlFor="items-per-page">Items Per Page</Label>
                        <Input
                            id="items-per-page"
                            type="number"
                            value={collectionConfig.items_per_page || 10}
                            onChange={(e) => handleCollectionConfigChange('items_per_page', parseInt(e.target.value, 10) || 10)}
                            className="w-full block"
                        />
                    </div>
                    </div>
           
    </div>
  );
}