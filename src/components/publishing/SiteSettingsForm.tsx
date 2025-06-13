// src/components/publishing/SiteSettingsForm.tsx
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SiteSettingsFormProps {
  formData: {
    title: string;
    description: string;
    author: string;
    baseUrl: string; // <-- ADD THIS LINE
  };
  onFormChange: (newData: SiteSettingsFormProps['formData']) => void;
}

export default function SiteSettingsForm({ formData, onFormChange }: SiteSettingsFormProps) {
  const handleChange = (field: keyof typeof formData, value: string) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Site Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="My Awesome Site"
        />
        <p className="text-sm text-muted-foreground">The main title for your website.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Site Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="A short, catchy description."
          rows={3}
        />
         <p className="text-sm text-muted-foreground">Used for search engines and social media previews.</p>
      </div>
       <div className="space-y-2">
        <Label htmlFor="author">Author (Optional)</Label>
        <Input
          id="author"
          value={formData.author}
          onChange={(e) => handleChange('author', e.target.value)}
          placeholder="Your Name or Organization"
        />
         <p className="text-sm text-muted-foreground">The default author for content on this site.</p>
      </div>
       {/* --- NEW BASE URL FIELD --- */}
       <div className="space-y-2 border-t pt-6">
        <Label htmlFor="baseUrl">Base URL</Label>
        <Input
          id="baseUrl"
          type="url"
          value={formData.baseUrl}
          onChange={(e) => handleChange('baseUrl', e.target.value)}
          placeholder="https://www.my-awesome-site.com"
        />
         <p className="text-sm text-muted-foreground">
            The full public URL of your site. Required for generating correct RSS feeds and sitemaps.
         </p>
      </div>
    </div>
  );
}