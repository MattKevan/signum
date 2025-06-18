// src/core/services/images/localImage.service.ts

import { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { slugify } from '@/lib/utils';
import { getCachedDerivative, setCachedDerivative } from './derivativeCache.service';
// --- FIX: Import the image compression library ---
import imageCompression, { Options } from 'browser-image-compression';

const sourceImageCache = new Map<string, Blob>();
const derivativeCache = new Map<string, Blob>();

const getImageDimensions = (blob: Blob): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = (err) => {
      reject(err);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
};

class LocalImageService implements ImageService {
  id = 'local';
  name = 'Store in Site Bundle';

  async upload(file: File, siteId: string): Promise<ImageRef> {
    const extIndex = file.name.lastIndexOf('.');
    if (extIndex === -1) {
      throw new Error("Uploaded file is missing an extension.");
    }
    const baseName = file.name.substring(0, extIndex);
    const extension = file.name.substring(extIndex);
    const slugifiedBaseName = slugify(baseName);
    const fileName = `${Date.now()}-${slugifiedBaseName}${extension}`;
    const relativePath = `assets/images/${fileName}`;

    await localSiteFs.saveImageAsset(siteId, relativePath, file as Blob);
    const { width, height } = await getImageDimensions(file as Blob);

    return {
      serviceId: 'local',
      src: relativePath,
      alt: file.name,
      width,
      height,
    };
  }

  async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string> {
    const { width, height, crop = 'scale', gravity = 'center' } = options;
    const extIndex = ref.src.lastIndexOf('.');
    if (extIndex === -1) throw new Error("Source image has no extension.");
    
    const pathWithoutExt = ref.src.substring(0, extIndex);
    const ext = ref.src.substring(extIndex);
    const derivativePath = `${pathWithoutExt}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;
    const cacheKey = derivativePath;

    // Check persistent cache first
    const cachedBlob = await getCachedDerivative(cacheKey);
    if (cachedBlob) {
      // If we are exporting, we still need to add this blob to the in-memory export cache
      if (isExport) derivativeCache.set(cacheKey, cachedBlob);
      return isExport ? derivativePath : URL.createObjectURL(cachedBlob);
    }
    
    // If not cached, get the source and process it
    const sourceBlob = await this.getSourceBlob(manifest.siteId, ref.src);

    // --- FIX: Replace manual worker/canvas logic with the library ---
    const compressionOptions: any = {
        maxSizeMB: 1.5,
        initialQuality: 0.8,
        useWebWorker: true,
        exifOrientation: -1,
    };
    
    if (crop === 'fill' && width && height) {
      compressionOptions.maxWidth = width;
      compressionOptions.maxHeight = height;
      // Note: 'gravity' is not supported by this library, it will center-crop.
    } else { // Handles 'fit' and 'scale'
      compressionOptions.maxWidthOrHeight = Math.max(width || 0, height || 0) || undefined;
    }
    
    console.log(`[ImageService] Generating derivative: ${cacheKey}`);
    const derivativeBlob = await imageCompression(sourceBlob as File, compressionOptions);
    // --- END OF REPLACEMENT ---

    // Cache the newly generated derivative persistently and in-memory
    await setCachedDerivative(cacheKey, derivativeBlob);
    derivativeCache.set(cacheKey, derivativeBlob);
    
    return isExport ? derivativePath : URL.createObjectURL(derivativeBlob);
  }

  private async getSourceBlob(siteId: string, srcPath: string): Promise<Blob> {
    let sourceBlob = sourceImageCache.get(srcPath);
    if (!sourceBlob) {
        const blobData = await localSiteFs.getImageAsset(siteId, srcPath);
        if (!blobData) {
            throw new Error(`Source image not found in local storage: ${srcPath}`);
        }
        sourceBlob = blobData;
        sourceImageCache.set(srcPath, sourceBlob);
    }
    return sourceBlob;
  }

  async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]> {
    const exportableMap = new Map<string, Blob>();
    
    // 1. Add all original source images
    for (const ref of allImageRefs) {
      if (ref.serviceId === 'local' && !exportableMap.has(ref.src)) {
        const sourceBlob = await localSiteFs.getImageAsset(siteId, ref.src);
        if (sourceBlob) exportableMap.set(ref.src, sourceBlob);
      }
    }
    
    // 2. Add all generated derivatives from the in-memory cache
    for (const [path, data] of derivativeCache.entries()) {
        exportableMap.set(path, data);
    }
    
    // Clear the in-memory cache after export to free up memory
    derivativeCache.clear();

    return Array.from(exportableMap.entries()).map(([path, data]) => ({ path, data }));
  }
}

export const localImageService = new LocalImageService();