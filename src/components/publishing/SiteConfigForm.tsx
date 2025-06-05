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
} from "@/components/ui/select";

interface SiteConfigFormProps {
  initialConfig: SiteConfigFile;
  onConfigChange: (config: SiteConfigFile) => void;
}

export default function SiteConfigForm({ initialConfig, onConfigChange }: SiteConfigFormProps) {
  
  // Generic handler for top-level config fields (including new style fields)
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onConfigChange({ 
      ...initialConfig, 
      [name]: value 
    });
  }, [initialConfig, onConfigChange]);

  // Specific handler for Select components which return value directly
  const handleSelectChange = useCallback((name: keyof SiteConfigFile, value: string) => {
    onConfigChange({
      ...initialConfig,
      [name]: value,
    });
  }, [initialConfig, onConfigChange]);


  // Handler specifically for the primary_color text input to ensure it also updates the color picker
  // and for the color picker to update the text input.
  const handlePrimaryColorChange = useCallback((value: string) => {
    onConfigChange({
        ...initialConfig,
        primary_color: value,
    });
  }, [initialConfig, onConfigChange]);


  const currentConfig = initialConfig;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <fieldset className="space-y-4 border p-4 rounded-md">
        <legend className="text-lg font-semibold px-1">General Information</legend>
        <div>
          <Label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">Site Title *</Label>
          <Input
            id="title"
            name="title" // Corresponds to SiteConfigFile key
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
            name="description" // Corresponds to SiteConfigFile key
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
            name="author" // Corresponds to SiteConfigFile key
            value={currentConfig.author || ''}
            onChange={handleChange}
            placeholder="John Doe"
            className="mt-1 block w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">The name of the site author (optional).</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border p-4 rounded-md">
        <legend className="text-lg font-semibold px-1">Appearance</legend>
        <div>
          <Label htmlFor="font_family" className="block text-sm font-medium text-foreground mb-1">Font Family</Label>
          <Select
            value={currentConfig.font_family || 'sans-serif'}
            onValueChange={(value) => handleSelectChange('font_family', value)}
          >
            <SelectTrigger id="font_family" className="w-full mt-1">
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
          <Label htmlFor="theme" className="block text-sm font-medium text-foreground mb-1">Color Theme</Label>
          <Select
            value={currentConfig.theme || 'light'}
            onValueChange={(value) => handleSelectChange('theme', value)}
          >
            <SelectTrigger id="theme" className="w-full mt-1">
              <SelectValue placeholder="Select color theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light (Default)</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="auto">System Preference</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Select the preferred color scheme. &apos;System&apos; will adapt to user&apos;s OS settings.</p>
        </div>
        
        <div>
          <Label htmlFor="primary_color_text_input" className="block text-sm font-medium text-foreground mb-1">Primary Accent Color</Label>
          <div className="flex items-center space-x-2 mt-1">
            <Input
              id="primary_color_text_input"
              name="primary_color" // Corresponds to SiteConfigFile key
              type="text"
              value={currentConfig.primary_color || '#007AFF'}
              onChange={(e) => handlePrimaryColorChange(e.target.value)} // Use dedicated handler
              placeholder="#007AFF"
              className="block w-full"
              pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
            />
            <Input
              id="primary_color_picker" // Different ID for the picker itself
              name="primary_color_picker_input" // Not directly tied to SiteConfigFile key
              type="color"
              value={currentConfig.primary_color || '#007AFF'}
              onChange={(e) => handlePrimaryColorChange(e.target.value)} // Use dedicated handler
              className="h-10 w-12 p-1 cursor-pointer border-input rounded-md"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Choose an accent color (e.g., for links). Use a hex value like #RRGGBB.</p>
        </div>
      </fieldset>
    </form>
  );
}