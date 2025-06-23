// app/sites/[siteId]/settings/appearance/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from "sonner";
import { getAvailableThemes } from '@/core/services/configHelpers.service';
import { getMergedThemeDataForForm } from '@/core/services/theme.service';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import type { Manifest, ThemeConfig, ThemeInfo } from '@/types';
import type { RJSFSchema } from '@rjsf/utils';

export default function AppearanceSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);

  // Simple state - no refs needed
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [formData, setFormData] = useState<ThemeConfig['config']>({});
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const availableThemes = useMemo(() => getAvailableThemes(site?.manifest), [site?.manifest]);

  // Initialize theme selection from site manifest
  useEffect(() => {
    if (site?.manifest.theme.name && !selectedTheme) {
      setSelectedTheme(site.manifest.theme.name);
    }
  }, [site?.manifest.theme.name, selectedTheme]);

  // Load theme data when selection changes
  useEffect(() => {
    if (!selectedTheme) return;

    const loadThemeData = async () => {
      setIsLoading(true);
      try {
        // Get user's saved config if they're editing the current theme
        const savedConfig = site?.manifest.theme.name === selectedTheme 
          ? site.manifest.theme.config || {}
          : {};
        
        const { schema: themeSchema, initialConfig } = await getMergedThemeDataForForm(
          selectedTheme, 
          savedConfig
        );
        
        setSchema(themeSchema);
        setFormData(initialConfig);
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to load theme data:', error);
        toast.error('Failed to load theme data');
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeData();
  }, [selectedTheme, site?.manifest.theme.name, site?.manifest.theme.config]);

  // Handle form changes
  const handleFormChange = useCallback((event: { formData?: Record<string, unknown> }) => {
    const newData = (event.formData || {}) as ThemeConfig['config'];
    setFormData(newData);
    setHasChanges(true);
  }, []);

  // Handle theme selection change
  const handleThemeChange = useCallback((newTheme: string) => {
    if (newTheme !== selectedTheme) {
      setSelectedTheme(newTheme);
      setHasChanges(true);
    }
  }, [selectedTheme]);

  // Simple save function - direct access to current state
  const handleSave = useCallback(async () => {
    if (!site?.manifest || !selectedTheme) {
      toast.error('Site data not ready');
      return;
    }

    setIsSaving(true);
    try {
      const newManifest: Manifest = {
        ...site.manifest,
        theme: {
          name: selectedTheme,
          config: formData, // Direct access to current form state
        },
      };

      await updateManifestAction(siteId, newManifest);
      toast.success('Appearance settings saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save appearance settings:', error);
      toast.error(`Failed to save settings: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }, [site?.manifest, selectedTheme, formData, updateManifestAction, siteId]);

  // Loading state for initial data
  if (!site || isLoading) {
    return (
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Appearance</h1>
          <p className="text-muted-foreground">Loading theme data...</p>
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
        <div>
          <Label htmlFor="theme-select">Active Theme</Label>
          <Select 
            value={selectedTheme} 
            onValueChange={handleThemeChange}
            disabled={isSaving}
          >
            <SelectTrigger id="theme-select" className="mt-1">
              <SelectValue placeholder="Select a theme..." />
            </SelectTrigger>
            <SelectContent>
              {availableThemes.map((theme: ThemeInfo) => (
                <SelectItem key={theme.path} value={theme.path}>
                  {theme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Theme customization form */}
        {schema ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Theme Customizadsfdtion</h3>
            <SchemaDrivenForm 
              schema={schema}
              formData={formData}
              onFormChange={handleFormChange}
            />
          </div>
        ) : (
          <div className="text-center border-2 border-dashed p-6 rounded-lg">
            <p className="font-semibold">No Appearance Options</p>
            <p className="text-sm text-muted-foreground">
              The current theme "{selectedTheme}" does not provide any customizable settings.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasChanges || !selectedTheme} 
          size="lg"
        >
          {isSaving ? 'Saving...' : 'Save Appearance'}
        </Button>
      </div>
    </div>
  );
}