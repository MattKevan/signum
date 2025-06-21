// src/app/sites/[siteId]/settings/image/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Manifest } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { toast } from "sonner";
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { SiteSecrets } from '@/core/services/siteSecrets.service';

type ImageServiceId = 'local' | 'cloudinary';

export default function ImageSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  // Get the site object and the actions from the Zustand store.
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);
  const updateSiteSecretsAction = useAppStore(state => state.updateSiteSecrets);

  // State for public settings (from manifest)
  const [selectedService, setSelectedService] = useState<ImageServiceId>('local');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');

  // State for private settings (from secrets store)
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // This effect runs when the component mounts or the site data in the store changes.
  // It populates the form's local state with the authoritative data from the store.
  useEffect(() => {
    if (site?.manifest) {
      setIsLoading(true);

      // Load public settings from the site's manifest
      const { imageService, cloudinary } = site.manifest.settings || {};
      setSelectedService(imageService || 'local');
      setCloudinaryCloudName(cloudinary?.cloudName || '');
      
      // Load private settings from the site's secrets object
      setCloudinaryUploadPreset(site.secrets?.cloudinary?.uploadPreset || '');
      
      setHasChanges(false);
      setIsLoading(false);
    }
  }, [site]); // Re-run this effect if the `site` object in the store is updated
  
  const handleServiceChange = (value: string) => {
    // The value from the Select is a string, which we cast to our specific type.
    setSelectedService(value as ImageServiceId);
    setHasChanges(true);
  };
  
  // This generic handler can still be used for simple text inputs.
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!site?.manifest) {
        toast.error("Site data not available. Cannot save settings.");
        return;
    }
    
    setIsLoading(true);

    // 1. Prepare the new public manifest data
    const newManifest: Manifest = {
      ...site.manifest,
      settings: {
        ...site.manifest.settings,
        imageService: selectedService,
        cloudinary: {
            cloudName: cloudinaryCloudName.trim(),
        },
      },
    };

    // 2. Prepare the new private secrets data
    const newSecrets: SiteSecrets = {
        cloudinary: {
            uploadPreset: cloudinaryUploadPreset.trim(),
        }
    };

    try {
      // 3. Call the store actions to save both data structures.
      // These actions will persist the data and update the global state.
      await updateManifestAction(siteId, newManifest);
      await updateSiteSecretsAction(siteId, newSecrets);
      
      setHasChanges(false);
      // The toast messages are now handled inside the store actions for consistency.
    } catch(error) {
      // The actions will throw on failure, allowing us to catch here if needed.
      console.error("An error occurred during save:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !site) {
    return <div className="p-6">Loading settings...</div>;
  }
  
  return (
    <div className="space-y-6 max-w-2xl p-6">
      <div>
        <h1 className="text-2xl font-bold">Image Settings</h1>
        <p className="text-muted-foreground">Configure how images are stored and processed for your site.</p>
      </div>

      <div className="border-t pt-6 space-y-6">
        <div className="space-y-2">
            <Label htmlFor="service-select">Image Storage Backend</Label>
            <Select value={selectedService} onValueChange={handleServiceChange}>
                <SelectTrigger id="service-select" className="mt-1">
                    <SelectValue placeholder="Select a service..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="local">Store in Site Bundle (Default)</SelectItem>
                    <SelectItem value="cloudinary">Upload to Cloudinary</SelectItem>
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">&quot;Local&quot; is best for portability. &quot;Cloudinary&quot; is best for performance.</p>
        </div>
        
        {selectedService === 'cloudinary' && (
            <div className="p-4 border rounded-lg bg-card space-y-4">
                <h3 className="font-semibold text-card-foreground">Cloudinary Settings</h3>
                 <div className="space-y-2">
                    <Label htmlFor="cloud-name">Cloudinary Cloud Name (Public)</Label>
                    <Input
                        id="cloud-name"
                        value={cloudinaryCloudName}
                        onChange={(e) => handleInputChange(setCloudinaryCloudName, e.target.value)}
                        placeholder="e.g., your-cloud-name"
                    />
                     <p className="text-xs text-muted-foreground">This is public and stored in your site&apos;s manifest.</p>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="upload-preset">Cloudinary Upload Preset (Secret)</Label>
                        <Input
                        id="upload-preset"
                        type="password"
                        value={cloudinaryUploadPreset}
                        onChange={(e) => handleInputChange(setCloudinaryUploadPreset, e.target.value)}
                        placeholder="e.g., ml_default"
                    />
                     <p className="text-xs text-muted-foreground">This is a secret and is stored securely in your browser, not in your public site files.</p>
                </div>
            </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
          {isLoading ? 'Saving...' : 'Save Image Settings'}
        </Button>
      </div>
    </div>
  );
}