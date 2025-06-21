// src/core/services/images/localImage.service.ts
import { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { slugify } from '@/lib/utils';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from './derivativeCache.service';
import imageCompression from 'browser-image-compression';

const sourceImageCache = new Map<string, Blob>();
const processingPromises = new Map<string, Promise<Blob>>();

/**
 * A strongly-typed interface for the options passed to the browser-image-compression library.
 * This eliminates the need for `any` and improves type safety.
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
    const { width, height, crop = 'scale', gravity = 'center' } = options;
    const extIndex = ref.src.lastIndexOf('.');
    if (extIndex === -1) throw new Error("Source image has no extension.");
    
    const pathWithoutExt = ref.src.substring(0, extIndex);
    const ext = ref.src.substring(extIndex);
    const derivativePath = `${pathWithoutExt}_w${width || 'auto'}_h${height || 'auto'}_c-${crop}_g-${gravity}${ext}`;

    const finalBlob = await this.getOrProcessDerivative(manifest.siteId, ref.src, derivativePath, options);
    
    return isExport ? derivativePath : URL.createObjectURL(finalBlob);
  }

  /**
   * The core processing pipeline. It checks all caches and processes the image
   * only if absolutely necessary, preventing race conditions.
   */
  private async getOrProcessDerivative(siteId: string, srcPath: string, cacheKey: string, options: ImageTransformOptions): Promise<Blob> {
    const cachedBlob = await getCachedDerivative(cacheKey);
    if (cachedBlob) return cachedBlob;

    if (processingPromises.has(cacheKey)) return processingPromises.get(cacheKey)!;
    
    const processingPromise = (async (): Promise<Blob> => {
      try {
        const sourceBlob = await this.getSourceBlob(siteId, srcPath);

        // --- FIX: Using the strongly-typed `CompressionOptions` interface instead of `any`. ---
        const compressionOptions: CompressionOptions = {
            maxSizeMB: 1.5,
            initialQuality: 0.8,
            useWebWorker: true,
            exifOrientation: -1, // Use -1 to respect the original orientation
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

  public async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]> {
    const exportableMap = new Map<string, Blob>();
    
    for (const ref of allImageRefs) {
      if (ref.serviceId === 'local' && !exportableMap.has(ref.src)) {
        const sourceBlob = await localSiteFs.getImageAsset(siteId, ref.src);
        if (sourceBlob) {
          exportableMap.set(ref.src, sourceBlob);
        }
      }
    }
    
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