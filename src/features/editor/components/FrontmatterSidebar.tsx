// src/features/editor/components/FrontmatterSidebar.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LocalSiteData, MarkdownFrontmatter } from '@/core/types';
import { getAvailableLayouts, getLayoutManifest, LayoutManifest } from '@/core/services/configHelpers.service';
import { findNodeByPath } from '@/core/services/fileTree.service';

// UI Component Imports
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Button } from '@/core/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';

// Specialized Form Component Imports
import CoreSchemaForm from './forms/CoreSchemaForm';
import PageLayoutSchemaForm from './forms/PageLayoutSchemaForm';
import CollectionLayoutSchemaForm from './forms/CollectionLayoutSchemaForm';
import ItemLayoutSchemaForm from './forms/ItemLayoutSchemaForm';
import CollectionSettingsForm from './forms/CollectionSettingsForm';

interface FrontmatterSidebarProps {
  siteId: string;
  filePath: string;
  site: Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles' | 'contentFiles'>;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
}

/**
 * The orchestrator for the editor's right sidebar.
 * It determines the role of the current page and composes the UI
 * from a set of specialized, single-purpose form components.
 */
export default function FrontmatterSidebar({
  siteId, site, filePath, frontmatter, onFrontmatterChange,
  isNewFileMode, slug, onSlugChange, onDelete,
}: FrontmatterSidebarProps) {

  const [availableLayouts, setAvailableLayouts] = useState<LayoutManifest[]>([]);
  const [currentLayoutManifest, setCurrentLayoutManifest] = useState<LayoutManifest | null>(null);
  const [isLoadingLayouts, setIsLoadingLayouts] = useState(true);

  // Determine the page's type and context (Page, Collection, or Item)
  const { isCollectionPage, isCollectionItem, parentFile } = useMemo(() => {
    console.groupCollapsed('[DIAGNOSTIC] Role Detection');
    const isCollection = !!frontmatter.collection;
    console.log(`[LOG 1] frontmatter.collection exists: ${isCollection}`);

    if (isCollection) {
      console.log('[LOG 1] Result: isCollectionPage = true');
      console.groupEnd();
      return { isCollectionPage: true, isCollectionItem: false, parentFile: null };
    }
    
    const node = findNodeByPath(site.manifest.structure, filePath);
    console.log(`[LOG 1] Found node for path "${filePath}":`, node);

    if (node && typeof node.parentId === 'string') {
      const parentNode = findNodeByPath(site.manifest.structure, node.parentId);
      console.log(`[LOG 1] Found parent node for parentId "${node.parentId}":`, parentNode);
      const pFile = site.contentFiles?.find(f => f.path === parentNode?.path);
      console.log(`[LOG 1] Found parent file content:`, pFile);

      if (pFile?.frontmatter.collection) {
        console.log('[LOG 1] Result: isCollectionItem = true');
        console.groupEnd();
        return { isCollectionPage: false, isCollectionItem: true, parentFile: pFile };
      }
    }

    console.log('[LOG 1] Result: is a standard page.');
    console.groupEnd();
    return { isCollectionPage: false, isCollectionItem: false, parentFile: null };
  }, [frontmatter.collection, site.manifest.structure, site.contentFiles, filePath]);


  useEffect(() => {
    async function fetchAllLayouts() {
      setIsLoadingLayouts(true);
      if (!site) return;
      const allLayouts = await getAvailableLayouts(site);
      setAvailableLayouts(allLayouts);
      setIsLoadingLayouts(false); // Set loading to false after fetch is complete
    }
    fetchAllLayouts();
  }, [site]);

  useEffect(() => {
    const loadGoverningLayout = async () => {
      const layoutIdToLoad = isCollectionItem
        ? parentFile?.frontmatter.layout
        : frontmatter.layout;
      
      if (!layoutIdToLoad) {
        setCurrentLayoutManifest(null);
        return;
      }
      const manifest = await getLayoutManifest(site, layoutIdToLoad);
      setCurrentLayoutManifest(manifest);
    };
    loadGoverningLayout();
  }, [site, frontmatter.layout, isCollectionItem, parentFile]);
  
  const handleLayoutChange = (layoutId: string) => {
    onFrontmatterChange({ layout: layoutId });
  };
  
  const menuTitleValue = typeof frontmatter.menuTitle === 'string' ? frontmatter.menuTitle : '';

  const defaultOpenSections = ['layout-selector', 'core-options', 'layout-options'];
  if (isCollectionPage) {
    defaultOpenSections.push('collection-settings');
  }

  // --- DIAGNOSTIC LOG INSIDE RENDER ---
  const requiredType = isCollectionPage ? 'collection' : 'page';
  console.groupCollapsed('[DIAGNOSTIC] Filtering for Dropdown');
  console.log(`[LOG 5] Render cycle. Required layout type: "${requiredType}"`);
  console.log(`[LOG 5] 'availableLayouts' state before filtering:`, JSON.parse(JSON.stringify(availableLayouts)));
  
  const layoutsForDropdown = availableLayouts.filter(layout => layout && layout.id && layout.layoutType === requiredType);
  console.log('[LOG 6] Final layouts after filtering:', JSON.parse(JSON.stringify(layoutsForDropdown)));
  console.groupEnd();

  return (
    <div className="h-full flex flex-col">
      <div className="flex-grow overflow-y-auto p-3">
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">

          {!isCollectionItem && (
            <AccordionItem value="layout-selector">
              <AccordionTrigger>Layout</AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="space-y-2">
                  <Label htmlFor="page-layout-select">Page Layout</Label>
                  {isLoadingLayouts ? (
                    <Input disabled placeholder="Loading layouts..." />
                  ) : (
                    <Select
                      // Ensure value is never undefined, which can confuse some libraries
                      value={frontmatter.layout || ''}
                      onValueChange={handleLayoutChange}
                    >
                      <SelectTrigger id="page-layout-select" className='w-full'>
                        <SelectValue placeholder="Select a layout..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLayouts
                          .filter(layout => {
                            const requiredType = isCollectionPage ? 'collection' : 'page';
                            return layout?.layoutType?.trim() === requiredType;
                          })
                          .map(layout => (
                            <SelectItem key={layout.id} value={layout.id}>
                              {layout.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="core-options">
            <AccordionTrigger>Core Options</AccordionTrigger>
            <AccordionContent className="pt-4">
              <CoreSchemaForm
                siteId={siteId}
                frontmatter={frontmatter}
                onFrontmatterChange={onFrontmatterChange}
                isCollectionItem={isCollectionItem}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="layout-options">
            <AccordionTrigger>Layout Options</AccordionTrigger>
            <AccordionContent className="pt-4">
              {isCollectionPage && (
                <CollectionLayoutSchemaForm
                  siteId={siteId}
                  layoutManifest={currentLayoutManifest}
                  frontmatter={frontmatter}
                  onFrontmatterChange={onFrontmatterChange}
                />
              )}
              {!isCollectionPage && !isCollectionItem && (
                <PageLayoutSchemaForm
                  siteId={siteId}
                  layoutManifest={currentLayoutManifest}
                  frontmatter={frontmatter}
                  onFrontmatterChange={onFrontmatterChange}
                />
              )}
              {isCollectionItem && (
                <ItemLayoutSchemaForm
                  siteId={siteId}
                  layoutManifest={currentLayoutManifest}
                  frontmatter={frontmatter}
                  onFrontmatterChange={onFrontmatterChange}
                />
              )}
            </AccordionContent>
          </AccordionItem>
          
          {isCollectionPage && (
            <AccordionItem value="collection-settings">
              <AccordionTrigger>Collection Settings</AccordionTrigger>
              <AccordionContent className="pt-4">
                <CollectionSettingsForm
                  site={site}
                  frontmatter={frontmatter}
                  onFrontmatterChange={onFrontmatterChange}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value='menu'>
            <AccordionTrigger>Menu settings</AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="menu-title-input">Menu title (Optional)</Label>
                <Input id="menu-title-input" value={menuTitleValue} onChange={(e) => onFrontmatterChange({ menuTitle: e.target.value })} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced">
            <AccordionTrigger>Advanced</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="space-y-2">
                  <Label htmlFor="slug-input">URL Slug</Label>
                  <Input id="slug-input" value={slug} onChange={(e) => onSlugChange(e.target.value)} disabled={!isNewFileMode} />
              </div>
              {!isNewFileMode && (
                <div className="pt-4 border-t">
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete page</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action is permanent and cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Delete Page</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}