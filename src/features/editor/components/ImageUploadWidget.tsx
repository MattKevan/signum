'use client';

import { useState } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { ImageRef } from '@/types';
import { Button } from '@/core/components/ui/button';

interface ImageUploadWidgetProps {
  siteId: string;
  value: string; // The current src value from frontmatter
  onImageSelect: (imageRef: ImageRef) => void;
}

export default function ImageUploadWidget({ siteId, value, onImageSelect }: ImageUploadWidgetProps) {
  const site = useAppStore(state => state.getSiteById(siteId));
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadClick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !site) return;
    const file = event.target.files[0];
    
    setIsLoading(true);
    try {
      const imageService = getActiveImageService(site.manifest);
      const imageRef = await imageService.upload(file, siteId);
      onImageSelect(imageRef); // Pass the full reference back to the parent form
    } catch (error) {
      console.error("Image upload failed:", error);
      // Show a toast message to the user
    } finally {
      setIsLoading(false);
    }
  };

  const imageService = site ? getActiveImageService(site.manifest) : null;
  // This logic would need to be expanded for the Cloudinary widget,
  // which brings its own button/UI.
  
  return (
    <div>
      {value && <img src={value} alt="Current image" className="w-full h-auto rounded-md mb-2" />}
      <input
        type="file"
        id="image-upload"
        className="hidden"
        onChange={handleUploadClick}
        accept="image/*"
      />
      <Button asChild>
        <label htmlFor="image-upload">{value ? 'Change Image' : 'Upload Image'}</label>
      </Button>
      {isLoading && <p>Uploading...</p>}
    </div>
  );
}