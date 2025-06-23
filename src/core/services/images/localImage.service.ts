// src/core/services/images/localImage.service.ts

import { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { slugify } from '@/core/libraries/utils';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from './derivativeCache.service';
import imageCompression from 'browser-image-compression';

/**
 * This service manages images stored locally within the browser's IndexedDB.
 * It handles uploading, generating transformed "derivatives" (e.g., thumbnails),
 * caching those derivatives for performance, and bundling all necessary assets for a static site export.
 */

// In-memory caches to reduce redundant processing and DB reads within a session.
const sourceImageCache = new Map<string, Blob>();
const processingPromises = new Map<string, Promise<Blob>>();

/**
 * A strongly-typed interface for the options passed to the browser-image-compression library.
 * This improves type safety and code clarity.
 */
interface CompressionOptions {
  maxSizeMB: number;
  initialQuality: number;
  useWebWorker: boolean;
  exifOrientation: number;
  maxWidthOrHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * A utility function to get the dimensions of an image from its Blob data.
 * @param blob The image Blob.
 * @returns A promise that resolves to the image's width and height.
 */
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

/**
 * Implements the ImageService interface for handling images stored locally
 * within the site's data in the browser (IndexedDB).
 */
class LocalImageService implements ImageService {
  id = 'local';
  name = 'Store in Site Bundle';

  public async upload(file: File, siteId: string): Promise<ImageRef> {
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

    // For SVGs, width/height can be 0, which is acceptable.
    const { width, height } = await getImageDimensions(file as Blob);

    return {
      serviceId: 'local',
      src: relativePath,
      alt: file.name,
      width,
      height,
    };
  }

  public async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string> {

    // Check if the image is an SVG. If so, bypass all derivative processing.
    const isSvg = ref.src.toLowerCase().endsWith('.svg');
    if (isSvg) {
      if (isExport) {
        // For static exports, simply return the original, relative path.
        return ref.src;
      }
      // For live preview display, get the original SVG blob and create a temporary object URL.
      const sourceBlob = await this.getSourceBlob(manifest.siteId, ref.src);
      return URL.createObjectURL(sourceBlob);
    }
    // --- END SVG FIX ---

    const { width, height, crop = 'scale', gravity = 'center' } = options;
    const extIndex = ref.src.lastIndexOf('.');
    if (extIndex === -1) throw new Error("Source image has no extension.");
    
    const pathWithoutExt = ref.src.substring(0, extIndex);
    const ext = ref.src.substring(extIndex);

    // This is the public-facing filename for the generated derivative.
    const derivativeFileName = `${pathWithoutExt}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;

    // --- FIX #1: SCOPED CACHE KEY ---
    // The key used for the IndexedDB cache is now namespaced with the siteId.
    const cacheKey = `${manifest.siteId}/${derivativeFileName}`;

    const finalBlob = await this.getOrProcessDerivative(manifest.siteId, ref.src, cacheKey, options);
    
    // For export, return the relative filename. For display, create a temporary URL.
    return isExport ? derivativeFileName : URL.createObjectURL(finalBlob);
  }

  /**
   * Core processing pipeline. It checks caches and processes the image
   * only if necessary, preventing race conditions and improving quality.
   */
  private async getOrProcessDerivative(siteId: string, srcPath: string, cacheKey: string, options: ImageTransformOptions): Promise<Blob> {
    const cachedBlob = await getCachedDerivative(cacheKey);
    if (cachedBlob) return cachedBlob;

    if (processingPromises.has(cacheKey)) return processingPromises.get(cacheKey)!;
    
    const processingPromise = (async (): Promise<Blob> => {
      try {
        const sourceBlob = await this.getSourceBlob(siteId, srcPath);
        
        // Get original dimensions to prevent upscaling.
        const sourceDimensions = await getImageDimensions(sourceBlob);

        const compressionOptions: CompressionOptions = {
            maxSizeMB: 1.5,
            initialQuality: 0.85, // Increased from 0.8 for better quality.
            useWebWorker: true,
            exifOrientation: -1,
        };

        const { width, height, crop } = options;

        // Cap requested dimensions at the source's dimensions to prevent upscaling and pixelation.
        const targetWidth = width ? Math.min(width, sourceDimensions.width) : undefined;
        const targetHeight = height ? Math.min(height, sourceDimensions.height) : undefined;

        if (crop === 'fill' && targetWidth && targetHeight) {
          compressionOptions.maxWidth = targetWidth;
          compressionOptions.maxHeight = targetHeight;
        } else {
          const maxDim = Math.max(targetWidth || 0, targetHeight || 0);
          // Only set maxWidthOrHeight if a dimension was actually requested.
          if (maxDim > 0) {
            compressionOptions.maxWidthOrHeight = maxDim;
          }
        }
        // --- END IMAGE QUALITY FIX ---

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

  public async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]> {
    const exportableMap = new Map<string, Blob>();
    
    // 1. Add all original source images for this site to the export map.
    for (const ref of allImageRefs) {
      if (ref.serviceId === 'local' && !exportableMap.has(ref.src)) {
        const sourceBlob = await localSiteFs.getImageAsset(siteId, ref.src);
        if (sourceBlob) {
          exportableMap.set(ref.src, sourceBlob);
        }
      }
    }
    
    // 2. Get derivative keys ONLY for the current siteId.
    const derivativeKeys = await getAllCacheKeys(siteId);

    // 3. Add all of this site's derivatives to the export map.
    for (const key of derivativeKeys) {
      // The key is in the format "siteId/path/to/image.jpg"
      // The filename for the ZIP archive should only be "path/to/image.jpg"
      const filename = key.substring(siteId.length + 1);

      if (!exportableMap.has(filename)) {
        const derivativeBlob = await getCachedDerivative(key);
        if (derivativeBlob) {
          exportableMap.set(filename, derivativeBlob);
        }
      }
    }
    // --- END SCOPED EXPORT FIX ---
    
    return Array.from(exportableMap.entries()).map(([path, data]) => ({ path, data }));
  }
}

export const localImageService = new LocalImageService();