// src/app/create-site/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { LocalSiteData, Manifest, ThemeInfo } from '@/types';
import { Button } from '@/core/components/ui/button';
import { generateSiteId } from '@/lib/utils';
import { toast } from "sonner";
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { GENERATOR_VERSION, CORE_THEMES } from '@/config/editorConfig';
// Import the new centralized service function for theme synchronization.
import { synchronizeThemeDefaults } from '@/core/services/theme.service';

/**
 * Renders the "Create New Site" page.
 * 
 * This component is responsible for gathering initial site details (title, theme)
 * and orchestrating the creation of a new site record.
 * 
 * RECENT REFACTOR: This component no longer contains logic for parsing theme defaults itself.
 * It now uses the centralized `synchronizeThemeDefaults` service to ensure that the new
 * site's manifest is created with a complete and valid theme configuration from the start.
 * This makes the component simpler and more aligned with the principle of separation of concerns.
 */
export default function CreateSitePage() {
  const router = useRouter();
  const addSite = useAppStore((state) => state.addSite);

  // --- Local State for the Form ---
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const availableThemes = useMemo(() => CORE_THEMES, []);
  // Set the default theme on initial render.
  const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(availableThemes[0] || null);

  /**
   * Handles the form submission to create a new site.
   */
  const handleSubmit = async () => {
    if (!siteTitle.trim() || !selectedTheme) {
      toast.error('Site title and a theme are required.');
      return;
    }
    setIsLoading(true);

    try {
      const newSiteId = generateSiteId(siteTitle);
      
      // 1. Create a preliminary manifest with just the basic user choices.
      // The `config` object is intentionally left empty, as the service will populate it.
      const preliminaryManifest: Manifest = {
        siteId: newSiteId,
        generatorVersion: GENERATOR_VERSION,
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        theme: { 
          name: selectedTheme.path, 
          config: {} 
        },
        structure: [],
      };
      
      // 2. Use the central `synchronizeThemeDefaults` service to get the
      //    fully populated and correct theme configuration object.
      const synchronizedTheme = await synchronizeThemeDefaults(preliminaryManifest);
      
      // 3. Construct the final site data object, injecting the synchronized theme.
      //    This ensures the manifest is saved correctly from the very beginning.
      const newSiteData: LocalSiteData = {
        siteId: newSiteId,
        manifest: { ...preliminaryManifest, theme: synchronizedTheme },
        // These are always empty for a brand new site.
        contentFiles: [],
        themeFiles: [],
        layoutFiles: [],
      };

      // 4. Save the complete site data to storage and update the global state.
      await addSite(newSiteData);
      toast.success(`Site "${siteTitle}" created successfully!`);
      router.push(`/sites/${newSiteId}/edit`);

    } catch (error) {
      console.error("Error during site creation:", error);
      toast.error(`Failed to create site: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Create a New Site</h1>
            <Button onClick={() => router.push('/sites')} variant="outline">Cancel</Button>
        </div>

        <div className="space-y-4 p-6 border rounded-lg">
            <h2 className="text-lg font-semibold">Site Details</h2>
            <div>
                <Label htmlFor="site-title">Site Title</Label>
                <Input
                    id="site-title"
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    placeholder="My Awesome Project"
                    required
                    className="mt-1"
                />
            </div>
            <div>
                <Label htmlFor="site-description">Site Description (Optional)</Label>
                <Textarea
                    id="site-description"
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    placeholder="A short and catchy description of your new site."
                    rows={3}
                    className="mt-1"
                />
            </div>
            <div>
                <Label htmlFor="theme-select">Theme</Label>
                <Select 
                    value={selectedTheme?.path || ''} 
                    onValueChange={(themePath) => {
                        const theme = availableThemes.find(t => t.path === themePath);
                        if (theme) setSelectedTheme(theme);
                    }} 
                >
                    <SelectTrigger id="theme-select" className="mt-1">
                        <SelectValue placeholder="Select a theme..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableThemes.map(theme => (
                            <SelectItem key={theme.path} value={theme.path}>
                                {theme.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">
                    Choose the overall design for your site. You can change this later.
                </p>
            </div>
        </div>

        <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isLoading || !siteTitle.trim() || !selectedTheme} size="lg">
                {isLoading ? 'Creating...' : 'Create Site'}
            </Button>
        </div>
      </div>
    </div>
  );
}