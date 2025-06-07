'use client';

import React, { useState, useEffect } from 'react';
import type { MarkdownFrontmatter } from '@/types';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { getLayoutSchema } from '@/lib/themeEngine';
import { RJSFSchema, UiSchema } from '@rjsf/utils';

interface FrontmatterSidebarProps {
  // The current frontmatter data for the file being edited.
  frontmatter: MarkdownFrontmatter;
  // Callback to update the parent component's state.
  onFrontmatterChange: (newFrontmatter: MarkdownFrontmatter) => void;
  // The ID of the layout chosen for this content (e.g., "blog", "page").
  layoutId: string;
  // The name of the theme currently being used.
  themeName: string;
}

export default function FrontmatterSidebar({
  frontmatter,
  onFrontmatterChange,
  layoutId,
  themeName,
}: FrontmatterSidebarProps) {
  
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [uiSchema, setUiSchema] = useState<UiSchema | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSchemaForLayout() {
      setIsLoading(true);
      try {
        const layoutSchemaData = await getLayoutSchema(themeName, layoutId);
        if (layoutSchemaData) {
          // Determine if we should use the itemSchema (for collection items) or the main schema (for pages/collection listings)
          const isItem = !!layoutSchemaData.itemSchema;
          setSchema(isItem ? layoutSchemaData.itemSchema! : layoutSchemaData.schema);
          setUiSchema(isItem ? layoutSchemaData.itemUiSchema : layoutSchemaData.uiSchema);
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
    
    if (layoutId && themeName) {
      loadSchemaForLayout();
    }
  }, [layoutId, themeName]);

  const handleFormChange = (data: object) => {
    // FIXED: Cast the generic 'object' from the form to the specific
    // 'MarkdownFrontmatter' type that the parent component expects.
    onFrontmatterChange(data as MarkdownFrontmatter);
  };

  if (isLoading) {
    return (
      <aside className="w-80 border-l bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">Loading Form...</p>
      </aside>
    );
  }

  if (!schema) {
    return (
       <aside className="w-80 border-l bg-muted/20 p-4">
        <h2 className="text-lg font-semibold border-b pb-2">Fields</h2>
        <div className="text-sm text-destructive-foreground bg-destructive p-2 rounded-md mt-4">
            <p className="font-bold">Schema Error</p>
            <p>Could not find a frontmatter schema for the layout &quot;{layoutId}&quot;.</p>
        </div>
       </aside>
    );
  }

  return (
    <aside className="w-80 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
      <h2 className="text-lg font-semibold border-b pb-2">{schema.title || 'Content Fields'}</h2>
      
      <SchemaDrivenForm
        schema={schema}
        uiSchema={uiSchema}
        formData={frontmatter}
        onFormChange={handleFormChange}
      />
    </aside>
  );
}