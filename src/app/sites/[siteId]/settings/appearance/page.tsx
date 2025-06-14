// src/app/sites/[siteId]/settings/appearance/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import AppearanceSettingsForm from '@/components/publishing/AppearanceSettingsForm';
import { Button } from '@/components/ui/button';
import { Manifest, ThemeConfig, ThemeInfo } from '@/types';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from "sonner";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAvailableThemes } from '@/lib/configHelpers';

export default function AppearanceSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);

  const [selectedThemePath, setSelectedThemePath] = useState<string>('');
  const [themeConfig, setThemeConfig] = useState<ThemeConfig['config']>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const availableThemes = useMemo(() => {
    return getAvailableThemes(site?.manifest);
  }, [site?.manifest]);

  useEffect(() => {
    if (site?.manifest.theme) {
      setSelectedThemePath(site.manifest.theme.name);
      setThemeConfig(site.manifest.theme.config);
      setHasChanges(false);
    }
  }, [site]);
  
  const handleConfigChange = useCallback((newConfig: ThemeConfig['config']) => {
    setThemeConfig(newConfig);
    setHasChanges(true);
  }, []);

  const handleThemeChange = (newThemePath: string) => {
    setSelectedThemePath(newThemePath);
    setThemeConfig({});
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!site || !site.manifest || !selectedThemePath) return;
    
    setIsLoading(true);
    const newManifest: Manifest = {
      ...site.manifest,
      theme: {
        name: selectedThemePath,
        config: themeConfig,
      },
    };

    try {
      await updateManifestAction(siteId, newManifest);
      toast.success('Appearance settings saved successfully!');
      setHasChanges(false);
    } catch {
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!site) {
    return <div className="p-6">Loading settings...</div>;
  }
  
  // The component now only returns its content, not the layout.
  return (
    <div className="space-y-6 max-w-2xl p-6">
      <div>
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-muted-foreground">Customize the visual style of your site.</p>
      </div>

      <div className="border-t pt-6 space-y-6">
        <div>
            <Label htmlFor="theme-select">Active Theme</Label>
            <Select value={selectedThemePath} onValueChange={handleThemeChange}>
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
        
        {selectedThemePath && (
            <AppearanceSettingsForm 
                site={site}
                themePath={selectedThemePath}
                themeConfig={themeConfig}
                onConfigChange={handleConfigChange}
            />
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
          {isLoading ? 'Saving...' : 'Save Appearance'}
        </Button>
      </div>
    </div>
  );
}