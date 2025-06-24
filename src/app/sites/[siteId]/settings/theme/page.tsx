// app/sites/[siteId]/settings/appearance/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { useEffect, useState } from 'react';
import { toast } from "sonner";
import { getAvailableThemes } from '@/core/services/config/configHelpers.service';
import type { Manifest, ThemeConfig, ThemeInfo } from '@/core/types';
import type { RJSFSchema } from '@rjsf/utils';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';

// Define types for theme data
interface ThemeData {
  name?: string;
  version?: string;
  appearanceSchema?: RJSFSchema;
  [key: string]: unknown;
}

// Simple utility to extract defaults from JSON schema
const extractDefaultsFromSchema = (schema: RJSFSchema): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, property]) => {
      if (typeof property === 'object' && property !== null && 'default' in property) {
        defaults[key] = property.default as string | number | boolean;
      }
    });
  }
  
  return defaults;
};

// Load theme data from theme.json
const loadThemeData = async (themeName: string): Promise<ThemeData> => {
  try {
    const response = await fetch(`/themes/${themeName}/theme.json`);
    if (!response.ok) throw new Error(`Failed to load theme: ${themeName}`);
    return await response.json() as ThemeData;
  } catch (error) {
    console.error('Error loading theme:', error);
    throw error;
  }
};

export default function AppearanceSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  
  const site = useAppStore(state => state.getSiteById(siteId));
  const updateManifestAction = useAppStore(state => state.updateManifest);

  // Simple state - load once, edit locally, save once
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [availableThemes, setAvailableThemes] = useState<ThemeInfo[]>([]);

  // Load initial data ONCE when component mounts
  useEffect(() => {
    const initializeData = async () => {
      if (!site || isInitialized) return;

      try {
        setIsLoading(true);
        
        // Get available themes
        const themes = getAvailableThemes(site.manifest);
        setAvailableThemes(themes);
        
        // Get current theme and saved config
        const currentTheme = site.manifest.theme.name || (themes[0]?.path || 'default');
        const savedConfig = site.manifest.theme.config || {};
        
        // Load theme schema
        const themeDataObj = await loadThemeData(currentTheme);
        const themeSchema = themeDataObj?.appearanceSchema;
        
        if (themeSchema) {
          // Merge saved config with schema defaults
          const defaults = extractDefaultsFromSchema(themeSchema);
          const initialData = { ...defaults, ...savedConfig };
          
          setSchema(themeSchema);
          setFormData(initialData);
        }
        
        setSelectedTheme(currentTheme);
        setIsInitialized(true);
        
      } catch (error) {
        console.error('Failed to initialize appearance settings:', error);
        toast.error('Failed to load appearance settings');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [site, isInitialized]);

  // Handle form changes from SchemaDrivenForm
  const handleFormChange = (data: object) => {
    setFormData(data as Record<string, unknown>);
    setHasChanges(true);
  };

  // Handle theme selection change
  const handleThemeChange = async (newTheme: string) => {
    if (newTheme === selectedTheme) return;

    try {
      setIsLoading(true);
      
      // Load new theme schema
      const themeDataObj = await loadThemeData(newTheme);
      const newSchema = themeDataObj?.appearanceSchema;
      
      if (newSchema) {
        // Get defaults for new theme
        const newDefaults = extractDefaultsFromSchema(newSchema);
        
        // Smart merge: preserve user values for fields that exist in new theme
        const mergedData = { ...newDefaults };
        Object.keys(formData).forEach(key => {
          if (newSchema.properties?.[key]) {
            mergedData[key] = formData[key];
          }
        });
        
        setSchema(newSchema);
        setFormData(mergedData);
      }
      
      setSelectedTheme(newTheme);
      setHasChanges(true);
      
    } catch (error) {
      console.error('Failed to load new theme:', error);
      toast.error('Failed to load theme');
    } finally {
      setIsLoading(false);
    }
  };

  // Save form data to site manifest
  const handleSave = async () => {
    if (!site?.manifest) {
      toast.error('Site data not available');
      return;
    }

    setIsSaving(true);
    try {
      const newManifest: Manifest = {
        ...site.manifest,
        theme: {
          name: selectedTheme,
          config: formData as ThemeConfig['config']
        }
      };

      await updateManifestAction(siteId, newManifest);
      setHasChanges(false);
      toast.success('Appearance settings saved successfully!');
      
    } catch (error) {
      console.error('Failed to save appearance settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!site || isLoading) {
    return (
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Appearance</h1>
          <p className="text-muted-foreground">Loading appearance settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl p-6">
      <div>
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-muted-foreground">Customize the visual style and branding of your site.</p>
      </div>

      <div className="border-t pt-6 space-y-6">
        {/* Theme Selection */}
        <div>
          <Label htmlFor="theme-select">Active Theme</Label>
          <Select 
            value={selectedTheme} 
            onValueChange={handleThemeChange}
            disabled={isSaving || isLoading}
          >
            <SelectTrigger id="theme-select" className="mt-1">
              <SelectValue placeholder="Select a theme..." />
            </SelectTrigger>
            <SelectContent>
              {availableThemes.map((theme) => (
                <SelectItem key={theme.path} value={theme.path}>
                  {theme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Theme Customization Form */}
        {schema ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Theme Customization</h3>
            <SchemaDrivenForm 
              schema={schema}
              formData={formData}
              onFormChange={handleFormChange}
            />
          </div>
        ) : (
          <div className="text-center border-2 border-dashed p-6 rounded-lg">
            <p className="font-semibold">No Customization Options</p>
            <p className="text-sm text-muted-foreground">
              The theme &quot;{selectedTheme}&quot; does not provide any customizable settings.
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasChanges || isLoading} 
          size="lg"
        >
          {isSaving ? 'Saving...' : 'Save Appearance'}
        </Button>
      </div>
    </div>
  );
}