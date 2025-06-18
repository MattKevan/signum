// src/core/services/images/cloudinaryImage.service.ts

import { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/types';
import { useAppStore } from '@/core/state/useAppStore';
import { Cloudinary } from "@cloudinary/url-gen";
import { fill, fit, scale } from "@cloudinary/url-gen/actions/resize";
import { Gravity } from "@cloudinary/url-gen/qualifiers/gravity";
import { format, quality } from "@cloudinary/url-gen/actions/delivery";

/**
 * A type declaration for the Cloudinary Upload Widget.
 * In a real application, you would import this from its own package.
 */
declare const cloudinary: {
  createUploadWidget: (
    options: any,
    callback: (error: any, result: any) => void
  ) => {
    open: () => void;
    close: () => void;
  };
};

class CloudinaryImageService implements ImageService {
  id = 'cloudinary';
  name = 'Upload to Cloudinary';

  async upload(file: File, siteId: string): Promise<ImageRef> {
    const site = useAppStore.getState().getSiteById(siteId);
    if (!site) {
      throw new Error(`Site with ID "${siteId}" not found in state.`);
    }

    const cloudName = site.manifest?.settings?.cloudinary?.cloudName;
    const uploadPreset = site.secrets?.cloudinary?.uploadPreset;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary Cloud Name and Upload Preset must be configured in your site's image settings.");
    }

    return new Promise((resolve, reject) => {
      const widget = cloudinary.createUploadWidget(
        {
          cloudName: cloudName,
          uploadPreset: uploadPreset,
          sources: ['local', 'url', 'camera'],
          multiple: false,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary Upload Error:', error);
            widget.close();
            return reject(new Error('Image upload failed. Please try again.'));
          }

          if (result && result.event === 'success') {
            const { public_id, version, format, width, height } = result.info;
            // The 'src' we store is just the public ID with folder structure.
            // The version is handled by the SDK.
            const srcPath = public_id;
            
            widget.close();
            resolve({
              serviceId: 'cloudinary',
              src: srcPath,
              alt: result.info.original_filename || 'Uploaded image',
              width,
              height,
            });
          }
        }
      );
      widget.open();
    });
  }

  async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string> {
    const cloudName = manifest.settings?.cloudinary?.cloudName;
    if (!cloudName) { /* error handling */ }
    
    const cld = new Cloudinary({ cloud: { cloudName: cloudName } });
    const cldImage = cld.image(ref.src);

    const { width, height, crop = 'scale', gravity } = options;

    switch (crop) {
        case 'fill':
            const fillResize = fill(width, height);
            
            // --- FIX: Map our simple gravity terms to the correct SDK methods ---
            if (gravity === 'auto') {
                fillResize.gravity(Gravity.autoGravity());
            } else if (gravity && ['north', 'south', 'east', 'west'].includes(gravity)) {
                // For cardinal directions, use compass
                fillResize.gravity(Gravity.compass(gravity));
            } else if (gravity === 'center') {
                // For center, use the correctly named xyCenter
                fillResize.gravity(Gravity.xyCenter());
            }
            // If no gravity is specified, Cloudinary defaults to center, which is fine.

            cldImage.resize(fillResize);
            break;
        case 'fit':
            cldImage.resize(fit(width, height));
            break;
        case 'scale':
        default:
            cldImage.resize(scale(width, height));
            break;
    }


    // Use the correct delivery and quality actions
    cldImage.delivery(format('auto')).delivery(quality('auto'));
    
    return cldImage.toURL();
  }

  async getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]> {
    return Promise.resolve([]);
  }
}

export const cloudinaryImageService = new CloudinaryImageService();