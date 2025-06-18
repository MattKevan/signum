// src/core/services/images/images.service.ts

// <-- FIX: Import all necessary types from the central types file.
import { ImageService, Manifest } from '@/types';

import { localImageService } from './localImage.service';
import { cloudinaryImageService } from './cloudinaryImage.service';

const services: Record<string, ImageService> = {
  local: localImageService,
  cloudinary: cloudinaryImageService,
};

export function getActiveImageService(manifest: Manifest): ImageService {
  // This now correctly type-checks against the updated Manifest interface.
  const serviceId = manifest.settings?.imageService || 'local';
  return services[serviceId] || localImageService;
}