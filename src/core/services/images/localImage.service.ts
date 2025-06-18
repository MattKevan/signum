// src/core/services/images/localImage.service.ts

import { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { slugify } from '@/lib/utils';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from './derivativeCache.service';
import imageCompression from 'browser-image-compression';

const sourceImageCache = new Map<string, Blob>();
const processingPromises = new Map<string, Promise<Blob>>();

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

  /**
   * Main method to get a displayable URL for an image.
   * This has been refactored into a single, unified pipeline to prevent deadlocks.
   */
  async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string> {
    const { width, height, crop = 'scale', gravity = 'center' } = options;
    const extIndex = ref.src.lastIndexOf('.');
    if (extIndex === -1) throw new Error("Source image has no extension.");
    
    const pathWithoutExt = ref.src.substring(0, extIndex);
    const ext = ref.src.substring(extIndex);
    const derivativePath = `${pathWithoutExt}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;

    // The core logic is now in a separate, private method.
    const finalBlob = await this.getOrProcessDerivative(manifest.siteId, ref.src, derivativePath, options);
    
    // After getting the blob, simply decide what to return based on the context.
    return isExport ? derivativePath : URL.createObjectURL(finalBlob);
  }

  /**
   * The core processing pipeline. It checks all caches and processes the image
   * only if absolutely necessary, preventing race conditions.
   */
  private async getOrProcessDerivative(siteId: string, srcPath: string, cacheKey: string, options: ImageTransformOptions): Promise<Blob> {
    // 1. Check persistent cache for a completed job.
    const cachedBlob = await getCachedDerivative(cacheKey);
    if (cachedBlob) {
      return cachedBlob;
    }

    // 2. Check in-memory cache for an in-progress job.
    if (processingPromises.has(cacheKey)) {
      return processingPromises.get(cacheKey)!;
    }
    
    // 3. If no cache hit, create and store a new processing promise.
    const processingPromise = (async (): Promise<Blob> => {
      try {
        const sourceBlob = await this.getSourceBlob(siteId, srcPath);

        const compressionOptions: any = {
            maxSizeMB: 1.5,
            initialQuality: 0.8,
            useWebWorker: true,
            exifOrientation: -1,
        };
        const { width, height, crop } = options;
        if (crop === 'fill' && width && height) {
          compressionOptions.maxWidth = width;
          compressionOptions.maxHeight = height;
        } else {
          compressionOptions.maxWidthOrHeight = Math.max(width || 0, height || 0) || undefined;
        }

        console.log(`[ImageService] Processing new derivative: ${cacheKey}`);
        const derivativeBlob = await imageCompression(sourceBlob as File, compressionOptions);
        
        await setCachedDerivative(cacheKey, derivativeBlob);
        
        return derivativeBlob;
      } finally {
        processingPromises.delete(cacheKey);
      }
    })();

    processingPromises.set(cacheKey, processingPromise);
    return processingPromise;
  }

  private async getSourceBlob(siteId: string, srcPath: string): Promise<Blob> {
    let sourceBlob = sourceImageCache.get(srcPath);
    if (!sourceBlob) {
        const blobData = await localSiteFs.getImageAsset(siteId, srcPath);
        if (!blobData) throw new Error(`Source image not found in local storage: ${srcPath}`);
        sourceBlob = blobData;
        sourceImageCache.set(srcPath, sourceBlob);
    }
    return sourceBlob;
  }

  async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]> {
    const exportableMap = new Map<string, Blob>();
    
    // Add all original source images
    for (const ref of allImageRefs) {
      if (ref.serviceId === 'local' && !exportableMap.has(ref.src)) {
        const sourceBlob = await localSiteFs.getImageAsset(siteId, ref.src);
        if (sourceBlob) {
          exportableMap.set(ref.src, sourceBlob);
        }
      }
    }
    
    // Add all derivatives from the persistent cache
    const derivativeKeys = await getAllCacheKeys();
    for (const key of derivativeKeys) {
      if (!exportableMap.has(key)) {
        const derivativeBlob = await getCachedDerivative(key);
        if (derivativeBlob) {
          exportableMap.set(key, derivativeBlob);
        }
      }
    }
    
    return Array.from(exportableMap.entries()).map(([path, data]) => ({ path, data }));
  }
}

export const localImageService = new LocalImageService();