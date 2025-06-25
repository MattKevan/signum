// src/features/site-settings/components/SiteAssetsUploader.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ImageRef } from '@/core/types';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { Button } from '@/core/components/ui/button';
import { UploadCloud, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MEMORY_CONFIG } from '@/config/editorConfig';

/**
 * Defines the props for the SiteAssetUploader component.
 */
interface SiteAssetUploaderProps {
  /** The ID of the current site, needed for the upload service. */
  siteId: string;
  /** A descriptive label for the uploader (e.g., "Site Logo", "Favicon"). */
  label: string;
  /** The current ImageRef object if an image is already set, otherwise undefined. */
  value: ImageRef | undefined;
  /** Callback function triggered when a new image is successfully uploaded. */
  onChange: (newRef: ImageRef) => void;
  /** Callback function triggered when the "Remove" button is clicked. */
  onRemove: () => void;
}

/**
 * A reusable UI component for uploading site-level assets like logos and favicons.
 * It provides a preview, handles the upload flow, and performs client-side validation
 * for file type and size to give the user immediate feedback.
 */
export default function SiteAssetUploader({ siteId, label, value, onChange, onRemove }: SiteAssetUploaderProps) {
  const site = useAppStore(state => state.getSiteById(siteId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Generates a temporary preview URL for the currently selected image.
   * This effect runs whenever the `value` (the ImageRef) or the `site` data changes.
   * It correctly handles revoking blob URLs to prevent memory leaks.
   */
  useEffect(() => {
    let objectUrl: string | null = null;
    const generatePreview = async () => {
      if (value && site?.manifest) {
        try {
          const service = getActiveImageService(site.manifest);
          // Request a small, fitted derivative for the preview.
          const url = await service.getDisplayUrl(site.manifest, value, { width: 128, height: 128, crop: 'fit' }, false);
          setPreviewUrl(url);
          // Keep track of blob URLs so they can be revoked on cleanup.
          if (url.startsWith('blob:')) {
            objectUrl = url;
          }
        } catch (error) {
          console.error(`Could not generate preview for ${label}:`, error);
          setPreviewUrl(null);
        }
      } else {
        setPreviewUrl(null);
      }
    };
    generatePreview();
    
    // Cleanup function to revoke the object URL and prevent memory leaks.
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [value, site, label]);

  /**
   * Handles the file selection event from the input.
   * It performs client-side validation before calling the upload service.
   * @param {React.ChangeEvent<HTMLInputElement>} event The file input change event.
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !site?.manifest) return;

    // --- Client-Side Validation Block ---
    const isSvg = file.type === 'image/svg+xml';
    
    // 1. Validate file type against the configuration.
    if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
      toast.error(`Unsupported file type. Please use one of: ${MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(', ')}`);
      event.target.value = ''; // Reset file input to allow re-selection of the same file.
      return;
    }

    // 2. Validate file size against the appropriate limit.
    const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
      const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
      const unit = isSvg ? 'KB' : 'MB';
      toast.error(`Image is too large. Max size is ${maxSizeFormatted}${unit}.`);
      event.target.value = '';
      return;
    }
    // --- End Validation Block ---
    
    setIsUploading(true);
    try {
      const service = getActiveImageService(site.manifest);
      const newRef = await service.upload(file, siteId);
      onChange(newRef);
      toast.success(`${label} uploaded successfully.`);
    } catch (error) {
      // The service layer will also throw an error, which is caught here.
      // The toast messages from the service are sufficient, so we just log here.
      console.error(`Upload failed for ${label}:`, error);
    } finally {
      setIsUploading(false);
      // Always reset the input value to allow re-uploading the same file if needed.
      event.target.value = '';
    }
  };

  const inputId = `uploader-${label.toLowerCase().replace(/\s/g, '-')}`;

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 relative">
        {previewUrl ? (
          <Image src={previewUrl} alt={`${label} preview`} fill className="object-contain" />
        ) : (
          <UploadCloud className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-grow">
        <label htmlFor={inputId} className="font-medium text-sm">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <Button asChild size="sm" variant="outline" disabled={isUploading}>
            {/* The label is associated with the input, making the button clickable for upload */}
            <label htmlFor={inputId} className="cursor-pointer">
              {isUploading ? 'Uploading...' : (value ? 'Change...' : 'Upload...')}
            </label>
          </Button>
          <input 
            type="file" 
            id={inputId} 
            className="hidden" 
            onChange={handleFileSelect} 
            // Use the config to filter the file picker dialog.
            accept={MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(',')} 
          />
          {value && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove}>
              <XCircle className="w-4 h-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}