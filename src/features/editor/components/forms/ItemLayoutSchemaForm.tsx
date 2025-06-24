// src/features/editor/components/forms/ItemLayoutSchemaForm.tsx
'use client';

// Imports are identical to PageLayoutSchemaForm
import { MarkdownFrontmatter } from '@/core/types';
import { LayoutManifest } from '@/core/services/configHelpers.service';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import ImageUploadWidget from '../ImageUploadWidget';

interface ItemLayoutSchemaFormProps {
  siteId: string;
  layoutManifest: LayoutManifest | null;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

/**
 * Renders a form for the custom fields defined in a "collection" layout's 'itemSchema'.
 * This is used for individual blog posts, portfolio items, etc.
 */
export default function ItemLayoutSchemaForm({
  siteId,
  layoutManifest,
  frontmatter,
  onFrontmatterChange,
}: ItemLayoutSchemaFormProps) {

  const customWidgets = { imageUploader: ImageUploadWidget };
  
  if (!layoutManifest?.itemSchema) {
    return <p className="text-sm text-muted-foreground p-2">The parent collection's layout has no custom item options.</p>;
  }

  return (
    <SchemaDrivenForm 
      schema={layoutManifest.itemSchema}
      uiSchema={layoutManifest.itemUiSchema ?? undefined}
      formData={frontmatter}
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      widgets={customWidgets}
      formContext={{ siteId }}
    />
  );
}