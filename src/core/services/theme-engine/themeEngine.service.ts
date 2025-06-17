// src/core/services/theme-engine/themeEngine.service.ts
import Handlebars from 'handlebars';
import { 
    LocalSiteData, 
    PageResolutionResult, 
    PageType 
} from '@/types';
import {
    getJsonAsset,
    getAvailableLayouts,
    getAvailableViews,
    ThemeManifest, 
    ViewManifest,
    getAssetContent,
    AssetFile,
} from '@/core/services/configHelpers.service';
import { coreHelpers } from './helpers';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { generateNavLinks } from '@/core/services/navigationStructure.service';

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

    // 1. Get ALL layouts of ALL types (page, view, item). This is our single source of truth.
    const allLayouts = await getAvailableLayouts(siteData);

    // 2. Loop through every layout and register its main template as a partial using its ID.
    const layoutPromises = allLayouts.map(async (layoutManifest) => {
        if (!layoutManifest?.files) return;

        // Find the main template file for this layout (the one with type: 'template').
        const templateFile = layoutManifest.files.find((f: AssetFile) => f.type === 'template');
        if (templateFile) {
            // Use the layout's unique ID to fetch its content.
            const templateSource = await getAssetContent(siteData, 'layout', layoutManifest.id, templateFile.path);
            if (templateSource) {
                // Register the partial using the layout's ID. This is the critical step.
                // e.g., Handlebars.registerPartial('page', ...), Handlebars.registerPartial('listing', ...)
                Handlebars.registerPartial(layoutManifest.id, templateSource);
            }
        }
    });

    // 3. Register the theme's global partials (header, footer, head, etc.).
    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', manifest.theme.name, 'theme.json');
    const themePartialPromises = (themeManifest?.files || [])
        .filter((file: AssetFile) => file.type === 'partial' && file.name)
        .map(async (partial) => {
            const templateSource = await getAssetContent(siteData, 'theme', manifest.theme.name, partial.path);
            if (templateSource) {
                Handlebars.registerPartial(partial.name!, templateSource);
            }
        });

    // 4. Wait for all templates and partials to be cached before proceeding.
    await Promise.all([...layoutPromises, ...themePartialPromises]);
}


/**
 * Renders a resolved page into a full HTML string based on the active theme and assets.
 */
export async function render(siteData: LocalSiteData, resolution: PageResolutionResult, options: RenderOptions): Promise<string> {
  // 1. Setup, Helper Registration, and Template Caching
  registerCoreHelpers(siteData);
  await cacheAllTemplates(siteData);

  if (!siteData.contentFiles) {
    return 'Error: Site content has not been loaded. Cannot render page.';
  }
  if (resolution.type === PageType.NotFound) {
      return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
  }

  const { manifest } = siteData;
  const themePath = manifest.theme.name;
  const layoutPath = resolution.layoutPath;

  // 2. Prepare Data for Rendering
  const currentPageExportPath = getUrlForNode({ ...resolution.contentFile, type: 'page' }, true);
  const navLinks = generateNavLinks(siteData, currentPageExportPath, options);
  const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
  const canonicalUrl = new URL(currentPageExportPath, siteBaseUrl).href;
  const baseUrl = options.isExport ? (options.relativeAssetPath ?? '') : (typeof window !== 'undefined' ? window.location.origin : '');

  let styleOverrides = '';
  if (manifest.theme.config && Object.keys(manifest.theme.config).length > 0) {
      const cssVars = Object.entries(manifest.theme.config).map(([k, v]) => `--${k.replace(/_/g, '-')}: ${v};`).join(' ');
      if (cssVars) {
          styleOverrides = `<style id="signum-theme-overrides">:root { ${cssVars} }</style>`;
      }
  }

  // 3. Render Main Content Body
 const layoutTemplateSource = Handlebars.partials[layoutPath]; // Get the raw template STRING

  if (!layoutTemplateSource) {
      // Provide a more descriptive error if the template isn't found
      return `<h1>Rendering Error</h1><p>The layout template with ID '<strong>${layoutPath}</strong>' could not be found in the cache. Please check that the layout exists and its manifest is correct.</p>`;
  }

  // --- THIS IS THE FIX ---
  // Compile the template source into a usable function before executing it.
  const layoutTemplate = Handlebars.compile(layoutTemplateSource);
  const bodyHtml = layoutTemplate(resolution);
  // --- END OF FIX ---
  
  // 4. Render Final Document
  const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themePath, 'theme.json');
  const baseTemplatePath = themeManifest?.files.find((f: AssetFile) => f.type === 'base')?.path;
  if (!baseTemplatePath) return 'Error: Active theme is missing a template with type "base".';
  
  const baseTemplateSource = await getAssetContent(siteData, 'theme', themePath, baseTemplatePath);
  if (!baseTemplateSource) return `Error: Could not load base template source at '${baseTemplatePath}'.`;
  const baseTemplate = Handlebars.compile(baseTemplateSource);

  const headContext = {
      pageTitle: resolution.pageTitle,
      manifest: manifest,
      canonicalUrl: canonicalUrl,
      baseUrl: baseUrl,
      styleOverrides: new Handlebars.SafeString(styleOverrides)
  };

  return baseTemplate({
      manifest,
      navLinks,
      year: new Date().getFullYear(),
      headContext: headContext,
      body: new Handlebars.SafeString(bodyHtml),
      ...resolution
  });
}