// src/features/editor/components/ImageUploadWidget.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image'; // FIX: Import the optimized Image component
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { ImageRef } from '@/core/types';
import { Button } from '@/core/components/ui/button';

interface ImageUploadWidgetProps {
  siteId: string;
  value: string;
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
      onImageSelect(imageRef);
    } catch (error) {
      console.error("Image upload failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {value && <Image src={value} alt="Current image" width={200} height={150} className="w-full h-auto rounded-md mb-2 object-cover" />}
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