// src/features/editor/components/FrontmatterSidebar.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StructureNode, ParsedMarkdownFile, MarkdownFrontmatter } from '@/core/types';
import { getAvailableLayouts, LayoutManifest } from '@/core/services/config/configHelpers.service';
import { findNodeByPath } from '@/core/services/fileTree.service';

// UI Component Imports
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";
import { Button } from '@/core/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';

// Form & Sub-component Imports
import ContentTypeSelector from '@/features/editor/components/forms/ContentTypeSelector';
import CollectionSettingsForm from '@/features/editor/components/forms/CollectionSettingsForm';
import PageMetadataForm from '@/features/editor/components/forms/PageMetaDataForm';
import AdvancedSettingsForm from '@/features/editor/components/forms/AdvancedSettingsForm';

interface FrontmatterSidebarProps {
  siteId: string;
  filePath: string;
  siteStructure: StructureNode[];
  allContentFiles: ParsedMarkdownFile[];
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
}

/**
 * REFACTORED: The orchestrator for the editor's right sidebar.
 * This version uses a declarative approach. UI state is derived directly
 * from the `frontmatter` props, ensuring the sidebar reacts instantly
 * to changes in the selected Content Type.
 */
export default function FrontmatterSidebar({
  siteId, filePath, siteStructure, allContentFiles,
  frontmatter, onFrontmatterChange, isNewFileMode, slug, onSlugChange, onDelete,
}: FrontmatterSidebarProps) {

  // 1. STATE MANAGEMENT: Simplified to just the master list of all possible layouts.
  const [allLayouts, setAllLayouts] = useState<LayoutManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAllLayouts() {
      setIsLoading(true);
      // getAvailableLayouts needs a minimal site-like object, which we can construct.
      const minimalSiteData = { manifest: { structure: siteStructure }, contentFiles: allContentFiles };
      const layouts = await getAvailableLayouts(minimalSiteData);
      setAllLayouts(layouts);
      setIsLoading(false);
    }
    fetchAllLayouts();
  }, [siteStructure, allContentFiles]);

  const { isCollectionPage, isCollectionItem, parentFile } = useMemo(() => {
    const isCollection = !!frontmatter.collection;
    if (isCollection) return { isCollectionPage: true, isCollectionItem: false, parentFile: null };
    
    const node = findNodeByPath(siteStructure, filePath);
    if (node?.parentId) {
      const pFile = allContentFiles.find(f => f.path === node.parentId);
      if (pFile?.frontmatter.collection) return { isCollectionPage: false, isCollectionItem: true, parentFile: pFile };
    }
    return { isCollectionPage: false, isCollectionItem: false, parentFile: null };
  }, [frontmatter.collection, siteStructure, allContentFiles, filePath]);

  // 3. KEY CHANGE: Derive the current layout manifest and filtered lists declaratively.
   const currentLayoutManifest = useMemo(() => {
    if (!frontmatter.layout) return null;
    return allLayouts.find(l => l.id === frontmatter.layout) ?? null;
  }, [allLayouts, frontmatter.layout]);

  const parentLayoutManifest = useMemo(() => {
    if (!isCollectionItem || !parentFile?.frontmatter.layout) return null;
    return allLayouts.find(l => l.id === parentFile.frontmatter.layout) ?? null;
  }, [allLayouts, isCollectionItem, parentFile]);

  // Filter the list for the Content Type dropdown based on the page's role.
  const availableContentTypes = useMemo(() => {
    const requiredType = isCollectionPage ? 'collection' : 'page';
    return allLayouts.filter(layout => layout.layoutType === requiredType);
  }, [allLayouts, isCollectionPage]);

  // Callback for when the user selects a new Content Type.
  const handleContentTypeChange = useCallback((newLayoutId: string) => {
    onFrontmatterChange({ layout: newLayoutId });
  }, [onFrontmatterChange]);

  // 4. RENDER LOGIC: Structure the JSX according to the new design.
  if (isLoading || !frontmatter) {
    return <div className="p-4 text-sm text-muted-foreground">Loading settings...</div>;
  }

  // Define default open sections for the accordion.
  const defaultOpenSections = ['content-type', 'metadata', 'advanced'];
  if (isCollectionPage) {
    defaultOpenSections.push('list-settings');
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-grow overflow-y-auto p-3">
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">
          
          {/* Section: Content Type Selector */}
          {/* Only shown for pages that can change their type (not collection items) */}
          {!isCollectionItem && (
            <AccordionItem value="content-type">
              <AccordionTrigger>Content Type</AccordionTrigger>
              <AccordionContent className="pt-4">
                <ContentTypeSelector
                  availableTypes={availableContentTypes}
                  selectedType={frontmatter.layout}
                  onChange={handleContentTypeChange}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Section: Collection-Specific Settings */}
          {isCollectionPage && (
            <AccordionItem value="list-settings">
              <AccordionTrigger>List Settings</AccordionTrigger>
              <AccordionContent className="pt-4">
                <CollectionSettingsForm
                  frontmatter={frontmatter}
                  onFrontmatterChange={onFrontmatterChange}
                  layoutManifest={currentLayoutManifest}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Section: Metadata (fields from layout + core) */}
          <AccordionItem value="metadata">
            <AccordionTrigger>Metadata</AccordionTrigger>
            <AccordionContent className="pt-4">
              <PageMetadataForm
                siteId={siteId}
                frontmatter={frontmatter}
                onFrontmatterChange={onFrontmatterChange}
                // For an item, its metadata fields come from the PARENT's layout manifest
                layoutManifest={isCollectionItem ? parentLayoutManifest : currentLayoutManifest}
                isCollectionItem={isCollectionItem}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Section: Advanced Settings */}
          <AccordionItem value="advanced">
            <AccordionTrigger>Advanced</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <AdvancedSettingsForm
                slug={slug}
                onSlugChange={onSlugChange}
                isNewFileMode={isNewFileMode}
              />
              {!isNewFileMode && (
                <div className="pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete page
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete this page and cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Delete Page</AlertDialogAction>
                        </AlertDialogFooter>
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