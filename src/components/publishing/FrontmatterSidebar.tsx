// src/components/publishing/FrontmatterSidebar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import type { MarkdownFrontmatter } from '@/types';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { getLayoutSchema } from '@/lib/themeEngine';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface FrontmatterSidebarProps {
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: MarkdownFrontmatter) => void;
  layoutId: string;
  themeId: string;
  themeType: 'core' | 'contrib';
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
}

export default function FrontmatterSidebar({
  frontmatter,
  onFrontmatterChange,
  layoutId,
  themeId,
  themeType,
  isNewFileMode,
  slug,
  onSlugChange,
}: FrontmatterSidebarProps) {
  
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [uiSchema, setUiSchema] = useState<UiSchema | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSchemaForLayout() {
      setIsLoading(true);
      try {
        const layoutSchemaData = await getLayoutSchema(themeId, themeType, layoutId);
        if (layoutSchemaData) {
          const isItemSchema = !!layoutSchemaData.itemSchema;
          setSchema(isItemSchema ? layoutSchemaData.itemSchema! : layoutSchemaData.schema);
          setUiSchema(isItemSchema ? layoutSchemaData.itemUiSchema : layoutSchemaData.uiSchema);
        } else {
          setSchema(null);
        }
      } catch (error) {
        console.error(`Failed to load schema for layout '${layoutId}':`, error);
        setSchema(null);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (layoutId && themeId && themeType) {
      loadSchemaForLayout();
    } else {
        setIsLoading(false);
        setSchema(null);
    }
  }, [layoutId, themeId, themeType]);

  const handleFormChange = (data: object) => {
    onFrontmatterChange(data as MarkdownFrontmatter);
  };

  if (isLoading) {
    return (
      <aside className="w-80 border-l bg-muted/20 p-4 shrink-0">
        <p className="text-sm text-muted-foreground">Loading Form...</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
      <div>
        <h2 className="text-lg font-semibold border-b pb-2 mb-4">Content Settings</h2>
        
        <div className="space-y-2">
            <Label htmlFor="slug-input">Slug (URL Path)</Label>
            <Input 
                id="slug-input"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                // CORRECTED: The field is now a normal, editable input.
                // It is only disabled for EXISTING files, where the slug cannot be changed.
                disabled={!isNewFileMode}
                className={!isNewFileMode ? 'bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {isNewFileMode 
                ? "Auto-generates from title, but you can edit it for a custom URL." 
                : "The slug cannot be changed after the file is created."}
            </p>
        </div>
      </div>
      
      {schema ? (
        <div className="border-t pt-6">
            <SchemaDrivenForm
                schema={schema}
                uiSchema={uiSchema}
                formData={frontmatter}
                onFormChange={handleFormChange}
            />
        </div>
      ) : (
        <div className="text-sm text-destructive-foreground bg-destructive p-3 rounded-md mt-4">
            <p className="font-bold">Schema Error</p>
            <p>Could not find a valid schema for the layout &quot;{layoutId || 'none'}&quot;.</p>
        </div>
      )}
    </aside>
  );
}