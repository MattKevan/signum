// src/app/(publishing)/edit/[siteId]/config/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import SiteConfigForm from '@/components/publishing/SiteConfigForm';
import { Button } from '@/components/ui/button';
import { Manifest } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { toast } from "sonner";
import Link from 'next/link';

export default function EditSiteConfigPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);
  const isStoreInitialized = useAppStore(state => state.isInitialized);

  const [currentManifest, setCurrentManifest] = useState<Manifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (site?.manifest) {
      setCurrentManifest(JSON.parse(JSON.stringify(site.manifest)));
      setHasChanges(false);
    } else if (isStoreInitialized && !site) {
      setCurrentManifest(null); 
    }
  }, [site, isStoreInitialized]);

  const handleManifestChange = useCallback((newManifest: Manifest) => {
    setCurrentManifest(newManifest);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (currentManifest && siteId) {
      if (!currentManifest.title || currentManifest.title.trim() === "") {
        toast.error("Site title cannot be empty.");
        return;
      }
      setIsLoading(true);
      try {
        await updateManifestAction(siteId, currentManifest);
        toast.success('Site configuration saved successfully!');
        setHasChanges(false);
      } catch (error) {
        console.error("Error saving site configuration:", error);
        toast.error("Failed to save configuration. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isStoreInitialized || (site && !currentManifest)) {
    return <div className="p-6">Loading site editor...</div>;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Site Configuration</h1>
      <SiteConfigForm 
        initialManifest={currentManifest!} 
        onManifestChange={handleManifestChange} 
      />
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}