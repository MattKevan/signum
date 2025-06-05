// src/app/(publishing)/edit/[siteId]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation'; // useRouter might be useful later
import { useAppStore } from '@/stores/useAppStore';
import SiteConfigForm from '@/components/publishing/SiteConfigForm';
import { Button } from '@/components/ui/button';
import { SiteConfigFile } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { toast } from "sonner";
import Link from 'next/link'; // For linking back if site not found

export default function EditSiteConfigPage() {
  const params = useParams();
  const siteId = params.siteId as string; // Get siteId from URL parameters

  // Selectors for store state and actions.
  // Using useCallback for the selector function passed to useAppStore can sometimes
  // help with memoization if the selector itself is complex, but for simple getters,
  // it's often not strictly necessary if the dependencies are handled correctly.
  // Here, siteId is a dependency for the selector.
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateSiteConfigAction = useAppStore(state => state.updateSiteConfig);
  const isStoreInitialized = useAppStore(state => state.isInitialized);

  // State for the form's current configuration data
  const [currentConfig, setCurrentConfig] = useState<SiteConfigFile | null>(null);
  // State to manage loading status during save operations
  const [isLoading, setIsLoading] = useState(false);
  // State to track if there are unsaved changes in the form
  const [hasChanges, setHasChanges] = useState(false);

  // Effect to initialize or update the form's currentConfig when the site data from the store changes
  // or when the component first mounts with a valid siteId.
  useEffect(() => {
    if (site?.config) {
      // Deep copy the site's config to local state to avoid direct mutation of the store's state.
      // This is crucial if SiteConfigForm or other interactions might modify nested objects.
      setCurrentConfig(JSON.parse(JSON.stringify(site.config)));
      setHasChanges(false); // Reset unsaved changes flag when site data reloads or component mounts
    } else if (isStoreInitialized && !site) {
      // If store is initialized but site not found, setCurrentConfig to null
      // to trigger the "Site not found" message.
      setCurrentConfig(null); 
    }
    // Dependency array: re-run this effect if 'site' object changes or 'isStoreInitialized' changes.
  }, [site, isStoreInitialized]); 

  // Callback to handle changes from the SiteConfigForm component
  const handleConfigChange = useCallback((newConfig: SiteConfigFile) => {
    setCurrentConfig(newConfig);
    setHasChanges(true); // Mark that there are unsaved changes
  }, []); // No dependencies needed if it only sets local state

  // Callback to handle saving the configuration
  const handleSaveConfig = async () => {
    if (currentConfig && siteId) { // Ensure currentConfig and siteId are available
      if (!currentConfig.title || currentConfig.title.trim() === "") {
        toast.error("Site title cannot be empty.");
        return;
      }
      setIsLoading(true); // Set loading state
      try {
        // Call the store action to update the site configuration
        await updateSiteConfigAction(siteId, currentConfig);
        toast.success('Site configuration saved successfully!');
        setHasChanges(false); // Reset unsaved changes flag after successful save
      } catch (error) {
        console.error("Error saving site configuration:", error);
        toast.error("Failed to save configuration. Please try again.");
      } finally {
        setIsLoading(false); // Reset loading state
      }
    } else {
      toast.error("Cannot save: Configuration data is missing.");
    }
  };

  // Render loading state if the store is not yet initialized
  if (!isStoreInitialized) {
    return (
        <div className="p-6 flex justify-center items-center min-h-[calc(100vh-var(--header-height))]">
            <p>Loading site editor...</p> {/* Replace with a spinner */}
        </div>
    );
  }

  // Render "Site not found" if the store is initialized but the site doesn't exist
  // or if currentConfig couldn't be set (e.g., site was deleted).
  if (!site || !currentConfig) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">Site Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The site with ID "{siteId}" could not be found or is no longer available.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  // Render the main form if site and config are loaded
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <h1 className="text-2xl font-bold">Edit Site Configuration</h1>
        {/* You could add a "Last saved" timestamp here if desired */}
      </div>
      
      <SiteConfigForm 
        initialConfig={currentConfig} 
        onConfigChange={handleConfigChange} 
      />
      
      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSaveConfig} 
          disabled={isLoading || !hasChanges} 
          size="lg"
        >
          {isLoading ? 'Saving...' : 'Save Configuration'}
          {hasChanges && !isLoading && <span className="ml-2 text-xs opacity-70">*</span>}
        </Button>
      </div>
    </div>
  );
}