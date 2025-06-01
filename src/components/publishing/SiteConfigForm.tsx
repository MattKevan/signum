// src/components/publishing/SiteConfigForm.tsx
'use client';

import React, { useCallback } from 'react';
import { SiteConfigFile } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assuming shadcn/ui Select

interface SiteConfigFormProps {
  initialConfig: SiteConfigFile;
  onConfigChange: (config: SiteConfigFile) => void;
}

export default function SiteConfigForm({ initialConfig, onConfigChange }: SiteConfigFormProps) {
  
  // Generic handler for top-level config fields
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onConfigChange({ 
      ...initialConfig, 
      [name]: value 
    });
  }, [initialConfig, onConfigChange]);

  // Specific handler for style_hints (which are nested)
  const handleStyleHintChange = useCallback((e: React.ChangeEvent<HTMLInputElement> | string, name: keyof NonNullable<SiteConfigFile['style_hints']>) => {
    let value: string;
    if (typeof e === 'string') {
        value = e; // For Select components that return string value directly
    } else {
        value = e.target.value;
    }

    onConfigChange({
      ...initialConfig,
      style_hints: {
        ...initialConfig.style_hints, // Spread existing style_hints
        [name]: value,
      },
    });
  }, [initialConfig, onConfigChange]);

  const currentConfig = initialConfig; // Use initialConfig directly as it's updated by parent

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {/* General Site Information */}
      <fieldset className="space-y-4 border p-4 rounded-md">
        <legend className="text-lg font-semibold px-1">General Information</legend>
        <div>
          <Label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">Site Title *</Label>
          <Input
            id="title"
            name="title"
            value={currentConfig.title || ''}
            onChange={handleChange}
            placeholder="My Awesome Signum Blog"
            required
            className="mt-1 block w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">The main title of your site.</p>
        </div>

        <div>
          <Label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">Site Description</Label>
          <Textarea
            id="description"
            name="description"
            value={currentConfig.description || ''}
            onChange={handleChange}
            placeholder="A short and catchy description of what your site is about."
            rows={3}
            className="mt-1 block w-full"
          />
           <p className="text-xs text-muted-foreground mt-1">Used for summaries and search engine metadata.</p>
        </div>

        <div>
          <Label htmlFor="author" className="block text-sm font-medium text-foreground mb-1">Author Name</Label>
          <Input
            id="author"
            name="author"
            value={currentConfig.author || ''}
            onChange={handleChange}
            placeholder="John Doe"
            className="mt-1 block w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">The name of the site author (optional).</p>
        </div>
      </fieldset>

      {/* Style Hints */}
      <fieldset className="space-y-4 border p-4 rounded-md">
        <legend className="text-lg font-semibold px-1">Appearance</legend>
        <div>
          <Label htmlFor="style_font_family" className="block text-sm font-medium text-foreground mb-1">Font Family</Label>
          <Select
            value={currentConfig.style_hints?.font_family || 'sans-serif'}
            onValueChange={(value) => handleStyleHintChange(value, 'font_family')}
          >
            <SelectTrigger id="style_font_family" className="w-full mt-1">
              <SelectValue placeholder="Select font family" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sans-serif">Sans Serif (Default)</SelectItem>
              <SelectItem value="serif">Serif</SelectItem>
              <SelectItem value="monospace">Monospace</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Choose the base font style for your site content.</p>
        </div>

        <div>
          <Label htmlFor="style_theme" className="block text-sm font-medium text-foreground mb-1">Color Theme</Label>
          <Select
            value={currentConfig.style_hints?.theme || 'light'}
            onValueChange={(value) => handleStyleHintChange(value, 'theme')}
          >
            <SelectTrigger id="style_theme" className="w-full mt-1">
              <SelectValue placeholder="Select color theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light (Default)</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="auto">System Preference</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Select the preferred color scheme. 'System' will adapt to user's OS settings.</p>
        </div>
        
        <div>
          <Label htmlFor="style_primary_color" className="block text-sm font-medium text-foreground mb-1">Primary Accent Color</Label>
          <div className="flex items-center space-x-2 mt-1">
            <Input
              id="style_primary_color_text"
              name="primary_color_text" // Different name to avoid conflict if used elsewhere
              type="text"
              value={currentConfig.style_hints?.primary_color || '#007AFF'}
              onChange={(e) => handleStyleHintChange(e, 'primary_color')}
              placeholder="#007AFF"
              className="block w-full"
              pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" // Basic hex color pattern
            />
            <Input
              id="style_primary_color_picker"
              name="primary_color_picker"
              type="color"
              value={currentConfig.style_hints?.primary_color || '#007AFF'}
              onChange={(e) => handleStyleHintChange(e, 'primary_color')}
              className="h-10 w-12 p-1 cursor-pointer border-input" // Match height of text input
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Choose an accent color (e.g., for links). Use a hex value like #RRGGBB.</p>
        </div>
      </fieldset>

      {/* Add more fieldsets for other configuration sections as needed */}
      {/* For example:
      <fieldset className="space-y-4 border p-4 rounded-md">
        <legend className="text-lg font-semibold px-1">Advanced Settings</legend>
        <p className="text-sm text-muted-foreground">Future advanced settings will go here.</p>
      </fieldset>
      */}
    </form>
  );
}