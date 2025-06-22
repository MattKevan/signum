// src/app/sites/[siteId]/settings/appearance/page.tsx

'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import AppearanceSettingsForm from '@/features/site-settings/components/AppearanceSettingsForm';
import { Button } from '@/core/components/ui/button';
import { Manifest, ThemeConfig, ThemeInfo } from '@/types';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from "sonner";
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { getAvailableThemes, getJsonAsset, ThemeManifest } from '@/core/services/configHelpers.service';
import { RJSFSchema } from '@rjsf/utils';
import { synchronizeThemeDefaults } from '@/core/services/theme.service';


export default function AppearanceSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);

  const [formData, setFormData] = useState<ThemeConfig | null>(null);
  const [appearanceSchema, setAppearanceSchema] = useState<RJSFSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const availableThemes = useMemo(() => {
    return getAvailableThemes(site?.manifest);
  }, [site?.manifest]);

  // This effect correctly initializes the form's state.
  useEffect(() => {
    // Only re-initialize from the global store IF the user has no unsaved changes.
    // This guard prevents wiping out the user's work.
    if (site?.manifest && !hasChanges) {
      setIsLoading(true);
      synchronizeThemeDefaults(site.manifest)
        .then(synchronizedTheme => {
          setFormData(synchronizedTheme);
          return getJsonAsset<ThemeManifest>(site, 'theme', synchronizedTheme.name, 'theme.json');
        })
        .then(themeManifest => {
          setAppearanceSchema(themeManifest?.appearanceSchema || null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [site, hasChanges]);


  // --- FIX: This is the corrected state update handler ---
  // It uses the functional form of the state setter to avoid stale closures.
  const handleConfigChange = useCallback((newConfig: ThemeConfig['config']) => {
    // `setFormData`'s callback receives the guaranteed latest state (`prevFormData`),
    // preventing any race conditions or work with stale data.
    setFormData(prevFormData => {
      if (!prevFormData) return null;
      // react-jsonschema-form's onChange provides the *entire* updated form data.
      // We don't need to merge; we simply replace the old config with the new one.
      return { ...prevFormData, config: newConfig };
    });
    setHasChanges(true);
  }, []); // The dependency array can safely be empty.

  const handleThemeChange = (newThemePath: string) => {
    if (site) {
      setIsLoading(true);
      setHasChanges(true);
      const tempManifest = { ...site.manifest, theme: { name: newThemePath, config: {} } };
      synchronizeThemeDefaults(tempManifest)
        .then(synchronizedTheme => {
          setFormData(synchronizedTheme);
          return getJsonAsset<ThemeManifest>(site, 'theme', newThemePath, 'theme.json');
        })
        .then(themeManifest => {
          setAppearanceSchema(themeManifest?.appearanceSchema || null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  const handleSave = async () => {
    if (!site?.manifest || !formData) return;
    
    setIsLoading(true);
    const newManifest: Manifest = {
      ...site.manifest,
      theme: formData,
    };

    try {
      await updateManifestAction(siteId, newManifest);
      toast.success('Appearance settings saved successfully!');
      // After saving, reset the change flag. This will allow the main `useEffect`
      // to re-sync with the global state if the user navigates away and back.
      setHasChanges(false);
    } catch(error) {
      toast.error(`Failed to save settings: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !formData) {
    return <div className="p-6">Loading settings...</div>;
  }
  
  return (
    <div className="space-y-6 max-w-2xl p-6">
      <div>
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-muted-foreground">Customize the visual style of your site.</p>
      </div>
      <div className="border-t pt-6 space-y-6">
        <div>
            <Label htmlFor="theme-select">Active Theme</Label>
            <Select value={formData.name} onValueChange={handleThemeChange}>
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
        <AppearanceSettingsForm 
            isLoading={isLoading}
            schema={appearanceSchema}
            themePath={formData.name}
            themeConfig={formData.config}
            onConfigChange={handleConfigChange}
        />
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
          {isLoading ? 'Saving...' : 'Save Appearance'}
        </Button>
      </div>
    </div>
  );
}