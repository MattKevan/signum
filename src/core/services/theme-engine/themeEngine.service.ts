// src/core/services/theme-engine/themeEngine.service.ts
import Handlebars from 'handlebars';
import { 
    LocalSiteData, 
    PageResolutionResult, 
    PageType 
} from '@/types'; // FIX: Import all necessary types from the central types file.
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

/**
 * Discovers and registers all core Handlebars helpers.
 * @param {LocalSiteData} siteData - The full site data, passed to any helper that needs it.
 */
function registerCoreHelpers(siteData: LocalSiteData) {
    // A flag to prevent re-registering in the same session, improving performance.
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
 * Pre-compiles and caches all available layout and view templates by registering them as Handlebars partials.
 * This is crucial for performance and allows helpers to synchronously access templates during rendering.
 * @param {LocalSiteData} siteData - The complete site data.
 */
async function cacheAllTemplates(siteData: LocalSiteData) {
    // Clear old partials to ensure a clean state for each render.
    for (const partial in Handlebars.partials) {
        if (Object.prototype.hasOwnProperty.call(Handlebars.partials, partial)) {
            Handlebars.unregisterPartial(partial);
        }
    }

    const { manifest } = siteData;
    const allLayouts = await getAvailableLayouts(siteData); 
    const allViews = getAvailableViews(); // FIX: Call without arguments.

    const assetPromises: Promise<void>[] = [];

    // Pre-cache all layout templates
    for (const layoutManifest of allLayouts) {
        const promise = (async () => {
            if (layoutManifest?.files) {
                for (const file of layoutManifest.files) {
                    // FIX: Check against the correct, updated layout types.
                    if (['page', 'view', 'item'].includes(file.type)) {
                        const templateSource = await getAssetContent(siteData, 'layout', layoutManifest.name, file.path);
                        if (templateSource) {
                           // Use the layout's unique name as the partial key
                           Handlebars.registerPartial(layoutManifest.name, templateSource);
                        }
                    }
                }
            }
        })();
        assetPromises.push(promise);
    }
    
    // Pre-cache all view templates
    for (const viewInfo of allViews) {
         const promise = (async () => {
            const viewManifest = await getJsonAsset<ViewManifest>(siteData, 'view', viewInfo.id, 'view.json');
            if (viewManifest?.files) {
                const templateFile = viewManifest.files.find((f: AssetFile) => f.type === 'template');
                if (templateFile) {
                    const templateSource = await getAssetContent(siteData, 'view', viewInfo.id, templateFile.path);
                    if (templateSource) {
                        Handlebars.registerPartial(viewInfo.id, templateSource);
                    }
                }
            }
        })();
        assetPromises.push(promise);
    }

    // Pre-cache all partials from the main theme
    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', manifest.theme.name, 'theme.json');
    if (themeManifest?.files) {
        const themePartials = themeManifest.files.filter((file: AssetFile) => file.type === 'partial');
        for (const partial of themePartials) {
            if (partial.name) {
                const templateSource = await getAssetContent(siteData, 'theme', manifest.theme.name, partial.path);
                if (templateSource) Handlebars.registerPartial(partial.name, templateSource);
            }
        }
    }
    
    await Promise.all(assetPromises);
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
  // Type guard to handle the NotFound case safely.
  if (resolution.type === PageType.NotFound) {
      return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
  }

  // From here, TypeScript knows `resolution` is of type `SinglePage`.
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
  const layoutTemplate = Handlebars.partials[layoutPath];
  const bodyHtml = layoutTemplate ? layoutTemplate(resolution) : `Error: Layout template '${layoutPath}' not found.`;
  
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
      ...resolution // Pass the entire resolution object to the base template context
  });
}