// src/features/editor/components/FrontmatterSidebar.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { LocalSiteData, MarkdownFrontmatter } from '@/types';
import { getAvailableLayouts, getLayoutManifest, LayoutManifest } from '@/core/services/configHelpers.service';
import { RJSFSchema } from '@rjsf/utils';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Button } from '@/core/components/ui/button';
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
  // The onViewModeToggle prop is no longer needed
}

export default function FrontmatterSidebar({
  site, frontmatter, onFrontmatterChange,
  isNewFileMode, slug, onSlugChange, onDelete,
}: FrontmatterSidebarProps) {
  
  const [layoutSchema, setLayoutSchema] = useState<RJSFSchema | null>(null);
  const [availableLayouts, setAvailableLayouts] = useState<LayoutManifest[]>([]);

  // Determine if the current page is a View Page based on its frontmatter.
  // This is now the single source of truth for the page's type.
  const isViewPage = useMemo(() => !!frontmatter.view, [frontmatter]);

  // This effect fetches and filters available layouts based on the page's type.
  useEffect(() => {
    async function fetchAndFilterLayouts() {
      if (!site) return;
      
      const allLayouts = await getAvailableLayouts(site);
      
      // --- FIX: Determine the required layoutType based on whether it's a view page. ---
      const requiredLayoutType = isViewPage ? 'view' : 'page';
      
      // --- FIX: Filter using the updated layoutType enum. ---
      const filtered = allLayouts.filter(layout => layout.layoutType === requiredLayoutType);
      setAvailableLayouts(filtered);
    }
    fetchAndFilterLayouts();
  }, [site, isViewPage]); // The dependencies are correct.
  // This effect loads the schema for the selected layout.
  useEffect(() => {
    const loadSchema = async () => {
      if (!frontmatter.layout) return;
      const manifest = await getLayoutManifest(site, frontmatter.layout);
      setLayoutSchema(manifest?.schema || null);
    };
    loadSchema();
  }, [site, frontmatter.layout]);

  const handleLayoutChange = (layoutId: string) => {
    onFrontmatterChange({ layout: layoutId });
  };
  
  return (
    <div className="p-4 space-y-6 h-full flex flex-col">
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
                  Controls the layout for this page&apos;s own title and content.
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

      {/* --- Advanced/Danger Zone (in its own accordion) --- */}
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* --- Delete Button (at the bottom) --- */}
      {!isNewFileMode && (
        <div className="mt-auto pt-6 border-t">
          <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete This Page
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent> 
                  <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will permanently delete the file for &quot;{frontmatter?.title || 'this content'}&quot;. This cannot be undone.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                          Yes, Delete Forever
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}