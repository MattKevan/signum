// src/app/(publishing)/edit/[siteId]/settings/appearance/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import AppearanceSettingsForm from '@/components/publishing/AppearanceSettingsForm';
import { Button } from '@/components/ui/button';
import { Manifest, ThemeConfig } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { toast } from "sonner";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// CORRECTED: The getAvailableThemes function is no longer needed or available.
import { type ThemeInfo } from '@/lib/themeEngine';

// CORRECTED: Define the available themes as a hardcoded constant.
// This is the single source of truth for the UI and removes the async dependency.
const AVAILABLE_THEMES: ThemeInfo[] = [
  { id: 'default', name: 'Default Theme', type: 'core' },
  // { id: 'docs', name: 'Docs Theme', type: 'core' }, // Add future themes here
];

export default function AppearanceSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);
  const isStoreInitialized = useAppStore(state => state.isInitialized);

  // CORRECTED: selectedThemeInfo is now the primary state for the selected theme object.
  const [selectedThemeInfo, setSelectedThemeInfo] = useState<ThemeInfo | null>(null);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig['config']>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // CORRECTED: This useEffect no longer needs to fetch themes. It now correctly
  // sets the selected theme based on the site data and the hardcoded list.
  useEffect(() => {
    if (site?.manifest.theme) {
      const themeTypeFromManifest = site.manifest.theme.type || 'core'; // Handle old data gracefully
      const currentThemeInfo = AVAILABLE_THEMES.find(t => 
        t.id === site.manifest.theme.name && t.type === themeTypeFromManifest
      );
      
      setSelectedThemeInfo(currentThemeInfo || null);
      setThemeConfig(site.manifest.theme.config);
      setHasChanges(false);
    }
  }, [site]);
  
  const handleConfigChange = useCallback((newConfig: ThemeConfig['config']) => {
    setThemeConfig(newConfig);
    setHasChanges(true);
  }, []);

  const handleThemeChange = (themeId: string) => {
    const theme = AVAILABLE_THEMES.find(t => t.id === themeId);
    if (theme) {
        setSelectedThemeInfo(theme);
        setThemeConfig({});
        setHasChanges(true);
    }
  };

  const handleSave = async () => {
    if (!site || !site.manifest || !selectedThemeInfo) return;
    
    setIsLoading(true);
    const newManifest: Manifest = {
      ...site.manifest,
      theme: {
        name: selectedThemeInfo.id,
        type: selectedThemeInfo.type,
        config: themeConfig,
      },
    };

    try {
      await updateManifestAction(siteId, newManifest);
      toast.success('Appearance settings saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving appearance settings:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isStoreInitialized || !site) {
    return <div className="p-6">Loading settings...</div>;
  }
  
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-muted-foreground">Customize the visual style of your site.</p>
      </div>

      <div className="border-t pt-6 space-y-6">
        <div>
            <Label htmlFor="theme-select">Active Theme</Label>
            <Select value={selectedThemeInfo?.id || ''} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme-select" className="mt-1">
                    <SelectValue placeholder="Select a theme..." />
                </SelectTrigger>
                <SelectContent>
                    {/* The dropdown now renders from the reliable constant. */}
                    {AVAILABLE_THEMES.map(theme => (
                        <SelectItem key={`${theme.type}-${theme.id}`} value={theme.id}>
                            {theme.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        
        {selectedThemeInfo && (
            <AppearanceSettingsForm 
                themeId={selectedThemeInfo.id}
                themeType={selectedThemeInfo.type}
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