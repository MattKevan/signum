// src/features/editor/components/forms/PageLayoutSchemaForm.tsx
'use client';

import { MarkdownFrontmatter } from '@/core/types';
import { LayoutManifest } from '@/core/services/configHelpers.service';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import ImageUploadWidget from '@/features/editor/components/ImageUploadWidget'

interface PageLayoutSchemaFormProps {
  siteId: string;
  layoutManifest: LayoutManifest | null;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

/**
 * Renders a form for the custom fields defined in a "page" layout's main 'schema'.
 */
export default function PageLayoutSchemaForm({
  siteId,
  layoutManifest,
  frontmatter,
  onFrontmatterChange,
}: PageLayoutSchemaFormProps) {
  
  const customWidgets = { imageUploader: ImageUploadWidget };

  if (!layoutManifest?.schema) {
    return <p className="text-sm text-muted-foreground p-2">This layout has no custom page options.</p>;
  }

  return (
    <SchemaDrivenForm 
      schema={layoutManifest.schema}
      uiSchema={layoutManifest.uiSchema ?? undefined}
      formData={frontmatter}
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      widgets={customWidgets}
      formContext={{ siteId }}
    />
  );
}