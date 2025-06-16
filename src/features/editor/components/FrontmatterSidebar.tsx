// src/features/editor/core/FrontmatterSidebar.tsx
'use client';

// --- FIX: Add missing React imports ---
import React, { useState, useEffect, useMemo, useCallback } from 'react';
// --- FIX: Add missing type import ---
import type { LocalSiteData, MarkdownFrontmatter, ViewConfig } from '@/types';
import { getAvailableViews, getAvailableLayouts, getLayoutManifest, LayoutManifest } from '@/core/services/configHelpers.service';
import { RJSFSchema } from '@rjsf/utils';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Button } from '@/core/components/ui/button';
import { Switch } from "@/core/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';


interface FrontmatterSidebarProps {
  site: Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles' | 'contentFiles'>;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
  onViewModeToggle: (isView: boolean) => void;
}

export default function FrontmatterSidebar({
  site, frontmatter, onFrontmatterChange,
  isNewFileMode, slug, onSlugChange, onDelete, onViewModeToggle
}: FrontmatterSidebarProps) {
  
  const [layoutSchema, setLayoutSchema] = useState<RJSFSchema | null>(null);

  // Handle async loading of available layouts
  const [availableLayouts, setAvailableLayouts] = useState<LayoutManifest[]>([]);

  // Memoize the available views (this function is still synchronous)
  const availableViews = useMemo(() => getAvailableViews(site.manifest), [site.manifest]);
  
  // Use an effect to fetch the full layout manifests when the component mounts.
  useEffect(() => {
    async function fetchLayouts() {
      const allLayouts = await getAvailableLayouts(site);
      // Filter the full manifests by the required type.
      const contentPageLayouts = allLayouts.filter(layout => layout.layoutType === 'content-page');
      setAvailableLayouts(contentPageLayouts);
    }
    fetchLayouts();
  }, [site]);

  useEffect(() => {
    const loadSchema = async () => {
      if (!frontmatter.layout) return;
      const manifest = await getLayoutManifest(site, frontmatter.layout);
      setLayoutSchema(manifest?.schema || null);
    };
    loadSchema();
  }, [site, frontmatter.layout]);
  
  const isViewMode = !!frontmatter.view;

  const handleViewModeToggle = (isView: boolean) => {
    if (isView) {
      onFrontmatterChange({
        view: {
          template: availableViews[0]?.id || 'list',
          item_layout: '',
          sort_by: 'date',
          sort_order: 'desc',
        }
      });
    } else {
      const { view, ...rest } = frontmatter;
      onFrontmatterChange(rest);
    }
  };

  const handleViewConfigChange = (key: keyof ViewConfig, value: string | number) => {
    onFrontmatterChange({
        view: {
          ...(frontmatter.view || { template: '', item_layout: '' }),
          [key]: value
        }
    });
  };
  
  
  const handleLayoutChange = (layoutId: string) => {
    onFrontmatterChange({ layout: layoutId });
  };
  
   return (
    <div className="p-4 space-y-6">
      {/* --- Page Display Mode Control --- */}
      <div className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
              <Label htmlFor="view-mode-toggle" className="font-semibold">
                  Content Listing Page
              </Label>
              <Switch
                  id="view-mode-toggle"
                  checked={isViewMode}
                  onCheckedChange={onViewModeToggle}
              />
          </div>
          <p className="text-xs text-muted-foreground">
            {isViewMode 
              ? "This page will display a list of items from a collection." 
              : "This page will display its own Markdown content."
            }
          </p>
          {isViewMode && (
              <div className="pt-4 border-t">
                  <Label htmlFor="view-template-select">List Style (View)</Label>
                  <Select 
                    value={frontmatter.view?.template || ''} 
                    onValueChange={(val) => handleViewConfigChange('template', val)}
                  >
                      <SelectTrigger id="view-template-select">
                          <SelectValue placeholder="Select a display style..." />
                      </SelectTrigger>
                      <SelectContent>
                          {availableViews.map(view => (
                              <SelectItem key={view.id} value={view.id}>
                                  {view.name}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
          )}
      </div>

      {/* --- Page Layout & Settings --- */}
      <Accordion type='single' collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Page Settings</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div>
                <Label htmlFor="page-layout-select">Page Layout</Label>
                <Select value={frontmatter.layout} onValueChange={handleLayoutChange}>
                    <SelectTrigger id="page-layout-select">
                        <SelectValue placeholder="Select a layout..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableLayouts.map(layout => (
                           <SelectItem key={layout.name} value={layout.name}>{layout.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">
                  Controls the layout for this page's own title and markdown content.
                </p>
            </div>
            {layoutSchema && (
                <div className="border-t pt-4">
                    <SchemaDrivenForm
                        schema={layoutSchema}
                        formData={frontmatter}
                        onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
                    />
                </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* --- Advanced/Danger Zone --- */}
      <Accordion type='single' collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Advanced</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="slug-input">URL Slug</Label>
                <Input 
                    id="slug-input"
                    value={slug}
                    onChange={(e) => onSlugChange(e.target.value)}
                    disabled={!isNewFileMode}
                    className={!isNewFileMode ? 'bg-muted/50' : ''}
                />
              </div>
              {!isNewFileMode && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full mt-6 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete This Page
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent> 
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            {/* --- FIX: Correctly close the JSX tag --- */}
                            <AlertDialogDescription>
                              This action will permanently delete the file for "{frontmatter?.title || 'this content'}". This cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                                Yes, Delete Forever
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}