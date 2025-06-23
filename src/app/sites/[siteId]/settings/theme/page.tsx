// app/sites/[siteId]/settings/appearance/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Switch } from '@/core/components/ui/switch';
import { useEffect, useState } from 'react';
import { toast } from "sonner";
import { getAvailableThemes } from '@/core/services/configHelpers.service';
import type { Manifest, ThemeConfig, ThemeInfo } from '@/types';
import type { RJSFSchema } from '@rjsf/utils';

// Simple utility to extract defaults from JSON schema
const extractDefaultsFromSchema = (schema: RJSFSchema): Record<string, any> => {
  const defaults: Record<string, any> = {};
  
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, property]) => {
      if (typeof property === 'object' && property !== null && 'default' in property) {
        defaults[key] = property.default;
      }
    });
  }
  
  return defaults;
};

// Load theme data from theme.json
const loadThemeData = async (themeName: string) => {
  try {
    const response = await fetch(`/themes/${themeName}/theme.json`);
    if (!response.ok) throw new Error(`Failed to load theme: ${themeName}`);
    return await response.json();
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
  const [formData, setFormData] = useState<Record<string, any>>({});
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

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
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

  // Render form field based on schema type
  const renderFormField = (fieldName: string, fieldSchema: any) => {
    const value = formData[fieldName];
    const label = fieldSchema.title || fieldName;
    const description = fieldSchema.description;

    // Handle enum fields (like font selectors) with custom labels
    if (fieldSchema.enum && fieldSchema.enumNames) {
      const options = fieldSchema.enum.map((enumValue: string, index: number) => ({
        value: enumValue,
        label: fieldSchema.enumNames[index] || enumValue
      }));

      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName}>{label}</Label>
          <Select
            value={value || ''}
            onValueChange={(selectedValue) => handleFieldChange(fieldName, selectedValue)}
          >
            <SelectTrigger id={fieldName}>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((option: { value: string; label: string }) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {value && (
            <p className="text-xs text-muted-foreground font-mono">
              CSS: {value}
            </p>
          )}
        </div>
      );
    }

    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.format === 'color' || fieldName.includes('color')) {
          return (
            <div key={fieldName} className="space-y-2">
              <Label htmlFor={fieldName}>{label}</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id={fieldName}
                  type="color"
                  value={value || ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                  className="w-16 h-10 p-1 rounded border"
                />
                <Input
                  type="text"
                  value={value || ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                  placeholder={fieldSchema.default || ''}
                  className="flex-1"
                />
              </div>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          );
        }
        
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>{label}</Label>
            <Input
              id={fieldName}
              type="text"
              value={value || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={fieldSchema.default || ''}
            />
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div key={fieldName} className="flex items-center justify-between space-y-2">
            <div>
              <Label htmlFor={fieldName}>{label}</Label>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <Switch
              id={fieldName}
              checked={value || false}
              onCheckedChange={(checked) => handleFieldChange(fieldName, checked)}
            />
          </div>
        );

      case 'number':
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>{label}</Label>
            <Input
              id={fieldName}
              type="number"
              value={value || ''}
              onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
              placeholder={fieldSchema.default?.toString() || ''}
            />
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        );

      default:
        return (
          <div key={fieldName} className="space-y-2">
            <Label>{label}</Label>
            <p className="text-sm text-muted-foreground">
              Unsupported field type: {fieldSchema.type}
            </p>
          </div>
        );
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
        {schema?.properties ? (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Theme Customization</h3>
            <div className="space-y-4">
              {Object.entries(schema.properties).map(([fieldName, fieldSchema]) =>
                renderFormField(fieldName, fieldSchema as any)
              )}
            </div>
          </div>
        ) : (
          <div className="text-center border-2 border-dashed p-6 rounded-lg">
            <p className="font-semibold">No Customization Options</p>
            <p className="text-sm text-muted-foreground">
              The theme "{selectedTheme}" does not provide any customizable settings.
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