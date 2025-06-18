// src/core/services/theme-engine/themeEngine.service.ts
import Handlebars from 'handlebars';
import {
    LocalSiteData,
    PageResolutionResult,
    PageType,
    ImageRef,
} from '@/types';
import {
    getJsonAsset,
    getAvailableLayouts,
    ThemeManifest,
    AssetFile,
    getAssetContent,
} from '@/core/services/configHelpers.service';
import { coreHelpers } from './helpers';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { generateNavLinks } from '@/core/services/navigationStructure.service';
import { getActiveImageService } from '@/core/services/images/images.service';


// --- Type Definitions ---
export interface RenderOptions {
  siteRootPath: string;
  isExport: boolean;
  relativeAssetPath?: string;
}

// --- Helper Registration ---
function registerCoreHelpers(siteData: LocalSiteData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((Handlebars as any)._helpersRegistered) return;

    for (const helperFactory of coreHelpers) {
        const helperMap = helperFactory(siteData);
        for (const helperName in helperMap) {
            Handlebars.registerHelper(helperName, helperMap[helperName]);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Handlebars as any)._helpersRegistered = true;
}

/**
 * Pre-compiles and caches all available layout templates and theme partials.
 * This is crucial for performance and allows helpers to synchronously access templates during rendering.
 * @param {LocalSiteData} siteData - The complete site data.
 */
async function cacheAllTemplates(siteData: LocalSiteData) {
    // Clear all existing partials to ensure a clean state
    for (const partial in Handlebars.partials) {
        if (Object.prototype.hasOwnProperty.call(Handlebars.partials, partial)) {
            Handlebars.unregisterPartial(partial);
        }
    }

    const { manifest } = siteData;

    // 1. Get ALL layouts of ALL types (page, list, item).
    const allLayouts = await getAvailableLayouts(siteData);

    // 2. Loop through every layout and register its main template as a partial using its ID.
    const layoutPromises = allLayouts.map(async (layoutManifest) => {
        if (!layoutManifest?.files) return;

        const templateFile = layoutManifest.files.find((f: AssetFile) => f.type === 'template');
        if (templateFile) {
            const templateSource = await getAssetContent(siteData, 'layout', layoutManifest.id, templateFile.path);
            if (templateSource) {
                // Register the partial using the layout's ID (e.g., 'page', 'listing', 'teaser').
                Handlebars.registerPartial(layoutManifest.id, templateSource);
            }
        }
    });

    // 3. Register the theme's global partials (header, footer, head).
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
 * Renders a resolved page into a full HTML string based on the active theme and assets.
 */
export async function render(siteData: LocalSiteData, resolution: PageResolutionResult, options: RenderOptions): Promise<string> {
    if (resolution.type === PageType.NotFound) {
      // You can create a simple 404 template or just return a basic error message.
      return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
  }
  registerCoreHelpers(siteData);
  await cacheAllTemplates(siteData);

  if (!siteData.contentFiles) { /* error handling */ }

  const { manifest } = siteData;
  const themePath = manifest.theme.name;
  const pageLayoutPath = resolution.layoutPath;

  // --- STEP 1: Render the main body content first ---
  // The body render might call the async `{{{image}}}` helper, so we must await it.
  const pageLayoutSource = Handlebars.partials[pageLayoutPath];
  if (!pageLayoutSource) { /* error handling */ }
  const pageLayoutTemplate = Handlebars.compile(pageLayoutSource);
  
  // This render pass populates the image derivative cache.
  const bodyHtml = await pageLayoutTemplate({
    ...resolution,
    options: options // Pass options down for the image helper
  });


  // --- STEP 2: Resolve ALL top-level asynchronous data ---
  const currentPageExportPath = getUrlForNode(resolution.contentFile, true);
  const navLinks = generateNavLinks(siteData, currentPageExportPath, options);
  const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
  const canonicalUrl = new URL(currentPageExportPath, siteBaseUrl).href;
  const baseUrl = options.isExport ? (options.relativeAssetPath ?? '') : (typeof window !== 'undefined' ? window.location.origin : '');

  // Resolve logo and favicon URLs, passing the isExport flag.
  let logoUrl: string | undefined = undefined;
  if (siteData.manifest.logo) {
      try {
          const service = getActiveImageService(siteData.manifest);
          logoUrl = await service.getDisplayUrl(siteData.manifest, siteData.manifest.logo, { height: 32 }, options.isExport);
      } catch (e) { console.warn("Could not generate logo URL:", e); }
  }
  
  let faviconUrl: string | undefined = undefined;
  if (siteData.manifest.favicon) {
      try {
          const service = getActiveImageService(siteData.manifest);
          faviconUrl = await service.getDisplayUrl(siteData.manifest, siteData.manifest.favicon, { width: 32, height: 32 }, options.isExport);
      } catch (e) { console.warn("Could not generate favicon URL:", e); }
  }

  let styleOverrides = '';
  if (manifest.theme.config && Object.keys(manifest.theme.config).length > 0) { /* style logic */ }


  // --- STEP 3: Render the final document with all data now resolved ---
   const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themePath, 'theme.json');
  if (!themeManifest) return 'Error: Could not load theme manifest.';
   const baseTemplateFile = themeManifest.files.find((f: AssetFile) => f.type === 'base');
  if (!baseTemplateFile) return 'Error: Theme manifest is missing a file with type "base".';
  
  const baseTemplateSource = await getAssetContent(siteData, 'theme', themePath, baseTemplateFile.path);
  if (!baseTemplateSource) return 'Error: Could not load base template source.';
  const baseTemplate = Handlebars.compile(baseTemplateSource);

  const finalContext = {
      manifest,
      navLinks,
      year: new Date().getFullYear(),
      headContext: {
          // All these accesses are now safe.
          pageTitle: resolution.pageTitle,
          manifest: manifest,
          contentFile: resolution.contentFile,
          canonicalUrl: canonicalUrl,
          baseUrl: baseUrl,
          styleOverrides: new Handlebars.SafeString(styleOverrides),
          faviconUrl: faviconUrl,
      },
      body: new Handlebars.SafeString(bodyHtml),
      logoUrl: logoUrl,
      options: options, // For any helpers still needing it
      ...resolution,
  };

  // This final render is now synchronous because all async data has been prepared.
  const finalHtml = baseTemplate(finalContext);

  return finalHtml;
}