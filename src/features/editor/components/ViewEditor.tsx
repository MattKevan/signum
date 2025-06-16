// src/features/editor/components/ViewEditor.tsx
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MarkdownFrontmatter, ViewConfig } from '@/types';
import { getJsonAsset, ViewManifest } from '@/core/services/configHelpers.service';
import { useAppStore } from '@/core/state/useAppStore';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { RJSFSchema } from '@rjsf/utils';

interface ViewEditorProps {
  siteId: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

export default function ViewEditor({ siteId, frontmatter, onFrontmatterChange }: ViewEditorProps) {
  const site = useAppStore(state => state.getSiteById(siteId));
  const [viewSchema, setViewSchema] = useState<RJSFSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const viewTemplateId = frontmatter.view?.template;

  // This effect fetches the correct schema whenever the chosen view template changes.
  useEffect(() => {
    const fetchViewSchema = async () => {
      if (!viewTemplateId || !site) {
        setViewSchema(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const viewManifest = await getJsonAsset<ViewManifest>(
        site, 
        'view', 
        viewTemplateId, 
        'view.json'
      );
      
      setViewSchema(viewManifest?.schema || null);
      setIsLoading(false);
    };

    fetchViewSchema();
  }, [viewTemplateId, site]);

  // This callback is passed to the SchemaDrivenForm.
  // It takes the form's new data and merges it into the frontmatter.view object.
  const handleFormChange = useCallback((formData: any) => {
    onFrontmatterChange({
      view: {
        ...(frontmatter.view || { template: '' }), // Preserve existing config
        ...formData
      }
    });
  }, [frontmatter.view, onFrontmatterChange]);
  
  if (!viewTemplateId) {
    return (
        <div className="p-6 text-center border-2 border-dashed rounded-lg">
            <h3 className="font-semibold">Select a View Template</h3>
            <p className="text-sm text-muted-foreground">Please choose a view template from the sidebar to begin configuring your content list.</p>
        </div>
    );
  }

  if (isLoading) {
    return <div className="p-6">Loading view options...</div>;
  }

  if (!viewSchema) {
    return (
        <div className="p-6 text-center text-destructive-foreground bg-destructive/20 border border-destructive rounded-lg">
            <h3 className="font-semibold">Error</h3>
            <p className="text-sm">Could not load the configuration schema for the "{viewTemplateId}" view.</p>
        </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-muted/20">
      <SchemaDrivenForm
        schema={viewSchema}
        formData={frontmatter.view || {}}
        onFormChange={handleFormChange}
      />
    </div>
  );
}