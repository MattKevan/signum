'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// We use a specific type for the props to ensure type safety.
// It can accept any object that might have a title or description.
interface PrimaryFieldsProps {
  frontmatter: {
    title?: string;
    description?: string;
    [key: string]: any;
  };
  onFrontmatterChange: (newData: { title?: string; description?: string }) => void;
  showDescription?: boolean;
}

export default function PrimaryContentFields({
  frontmatter,
  onFrontmatterChange,
  showDescription = false,
}: PrimaryFieldsProps) {

  // A single handler for both fields. It calls the parent's callback
  // with an object containing only the changed field.
  const handleChange = (field: 'title' | 'description', value: string) => {
    onFrontmatterChange({
      ...frontmatter,
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
            className="p-0 border-0 shadow-none focus-visible:ring-0 text-muted-foreground bg-transparent"
            rows={1}
          />
        </div>
      )}
    </div>
  );
}