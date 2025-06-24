// src/features/editor/components/CollectionSettings.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarkdownFrontmatter, CollectionConfig, LocalSiteData } from '@/core/types';
import { getLayoutManifest, LayoutManifest } from '@/core/services/configHelpers.service';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';

/**
 * Defines the props for the CollectionSettings component.
 */
interface CollectionSettingsProps {
  site: Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

/**
 * A component that dynamically renders the settings UI for a "Collection Page".
 */
export default function CollectionSettings({ site, frontmatter, onFrontmatterChange }: CollectionSettingsProps) {
  const [layoutManifest, setLayoutManifest] = useState<LayoutManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLayoutData() {
      if (!frontmatter.layout) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const manifest = await getLayoutManifest(site, frontmatter.layout);
      setLayoutManifest(manifest);
      setIsLoading(false);
    }
    fetchLayoutData();
  }, [site, frontmatter.layout]);

  /**
   * --- FIX: Update the signature to accept `undefined`. ---
   * This allows us to clear a field from the frontmatter.
   */
  const handleCollectionConfigChange = useCallback((key: keyof CollectionConfig, value: string | number | undefined) => {
    const currentConfig = frontmatter.collection || {};
    let updatedCollectionConfig: CollectionConfig;

    if (value === undefined) {
      // If the new value is undefined, we remove the key from the object.
      // This keeps the final YAML frontmatter clean.
      const { [key as any]: _, ...rest } = currentConfig;
      updatedCollectionConfig = rest;
    } else {
      // Otherwise, we update or add the key with the new value.
      updatedCollectionConfig = { ...currentConfig, [key]: value };
    }
    
    onFrontmatterChange({
      collection: updatedCollectionConfig
    });
  }, [frontmatter.collection, onFrontmatterChange]);

  const collectionConfig = frontmatter.collection;

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading collection settings...</div>;
  }

  if (!collectionConfig) {
      return (
           <div className="p-4 text-center text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded-lg">
              <h3 className="font-semibold">Not a Collection Page</h3>
              <p>To enable these settings, add a `collection` block to this page's frontmatter.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      {/* --- DYNAMIC VARIANT SELECTORS --- */}
      {layoutManifest?.display_options && (
        <div className="space-y-4">
          <h4 className='font-semibold text-card-foreground'>Display Options</h4>
          {Object.entries(layoutManifest.display_options).map(([key, displayOption]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`variant-${key}`}>{displayOption.name}</Label>
              <Select
                value={collectionConfig[key] as string || displayOption.default}
                onValueChange={(value) => handleCollectionConfigChange(key, value)}
              >
                <SelectTrigger id={`variant-${key}`} className="w-full">
                  <SelectValue placeholder="Select a style..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(displayOption.options).map(([optionKey, choice]) => (
                    <SelectItem key={optionKey} value={optionKey}>{choice.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {displayOption.description && (
                <p className="text-xs text-muted-foreground">{displayOption.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- SORTING & PAGINATION --- */}
      <div className="space-y-4 pt-4 border-t">
        <h4 className='font-semibold text-card-foreground'>Sorting & Pagination</h4>
        <div className="space-y-2">
            <Label htmlFor="sort-by">Sort items by</Label>
            <Select value={collectionConfig.sort_by || 'date'} onValueChange={(v) => handleCollectionConfigChange('sort_by', v)}>
              <SelectTrigger id="sort-by" className='w-full'><SelectValue /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="date">Publication Date</SelectItem>
                  <SelectItem value="title">Title (Alphabetical)</SelectItem>
              </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="sort-order">Sort order</Label>
              <Select value={collectionConfig.sort_order || 'desc'} onValueChange={(v) => handleCollectionConfigChange('sort_order', v)}>
              <SelectTrigger id="sort-order"  className='w-full'><SelectValue /></SelectTrigger>
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
                  placeholder="e.g., 10"
                  // Use `|| ''` to ensure the input field is clear when the value is undefined.
                  value={collectionConfig.items_per_page || ''}
                  // --- FIX: The expression now correctly returns number | undefined ---
                  onChange={(e) => handleCollectionConfigChange('items_per_page', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="w-full block"
              />
              <p className="text-xs text-muted-foreground">Leave blank to show all items on one page.</p>
          </div>
        </div>
    </div>
  );
}