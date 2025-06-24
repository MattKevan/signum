// src/core/services/themes/themeEngine.service.ts

import Handlebars from 'handlebars';
import {
    LocalSiteData,
    PageResolutionResult,
    PageType,
    ImageRef,
    ParsedMarkdownFile,
    Manifest
} from '@/core/types';
import {
    getJsonAsset,
    getLayoutManifest,
    LayoutManifest,
    ThemeManifest,
    AssetFile,
    getAssetContent,
    getAvailableLayouts,
} from '@/core/services/configHelpers.service';
import { coreHelpers } from './helpers';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { generateNavLinks } from '@/core/services/navigationStructure.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/themes/theme.service';
import { ImageService } from '@/core/types';

/**
 * Defines the options passed throughout the rendering process.
 */
export interface RenderOptions {
  siteRootPath: string;
  isExport: boolean;
  relativeAssetPath?: string;
}

/**
 * Registers all core Handlebars helpers.
 * This function is idempotent and will only register helpers once per session.
 * @param {LocalSiteData} siteData - The complete site data, passed to helper factories.
 */
function registerCoreHelpers(siteData: LocalSiteData) {
    if ((Handlebars as any)._helpersRegistered) return;
    for (const helperFactory of coreHelpers) {
        const helperMap = helperFactory(siteData);
        for (const helperName in helperMap) {
            Handlebars.registerHelper(helperName, helperMap[helperName]);
        }
    }
    (Handlebars as any)._helpersRegistered = true;
}

/**
 * Pre-compiles and caches all available layout and theme partials in Handlebars.
 * This is critical for performance and allows helpers to synchronously access template source code.
 * @param {LocalSiteData} siteData - The complete site data.
 */
async function cacheAllTemplates(siteData: LocalSiteData) {
    for (const partial in Handlebars.partials) {
        if (Object.prototype.hasOwnProperty.call(Handlebars.partials, partial)) {
            Handlebars.unregisterPartial(partial);
        }
    }
    const { manifest } = siteData;
    const allLayouts = await getAvailableLayouts(siteData);
    
    // Cache layout templates (e.g., the main template for 'blog', 'page')
    const layoutPromises = allLayouts.map(async (layoutManifest: LayoutManifest) => {
        if (!layoutManifest?.files) return;
        // Cache all files declared in the layout manifest, including main templates and partials
        for (const file of layoutManifest.files) {
            const templateSource = await getAssetContent(siteData, 'layout', layoutManifest.id, file.path);
            if(templateSource) {
                // Register partials with a namespaced name, e.g., 'blog/partials/card'
                const partialName = file.name || `${layoutManifest.id}/${file.path.replace('.hbs', '')}`;
                Handlebars.registerPartial(partialName, templateSource);
            }
        }
    });

    // Cache theme partials (e.g., 'header', 'footer')
    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', manifest.theme.name, 'theme.json');
    const themePartialPromises = (themeManifest?.files || [])
        .filter((file: AssetFile) => file.type === 'partial' && file.name)
        .map(async (partial) => {
            const templateSource = await getAssetContent(siteData, 'theme', manifest.theme.name, partial.path);
            if (templateSource) {
                Handlebars.registerPartial(partial.name!, templateSource);
            }
        });

    await Promise.all([...layoutPromises, ...themePartialPromises]);
}

/**
 * Generates an inline <style> block from the theme configuration.
 * @param {Record<string, any>} themeConfig - The theme configuration object.
 * @returns {string} A string containing a complete <style> tag.
 */
