// src/components/publishing/FrontmatterSidebar.tsx
'use client';

import React from 'react';
import type { MarkdownFrontmatter } from '@/types'; // Use 'type' import
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { slugify } from '@/lib/utils';

interface FrontmatterSidebarProps {
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: MarkdownFrontmatter) => void;
  isNewFileMode: boolean;
  proposedSlug: string;
  onProposedSlugChange?: (newSlug: string) => void;
}

export default function FrontmatterSidebar({
  frontmatter,
  onFrontmatterChange,
  isNewFileMode,
  proposedSlug,
  onProposedSlugChange,
}: FrontmatterSidebarProps) {
  
  const handleChange = (
    field: keyof MarkdownFrontmatter, 
    value: string | string[] | undefined // Allow undefined for optional fields like date
  ) => {
    const newFrontmatterData = { ...frontmatter, [field]: value };
    
    if (field === 'title' && isNewFileMode && onProposedSlugChange && typeof value === 'string') {
        onProposedSlugChange(slugify(value));
    }
    
    onFrontmatterChange(newFrontmatterData);
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tagsString = e.target.value;
    const tagsArray = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    handleChange('tags', tagsArray);
  };

  return (
    <aside className="w-80 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
      <h2 className="text-lg font-semibold border-b pb-2">Metadata</h2>

      <div>
        <Label htmlFor="fm-title" className="block text-sm font-medium mb-1">Title *</Label>
        <Input
          id="fm-title"
          type="text"
          value={frontmatter.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Enter post title"
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="fm-slug" className="block text-sm font-medium mb-1">Slug (URL part)</Label>
        <Input
          id="fm-slug"
          type="text"
          value={proposedSlug}
          readOnly={!isNewFileMode || !onProposedSlugChange}
          onChange={(e) => isNewFileMode && onProposedSlugChange && onProposedSlugChange(e.target.value)}
          placeholder="auto-generated-from-title"
          className="mt-1 bg-muted/50 border-dashed"
        />
        {isNewFileMode && <p className="text-xs text-muted-foreground mt-1">Auto-generated. Editable before first save.</p>}
        {!isNewFileMode && <p className="text-xs text-muted-foreground mt-1">Slug is fixed after creation.</p>}
      </div>

      <div>
        <Label htmlFor="fm-date" className="block text-sm font-medium mb-1">Date</Label>
        <Input
          id="fm-date"
          type="date"
          value={frontmatter.date ? frontmatter.date.split('T')[0] : ''}
          onChange={(e) => handleChange('date', e.target.value ? new Date(e.target.value).toISOString().split('T')[0] : undefined)}
          className="mt-1"
        />
         <p className="text-xs text-muted-foreground mt-1">Format: YYYY-MM-DD. Defaults to today for new files.</p>
      </div>

      <div>
        <Label htmlFor="fm-status" className="block text-sm font-medium mb-1">Status</Label>
        <Select
          value={frontmatter.status || 'draft'}
          onValueChange={(value) => handleChange('status', value as 'draft' | 'published')}
        >
          <SelectTrigger id="fm-status" className="w-full mt-1">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="fm-summary" className="block text-sm font-medium mb-1">Summary</Label>
        <Textarea
          id="fm-summary"
          value={frontmatter.summary || ''}
          onChange={(e) => handleChange('summary', e.target.value)}
          placeholder="A brief summary of the content (optional)."
          rows={3}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="fm-tags" className="block text-sm font-medium mb-1">Tags</Label>
        <Input
          id="fm-tags"
          type="text"
          value={(frontmatter.tags || []).join(', ')}
          onChange={handleTagsChange}
          placeholder="tag1, another-tag, keyword"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">Comma-separated list of tags.</p>
      </div>
    </aside>
  );
}