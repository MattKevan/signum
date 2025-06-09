// src/components/publishing/PrimaryContentFields.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MarkdownFrontmatter } from '@/types';

// FIXED: The interface is now much stricter and safer.
// It only defines the properties this component actually cares about.
interface PrimaryFieldsProps {
  frontmatter: {
    title?: string;
    description?: string;
  };
  // The callback expects a partial update to the main frontmatter state.
  onFrontmatterChange: (newData: Partial<MarkdownFrontmatter>) => void;
  showDescription?: boolean;
}

export default function PrimaryContentFields({
  frontmatter,
  onFrontmatterChange,
  showDescription = false,
}: PrimaryFieldsProps) {

  // FIXED: The handler now only passes back the single field that changed.
  // This makes the component more reusable and decoupled from the parent's state shape.
  const handleChange = (field: 'title' | 'description', value: string) => {
    onFrontmatterChange({
      [field]: value,
    });
  };

  return (
    <div className="space-y-4 shrink-0">
      <div className="space-y-1.5">
        <Label htmlFor="content-title" className="text-sm font-medium sr-only">
          Title
        </Label>
        <Input
          id="content-title"
          placeholder="Enter a title..."
          value={frontmatter.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          // These classes create the large, "invisible" input style
          className="text-2xl lg:text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent"
        />
      </div>

      {showDescription && (
        <div className="space-y-1.5">
          <Label htmlFor="content-description" className="text-sm font-medium sr-only">
            Description
          </Label>
          <Textarea
            id="content-description"
            placeholder="Add a short description... (optional)"
            value={frontmatter.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            // Style for a clean, borderless textarea
            className="p-0 border-0 shadow-none focus-visible:ring-0 text-muted-foreground bg-transparent resize-none"
            rows={1}
          />
        </div>
      )}
    </div>
  );
}