function generateStyleOverrides(themeConfig: Record<string, any>): string {
    if (!themeConfig || Object.keys(themeConfig).length === 0) return '';
    const variables = Object.entries(themeConfig)
      .map(([key, value]) => {
        if (value) {
          const cssVariable = `--${key.replace(/_/g, '-')}`;
          return `  ${cssVariable}: ${value};`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');
    if (!variables) return '';
    return `<style id="signum-style-overrides">\n:root {\n${variables}\n}\n</style>`;
}

/**
 * A helper function that takes a layout's image presets and a content file,
 * then asynchronously resolves all the URLs for the defined image sizes.
 * @param context - An object containing all necessary data for resolution.
 * @returns A promise that resolves to a record mapping preset names to their resolved image data.
 */
async function resolveImagePresets(context: {
    manifest: Manifest;
    imageService: ImageService;
    layoutManifest: LayoutManifest | null;
    contentFile: ParsedMarkdownFile;
    isExport: boolean;
}): Promise<Record<string, { url: string; width?: number; height?: number }>> {
    const { manifest, imageService, layoutManifest, contentFile, isExport } = context;
    const presets = layoutManifest?.image_presets || {};
    const resolvedImages: Record<string, { url: string; width?: number; height?: number }> = {};

    for (const presetName in presets) {
        const preset = presets[presetName];
        const sourceImageRef = contentFile.frontmatter[preset.source] as ImageRef | undefined;

        if (sourceImageRef && sourceImageRef.serviceId && sourceImageRef.src) {
            try {
                const url = await imageService.getDisplayUrl(manifest, sourceImageRef, {
                    width: preset.width,
                    height: preset.height,
                    crop: preset.crop,
                    gravity: preset.gravity,
                }, isExport);
                
                resolvedImages[presetName] = { url, width: preset.width, height: preset.height };
            } catch (e) {
                console.warn(`Could not generate URL for image preset "${presetName}":`, e);
            }
        }
    }
    return resolvedImages;
}

/**
 * Renders a resolved page into a full HTML string based on the active theme and assets.
 * This function orchestrates the entire process by pre-resolving all asynchronous data
 * before passing a final, simple context to the synchronous Handlebars templates.
 */
export async function render(
  siteData: LocalSiteData, 
  resolution: PageResolutionResult, 
  options: RenderOptions
): Promise<string> {
    if (resolution.type === PageType.NotFound) {
      return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
    }

    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name, 
        siteData.manifest.theme.config
    );    
    const synchronizedManifest = { 
        ...siteData.manifest, 
        theme: { ...siteData.manifest.theme, config: finalMergedConfig }
    };
    const synchronizedSiteData = { ...siteData, manifest: synchronizedManifest };

    registerCoreHelpers(synchronizedSiteData);
    await cacheAllTemplates(synchronizedSiteData);

    const { manifest } = synchronizedSiteData;
    const imageService = getActiveImageService(manifest);
    
    // --- STEP 1: LOAD LAYOUT MANIFESTS ---
    const pageLayoutManifest = await getLayoutManifest(synchronizedSiteData, resolution.layoutPath);
    
    // --- STEP 2: PRE-RESOLVE DATA & ENRICH CONTEXT ---
    
    // Resolve images for the main page using its layout's presets
    const pageImages = await resolveImagePresets({
        manifest, imageService, layoutManifest: pageLayoutManifest,
        contentFile: resolution.contentFile, isExport: options.isExport
    });

    // Enrich each collection item with its own resolved image URLs
    let processedCollectionItems: (ParsedMarkdownFile & { images?: typeof pageImages })[] = [];
    if (resolution.collectionItems) {
        for (const item of resolution.collectionItems) {
            // Here, we assume the item's appearance is also governed by the parent collection's layout manifest.
            const itemImages = await resolveImagePresets({
                manifest, imageService, layoutManifest: pageLayoutManifest,
                contentFile: item, isExport: options.isExport
            });
            processedCollectionItems.push({ ...item, images: itemImages });
        }
    }
    
    // --- STEP 3: COMPILE AND RENDER THE BODY TEMPLATE ---
    
    // Determine which template to use based on the user's choice in frontmatter
    const collectionOptions = resolution.contentFile.frontmatter.collection || {};
    const listingChoiceKey = (collectionOptions as any).listing || pageLayoutManifest?.display_options?.listing.default;
    const bodyTemplatePath = listingChoiceKey
        ? pageLayoutManifest?.display_options?.listing.options[listingChoiceKey]?.template
        : 'index.hbs'; // Fallback to a default name

    if (!bodyTemplatePath) return `Error: No valid template found for listing style choice "${listingChoiceKey}".`;

    const pageLayoutSource = await getAssetContent(synchronizedSiteData, 'layout', resolution.layoutPath, bodyTemplatePath);
    if (!pageLayoutSource) return `Error: Page layout template "${bodyTemplatePath}" not found in layout "${resolution.layoutPath}".`;
    
    const pageLayoutTemplate = Handlebars.compile(pageLayoutSource);

    // Assemble the context for the body, now with all data pre-resolved
    const pageContext = {
        ...resolution,
        options,
        images: pageImages,
        collectionItems: processedCollectionItems,
        layoutManifest: pageLayoutManifest,
    };
    
    const bodyHtml = pageLayoutTemplate(pageContext);

    // --- STEP 4: PREPARE FINAL CONTEXT FOR THE BASE PAGE SHELL ---
    const logoUrl = manifest.logo ? await imageService.getDisplayUrl(manifest, manifest.logo, { height: 32 }, options.isExport) : undefined;
    const faviconUrl = manifest.favicon ? await imageService.getDisplayUrl(manifest, manifest.favicon, { width: 32, height: 32 }, options.isExport) : undefined;
    // For Open Graph, use a specific preset or fall back to another, like a thumbnail preset.
    const openGraphImageUrl = pageImages.og_image?.url || pageImages.post_thumbnail?.url || pageImages.featured?.url;
    
    const navLinks = generateNavLinks(synchronizedSiteData, getUrlForNode(resolution.contentFile, manifest, true), options);
    const canonicalUrl = new URL(getUrlForNode(resolution.contentFile, manifest, true), manifest.baseUrl || 'https://example.com').href;
    const styleOverrides = generateStyleOverrides(manifest.theme.config);

    const baseTemplateSource = await getAssetContent(synchronizedSiteData, 'theme', manifest.theme.name, 'base.hbs');
    if (!baseTemplateSource) return 'Error: Could not load base template source.';
    const baseTemplate = Handlebars.compile(baseTemplateSource);

    const finalContext = {
      manifest,
      navLinks,
      logoUrl,
      options,
      body: new Handlebars.SafeString(bodyHtml),
      headContext: {
          pageTitle: resolution.pageTitle,
          manifest,
          contentFile: resolution.contentFile,
          canonicalUrl,
          baseUrl: options.relativeAssetPath ?? '/',
          styleOverrides: new Handlebars.SafeString(styleOverrides),
          faviconUrl,
          openGraphImageUrl,
      },
    };

    return baseTemplate(finalContext);
}