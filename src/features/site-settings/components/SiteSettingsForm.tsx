// src/features/site-settings/components/SiteSettingsForm.tsx
'use client';

import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { ImageRef } from '@/types';
import SiteAssetUploader from './SiteAssetsUploader'; // Import the uploader

// --- FIX: The props now define the complete shape of the form's data ---
interface SiteSettingsFormProps {
  siteId: string;
  formData: {
    title: string;
    description: string;
    author: string;
    baseUrl: string;
    logo: ImageRef | undefined;
    favicon: ImageRef | undefined;
  };
  onFormChange: (newData: SiteSettingsFormProps['formData']) => void;
}

export default function SiteSettingsForm({ siteId, formData, onFormChange }: SiteSettingsFormProps) {
  
  // A generic handler to update any field in the formData object.
  const handleChange = (field: keyof typeof formData, value: any) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* --- NEW: Site Identity section is now part of the form --- */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Site Identity</h2>
        <SiteAssetUploader 
          siteId={siteId}
          label="Site Logo"
          value={formData.logo}
          onChange={(newRef) => handleChange('logo', newRef)}
          onRemove={() => handleChange('logo', undefined)}
        />
        <SiteAssetUploader
          siteId={siteId}
          label="Favicon"
          value={formData.favicon}
          onChange={(newRef) => handleChange('favicon', newRef)}
          onRemove={() => handleChange('favicon', undefined)}
        />
      </div>

      {/* --- NEW: Core Details section is now within the form --- */}
      <div className="border-t pt-6 space-y-4">
        <h2 className="text-lg font-semibold">Core Details</h2>
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
        <div className="space-y-2">
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
    </div>
  );
}