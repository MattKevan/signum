// src/features/editor/components/FrontmatterSidebar.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { LocalSiteData, MarkdownFrontmatter } from '@/core/types';
import { getAvailableLayouts, getLayoutManifest, LayoutManifest } from '@/core/services/configHelpers.service';
import { RJSFSchema } from '@rjsf/utils'; 
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Button } from '@/core/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";
import ViewEditor from '@/features/editor/components/CollectionSettings'; 
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm'; 

/**
 * Props for the FrontmatterSidebar component.
 */
interface FrontmatterSidebarProps {
  siteId: string;
  filePath: string; // The full path to the content file being edited
  site: Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles' | 'contentFiles'>;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
}

/**
 * Renders the right-hand sidebar in the editor, containing all metadata
 * and settings for the current page (frontmatter).
 */
export default function FrontmatterSidebar({
  siteId, site, frontmatter, onFrontmatterChange,
  isNewFileMode, slug, onSlugChange, onDelete,
}: FrontmatterSidebarProps) {

  const [availableLayouts, setAvailableLayouts] = useState<LayoutManifest[]>([]);
  const [layoutSchema, setLayoutSchema] = useState<RJSFSchema | null>(null);

  const isCollectionPage = useMemo(() => !!frontmatter.collection, [frontmatter]);

  // Effect to fetch the available layouts (e.g., page, list) for the dropdowns.
  useEffect(() => {
    async function fetchAndFilterLayouts() {
      if (!site) return;
      const requiredLayoutType = isCollectionPage ? 'list' : 'page';
      const filteredLayouts = await getAvailableLayouts(site, requiredLayoutType);
      setAvailableLayouts(filteredLayouts);
    }
    fetchAndFilterLayouts();
  }, [site, isCollectionPage]);

  // Effect to load the JSON schema for the currently selected layout.
  useEffect(() => {
    const loadSchema = async () => {
      if (!frontmatter.layout) {
        setLayoutSchema(null);
        return;
      }
      const manifest = await getLayoutManifest(site, frontmatter.layout);
      setLayoutSchema(manifest?.schema || null);
    };
    loadSchema();
  }, [site, frontmatter.layout]);

  const menuTitleValue = typeof frontmatter.menuTitle === 'string' ? frontmatter.menuTitle : '';
  const handleLayoutChange = (layoutId: string) => {
    onFrontmatterChange({ layout: layoutId });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      
      {/* Settings are organized into accordions for clarity */}
      <Accordion type="multiple" defaultValue={['page', 'collection']} className="w-full flex-grow overflow-y-auto">
        {isCollectionPage && (
          <AccordionItem value="collection">
            <AccordionTrigger>Collection settings</AccordionTrigger>
            <AccordionContent className="pt-2">
              <ViewEditor siteId={siteId} frontmatter={frontmatter} onFrontmatterChange={onFrontmatterChange} />
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="page">
          <AccordionTrigger>Page meta</AccordionTrigger>
          <AccordionContent className="space-y-6 ">

            {layoutSchema && (
                <div className="">
                    <SchemaDrivenForm schema={layoutSchema} formData={frontmatter} onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)} />
                </div>
            )}
          </AccordionContent>
        </AccordionItem>

        
        <AccordionItem value='menu'>
        <AccordionTrigger>Menu settings</AccordionTrigger>
          <AccordionContent>
 <div className="space-y-2">
              <Label htmlFor="menu-title-input">Menu title (Optional)</Label>
              <Input
                id="menu-title-input"
                placeholder="e.g., Home, About Us"
                value={menuTitleValue}
                onChange={(e) => onFrontmatterChange({ menuTitle: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">A short label for navigation menus. If left blank, the page title will be used.</p>
            </div>
          </AccordionContent>

        </AccordionItem>

        <AccordionItem value='layout'>
          <AccordionTrigger>Layout settings</AccordionTrigger>
          <AccordionContent>
<div className="space-y-2">
              <Label htmlFor="page-layout-select">Layout</Label>
              <Select value={frontmatter.layout} onValueChange={handleLayoutChange}>
                  <SelectTrigger id="page-layout-select" className='w-full'><SelectValue placeholder="Select a layout..." /></SelectTrigger>
                  <SelectContent>{availableLayouts.map(layout => <SelectItem key={layout.id} value={layout.id}>{layout.name}</SelectItem>)}</SelectContent>
              </Select>
               <p className="text-xs text-muted-foreground">Controls the appearance of this page.</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced</AccordionTrigger>
          <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slug-input">URL Slug</Label>
                <Input
                    id="slug-input"
                    value={slug}
                    onChange={(e) => onSlugChange(e.target.value)}
                    disabled={!isNewFileMode}
                    className={!isNewFileMode ? 'bg-muted/50 cursor-not-allowed' : ''}
                />
                <p className="text-xs text-muted-foreground">The unique filename for this page. Can only be set on creation.</p>
              </div>
              {!isNewFileMode && (
        <div className="">
          <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete page
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will permanently delete the file for &quot;{frontmatter?.title || 'this content'}&quot; and cannot be undone.
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* The Delete button is only available for existing pages */}
      
    </div>
  );
}