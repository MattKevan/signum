// src/components/publishing/SiteConfigForm.tsx
'use client';

import React, { useCallback } from 'react';
import { Manifest, ThemeConfig } from '@/types';
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

interface SiteConfigFormProps {
  // Now receives the entire manifest
  initialManifest: Manifest;
  onManifestChange: (manifest: Manifest) => void;
}

export default function SiteConfigForm({ initialManifest, onManifestChange }: SiteConfigFormProps) {
  
  // Handles changes to top-level manifest properties like title, description, author
  const handleRootChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onManifestChange({ 
      ...initialManifest, 
      [name]: value 
    });
  }, [initialManifest, onManifestChange]);

  // Handles changes to the nested theme configuration
  const handleThemeConfigChange = useCallback((field: keyof ThemeConfig['config'], value: string) => {
    onManifestChange({
      ...initialManifest,
      theme: {
        ...initialManifest.theme,
        config: {
          ...initialManifest.theme.config,
          [field]: value,
        },
      },
    });
  }, [initialManifest, onManifestChange]);

  const currentManifest = initialManifest;
  const currentThemeConfig = initialManifest.theme.config;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <fieldset className="space-y-4 border p-4 rounded-md">
        <legend className="text-lg font-semibold px-1">General Information</legend>
        <div>
          <Label htmlFor="title">Site Title *</Label>
          <Input
            id="title"
            name="title" // Corresponds to Manifest key
            value={currentManifest.title || ''}
            onChange={handleRootChange}
            placeholder="My Awesome Signum Blog"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Site Description</Label>
          <Textarea
            id="description"
            name="description" // Corresponds to Manifest key
            value={currentManifest.description || ''}
            onChange={handleRootChange}
            placeholder="A short and catchy description of what your site is about."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="author">Author Name</Label>
          <Input
            id="author"
            name="author" // Corresponds to Manifest key
            value={currentManifest.author || ''}
            onChange={handleRootChange}
            placeholder="John Doe"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border p-4 rounded-md">
        <legend className="text-lg font-semibold px-1">Appearance (Default Theme)</legend>
        <div>
          <Label htmlFor="font_family">Font Family</Label>
          <Select
            value={currentThemeConfig.font_family || 'sans-serif'}
            onValueChange={(value) => handleThemeConfigChange('font_family', value)}
          >
            <SelectTrigger id="font_family"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sans-serif">Sans Serif</SelectItem>
              <SelectItem value="serif">Serif</SelectItem>
              <SelectItem value="monospace">Monospace</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="color_scheme">Color Scheme</Label>
          <Select
            value={currentThemeConfig.color_scheme || 'light'}
            onValueChange={(value) => handleThemeConfigChange('color_scheme', value)}
          >
            <SelectTrigger id="color_scheme"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="auto">System Preference</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="primary_color_text">Primary Accent Color</Label>
          <div className="flex items-center space-x-2 mt-1">
            <Input
              id="primary_color_text"
              type="text"
              value={currentThemeConfig.primary_color || '#007AFF'}
              onChange={(e) => handleThemeConfigChange('primary_color', e.target.value)}
              placeholder="#007AFF"
              pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
            />
            <Input
              id="primary_color_picker"
              type="color"
              value={currentThemeConfig.primary_color || '#007AFF'}
              onChange={(e) => handleThemeConfigChange('primary_color', e.target.value)}
              className="h-9 w-12 p-1"
            />
          </div>
        </div>
      </fieldset>
    </form>
  );
}