// src/app/(publishing)/edit/[siteId]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import SiteConfigForm from '@/components/publishing/SiteConfigForm';
import { Button } from '@/components/ui/button';
import { SiteConfigFile } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { toast } from "sonner";

export default function EditSiteConfigPage() {
  const router = useRouter(); // Not used in this version, but good to have if needed
  const params = useParams();
  const siteId = params.siteId as string;

  // Selectors for store state and actions
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateSiteConfigAction = useAppStore(state => state.updateSiteConfig);

  const [currentConfig, setCurrentConfig] = useState<SiteConfigFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);


  useEffect(() => {
    if (site?.config) {
      // Deep copy to avoid direct mutation of store state if form changes object references
      setCurrentConfig(JSON.parse(JSON.stringify(site.config)));
      setHasChanges(false); // Reset changes when site data reloads
    }
  }, [site]); // Re-run if the site object from the store changes

  const handleConfigChange = useCallback((newConfig: SiteConfigFile) => {
    setCurrentConfig(newConfig);
    setHasChanges(true);
  }, []);

  const handleSaveConfig = async () => {
    if (currentConfig && siteId) {
      if (!currentConfig.title.trim()) {
        toast.error("Site title cannot be empty.");
        return;
      }
      setIsLoading(true);
      try {
        await updateSiteConfigAction(siteId, currentConfig);
        toast.success('Site configuration saved successfully!');
        setHasChanges(false); // Reset changes after successful save
      } catch (error) {
        console.error("Error saving site configuration:", error);
        toast.error("Failed to save configuration. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!site) {
    // This case should ideally be handled by the layout or a loading state from the store
    return <p className="p-4">Loading site data or site not found...</p>;
  }
  if (!currentConfig) {
     return <p className="p-4">Loading configuration...</p>;
  }


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Site Configuration</h1>
        {/* Optional: Add a "Discard Changes" button */}
      </div>
      <SiteConfigForm initialConfig={currentConfig} onConfigChange={handleConfigChange} />
      <Button 
        onClick={handleSaveConfig} 
        disabled={isLoading || !hasChanges} 
        className="mt-6"
      >
        {isLoading ? 'Saving...' : 'Save Configuration'}
      </Button>
    </div>
  );
}