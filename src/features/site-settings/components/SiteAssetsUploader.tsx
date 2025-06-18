// src/features/site-settings/components/SiteAssetUploader.tsx
'use client';

import { useEffect, useState } from 'react';
import { ImageRef } from '@/types';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { Button } from '@/core/components/ui/button';
import { UploadCloud, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SiteAssetUploaderProps {
  siteId: string;
  label: string;
  value: ImageRef | undefined; // The current ImageRef from the manifest
  onChange: (newRef: ImageRef) => void;
  onRemove: () => void;
}

export default function SiteAssetUploader({ siteId, label, value, onChange, onRemove }: SiteAssetUploaderProps) {
  const site = useAppStore(state => state.getSiteById(siteId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Effect to generate a preview URL whenever the `value` prop changes
  useEffect(() => {
    let objectUrl: string | null = null;
    const generatePreview = async () => {
      if (value && site?.manifest) {
        try {
          const service = getActiveImageService(site.manifest);
             const url = await service.getDisplayUrl(site.manifest, value, { width: 128, height: 128, crop: 'fit' }, false);
          setPreviewUrl(url);
          objectUrl = url;
        } catch (error) {
          console.error(`Could not generate preview for ${label}:`, error);
          setPreviewUrl(null);
        }
      } else {
        setPreviewUrl(null);
      }
    };
    generatePreview();
    
    // Cleanup function to revoke blob URLs and prevent memory leaks
    return () => {
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [value, site, label]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !site?.manifest) return;
    
    setIsUploading(true);
    try {
      const service = getActiveImageService(site.manifest);
      const newRef = await service.upload(file, siteId);
      onChange(newRef); // Pass the new ImageRef up to the parent form state
      toast.success(`${label} uploaded successfully.`);
    } catch (error) {
      toast.error(`Failed to upload ${label}: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const inputId = `uploader-${label.toLowerCase().replace(' ', '-')}`;

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
        {previewUrl ? (
          <img src={previewUrl} alt={`${label} preview`} className="max-w-full max-h-full object-contain" />
        ) : (
          <UploadCloud className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-grow">
        <label htmlFor={inputId} className="font-medium text-sm">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <Button asChild size="sm" variant="outline" disabled={isUploading}>
            <label htmlFor={inputId}>
              {isUploading ? 'Uploading...' : (value ? 'Change...' : 'Upload...')}
            </label>
          </Button>
          <input type="file" id={inputId} className="hidden" onChange={handleFileSelect} accept="image/png, image/jpeg, image/svg+xml, image/x-icon" />

          {value && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
              <XCircle className="w-4 h-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}