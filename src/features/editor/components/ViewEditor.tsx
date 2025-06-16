// src/features/editor/components/ViewEditor.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarkdownFrontmatter, ViewConfig, StructureNode } from '@/types';
import { getAvailableLayouts, LayoutManifest, getJsonAsset, ViewManifest } from '@/core/services/configHelpers.service';
import { useAppStore } from '@/core/state/useAppStore';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { RJSFSchema } from '@rjsf/utils';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";

interface ViewEditorProps {
  siteId: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

export default function ViewEditor({ siteId, frontmatter, onFrontmatterChange }: ViewEditorProps) {
  const site = useAppStore(state => state.getSiteById(siteId));

  // --- State for UI & Data ---
  const [collections, setCollections] = useState<StructureNode[]>([]);
  const [itemLayouts, setItemLayouts] = useState<LayoutManifest[]>([]);
  const [pageLayouts, setPageLayouts] = useState<LayoutManifest[]>([]);
  const [customViewSchema, setCustomViewSchema] = useState<RJSFSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- Data Fetching Effect ---
  useEffect(() => {
    async function fetchData() {
      if (!site) return;
      setIsLoading(true);

      const viewTemplateId = frontmatter.view?.template;
      
      // Fetch data for the hard-coded dropdowns
      const allCollections = site.manifest.structure.filter(n => n.type === 'collection');
      setCollections(allCollections);

      const allLayouts = await getAvailableLayouts(site);
      setItemLayouts(allLayouts.filter(l => l.layoutType === 'item'));
      setPageLayouts(allLayouts.filter(l => l.layoutType === 'page'));

      // Fetch the schema for the view-specific custom fields
      if (viewTemplateId) {
          const viewManifest = await getJsonAsset<ViewManifest>(site, 'view', viewTemplateId, 'view.json');
          setCustomViewSchema(viewManifest?.schema || null);
      } else {
          setCustomViewSchema(null);
      }
      
      setIsLoading(false);
    }
    fetchData();
  }, [site, frontmatter.view?.template]);

  // --- Event Handlers ---

  /**
   * Generic handler for the dedicated dropdowns.
   */
  const handleDedicatedFieldChange = useCallback((key: keyof ViewConfig, value: string) => {
    onFrontmatterChange({
      view: { ...(frontmatter.view!), [key]: value }
    });
  }, [frontmatter.view, onFrontmatterChange]);

  /**
   * Handler for the SchemaDrivenForm, merging its data with the existing view config.
   */
  const handleCustomFormChange = useCallback((formData: object) => {
    onFrontmatterChange({
      view: { ...(frontmatter.view!), ...formData }
    });
  }, [frontmatter.view, onFrontmatterChange]);

  const viewConfig = frontmatter.view;

  // --- Render Logic ---

  if (isLoading) {
    return <div className="p-6">Loading view options...</div>;
  }
  
  if (!viewConfig) {
      return (
          <div className="p-6 text-center text-destructive-foreground bg-destructive/20 border border-destructive rounded-lg">
              <h3 className="font-semibold">Error</h3>
              <p className="text-sm">This page is not configured as a View Page.</p>
          </div>
      );
  }

  return (
    <div className="p-6 border rounded-lg bg-muted/20 space-y-6">
      
      {/* --- Hard-coded, Universal View Fields --- */}
      <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="source-collection">Content Source</Label>
            <p className="text-xs text-muted-foreground">Choose the collection to display items from.</p>
            <Select 
            value={viewConfig.source_collection} 
            onValueChange={(value) => handleDedicatedFieldChange('source_collection', value)}
            >
            <SelectTrigger id="source-collection">
                <SelectValue placeholder="Select a collection..." />
            </SelectTrigger>
            <SelectContent>
                {collections.map(c => <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>)}
            </SelectContent>
            </Select>
        </div>

        <div className="space-y-2">
            <Label htmlFor="item-layout">Item Display Layout (in lists)</Label>
            <p className="text-xs text-muted-foreground">Controls how each item looks in the list on this page.</p>
            <Select 
                value={viewConfig.item_layout}
                onValueChange={(value) => handleDedicatedFieldChange('item_layout', value)}
            >
                <SelectTrigger id="item-layout"><SelectValue placeholder="Select an item layout..." /></SelectTrigger>
                <SelectContent>
                    {itemLayouts.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        
        <div className="space-y-2">
            <Label htmlFor="item-page-layout">Item Full Page Layout</Label>
            <p className="text-xs text-muted-foreground">Controls the layout when a user clicks through to view a single item.</p>
            <Select 
                value={viewConfig.item_page_layout}
                onValueChange={(value) => handleDedicatedFieldChange('item_page_layout', value)}
            >
                <SelectTrigger id="item-page-layout"><SelectValue placeholder="Select a page layout..." /></SelectTrigger>
                <SelectContent>
                    {pageLayouts.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* --- Schema-Driven Custom Fields --- */}
      {customViewSchema && (
        <Accordion type='single' collapsible className="w-full" defaultValue='custom-options'>
          <AccordionItem value="custom-options">
              <AccordionTrigger>View-Specific Options</AccordionTrigger>
              <AccordionContent className="pt-4">
                <SchemaDrivenForm
                    schema={customViewSchema}
                    formData={viewConfig}
                    onFormChange={handleCustomFormChange}
                />
              </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}