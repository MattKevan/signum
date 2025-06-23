// src/app/sites/[siteId]/settings/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Manifest, ImageRef } from '@/core/types';
import { useEffect, useState, useCallback } from 'react';
import { toast } from "sonner";
import SiteSettingsForm from '@/features/site-settings/components/SiteSettingsForm'; // Import the main form

// --- FIX: Define the complete form data shape in one place ---
interface PageFormData {
  title: string;
  description: string;
  author: string;
  baseUrl: string;
  logo: ImageRef | undefined;
  favicon: ImageRef | undefined;
}

export default function SiteSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);

  // --- FIX: Manage the entire form's data in a single state object ---
  const [formData, setFormData] = useState<PageFormData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Load all settings from the manifest into the single formData state
  useEffect(() => {
    if (site?.manifest) {
      setIsLoading(true);
      setFormData({
        title: site.manifest.title,
        description: site.manifest.description,
        author: site.manifest.author || '',
        baseUrl: site.manifest.baseUrl || '',
        logo: site.manifest.logo,
        favicon: site.manifest.favicon,
      });
      setHasChanges(false);
      setIsLoading(false);
    }
  }, [site]);
  
  // This single handler receives the complete, updated form data from the child component.
  const handleFormChange = useCallback((newData: PageFormData) => {
    setFormData(newData);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!site?.manifest || !formData) {
        toast.error("Form data is not ready. Cannot save.");
        return;
    }
    setIsLoading(true);
    
    // Construct the new manifest directly from the single formData object.
    const newManifest: Manifest = {
      ...site.manifest,
      title: formData.title.trim(),
      description: formData.description.trim(),
      author: formData.author.trim(),
      baseUrl: formData.baseUrl.trim(),
      logo: formData.logo,
      favicon: formData.favicon,
    };

    try {
      await updateManifestAction(siteId, newManifest);
      toast.success('Site settings saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving site settings:", error);
      toast.error("Failed to save settings. Please try again.");
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
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-muted-foreground">Manage the core details and identity of your website.</p>
      </div>

      <div className="border-t pt-6">
        {/* --- FIX: Render the single, encapsulated form component --- */}
        <SiteSettingsForm
          siteId={siteId}
          formData={formData}
          onFormChange={handleFormChange}
        />
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}