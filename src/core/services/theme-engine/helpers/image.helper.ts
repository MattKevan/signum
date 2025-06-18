// src/core/services/theme-engine/helpers/image.helper.ts

import Handlebars from 'handlebars';
import { SignumHelper } from './types';
// --- FIX: Import ImageTransformOptions along with the other types ---
import { ImageRef, LocalSiteData, ImageTransformOptions } from '@/types';
import { getActiveImageService } from '@/core/services/images/images.service';

interface RootTemplateContext {
  options: {
    isExport: boolean;
  };
}

export const imageHelper: SignumHelper = (siteData: LocalSiteData) => ({
  image: async function(this: any, options: Handlebars.HelperOptions): Promise<Handlebars.SafeString> {
    const rootContext = options.data.root as RootTemplateContext;
    const isExport = rootContext.options?.isExport || false;

    const { src, width, height, crop, gravity, alt, lazy = true, class: className = '' } = options.hash;

    if (!src || typeof src !== 'object' || !('serviceId' in src)) {
      return new Handlebars.SafeString('<!-- Invalid ImageRef provided to image helper -->');
    }

    const imageRef = src as ImageRef;

    try {
      const imageService = getActiveImageService(siteData.manifest);
      
      const transformOptions: ImageTransformOptions = {
        width: width,
        height: height,
        crop: crop,
        gravity: gravity,
      };

      const displayUrl = await imageService.getDisplayUrl(siteData.manifest, imageRef, transformOptions, isExport);
      
      const lazyAttr = lazy ? 'loading="lazy"' : '';
      const altAttr = `alt="${alt || imageRef.alt || ''}"`;
      const classAttr = className ? `class="${className}"` : '';
      const widthAttr = width ? `width="${width}"` : '';
      const heightAttr = height ? `height="${height}"` : '';

      const imgTag = `<img src="${displayUrl}" ${widthAttr} ${heightAttr} ${altAttr} ${classAttr} ${lazyAttr}>`;

      return new Handlebars.SafeString(imgTag);
    } catch (error) {
      console.error(`[ImageHelper] Failed to render image for src: ${imageRef.src}`, error);
      return new Handlebars.SafeString(`<!-- Image render failed: ${(error as Error).message} -->`);
    }
  }
});