// src/components/publishing/FrontmatterSidebar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import type { MarkdownFrontmatter, LocalSiteData } from '@/types';
import GroupedFrontmatterFields from '@/components/publishing/GroupedFrontmatterFields';
import { getLayoutManifest } from '@/lib/configHelpers';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface FrontmatterSidebarProps {
  site: LocalSiteData;
  layoutPath: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
}

export default function FrontmatterSidebar({
  site,
  layoutPath,
  frontmatter,
  onFrontmatterChange,
  isNewFileMode,
  slug,
  onSlugChange,
}: FrontmatterSidebarProps) {
  
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [uiSchema, setUiSchema] = useState<UiSchema | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSchemaForLayout() {
      if (!layoutPath) return;
      setIsLoading(true);
      try {
        // This helper function now returns a schema that is guaranteed
        // to not contain 'title' or 'description'.
        const manifest = await getLayoutManifest(site, layoutPath);
        setSchema(manifest?.pageSchema || null);
        setUiSchema(manifest?.uiSchema);
      } catch (error) {
        console.error(`Failed to load schema for layout '${layoutPath}':`, error);
        setSchema(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadSchemaForLayout();
  }, [site, layoutPath]);
  
  if (isLoading) {
    return (
      <aside className="w-80 border-l bg-muted/20 p-4 shrink-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
      <div>
        <h2 className="text-lg font-semibold border-b pb-2 mb-4">Content Settings</h2>
        {/* The Slug field is a hardcoded, fundamental part of the sidebar UI */}
        <div className="space-y-2">
            <Label htmlFor="slug-input">URL Slug</Label>
            <Input 
                id="slug-input"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                disabled={!isNewFileMode}
                className={!isNewFileMode ? 'bg-muted/50' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {isNewFileMode 
                ? "Auto-generates from title. Edit for a custom URL." 
                : "URL cannot be changed after creation."}
            </p>
        </div>
      </div>
      
      {/* 
        The GroupedFrontmatterForm handles everything ELSE.
        It receives the cleaned schema and the full frontmatter object.
        It will only render fields that are present in the schema.
      */}
      {schema && Object.keys(schema.properties || {}).length > 0 ? (
        <div className="border-t pt-6">
            <GroupedFrontmatterFields
                schema={schema}
                uiSchema={uiSchema}
                formData={frontmatter}
                onFormChange={onFrontmatterChange}
            />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground p-3 rounded-md mt-4 text-center border-dashed border">
            <p>No additional fields for this layout.</p>
        </div>
      )}
    </aside>
  );
}