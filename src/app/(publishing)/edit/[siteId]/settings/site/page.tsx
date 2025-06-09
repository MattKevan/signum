// src/app/(publishing)/edit/[siteId]/settings/site/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import SiteSettingsForm from '@/components/publishing/SiteSettingsForm';
import { Button } from '@/components/ui/button';
import { Manifest } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { toast } from "sonner";
import Link from 'next/link';

export default function SiteSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);
  const isStoreInitialized = useAppStore(state => state.isInitialized);

  const [formData, setFormData] = useState({ title: '', description: '', author: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (site?.manifest) {
      setFormData({
        title: site.manifest.title,
        description: site.manifest.description,
        author: site.manifest.author || '',
      });
      setHasChanges(false);
    }
  }, [site]);
  
  const handleFormChange = useCallback((newData: typeof formData) => {
    setFormData(newData);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!site || !site.manifest) return;
    if (!formData.title.trim()) {
      toast.error("Site title cannot be empty.");
      return;
    }
    
    setIsLoading(true);
    const newManifest: Manifest = {
      ...site.manifest,
      title: formData.title.trim(),
      description: formData.description.trim(),
      author: formData.author.trim(),
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

  if (!isStoreInitialized || (site && !formData.title && !site.manifest.title)) {
    return <div className="p-6">Loading settings...</div>;
  }
  
  if (!site) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold">Site Not Found</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-muted-foreground">Manage the core details of your website.</p>
      </div>
      <div className="border-t pt-6">
        <SiteSettingsForm 
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