// src/core/services/theme-engine/themeEngine.service.ts

import Handlebars from 'handlebars';
import {
    LocalSiteData,
    PageResolutionResult,
    PageType,
    ThemeConfig,
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
import { getMergedThemeDataForForm } from '@/core/services/theme.service';

/**
 * The core rendering engine for Signum. It orchestrates the entire
 * process of converting raw site data into a final, viewable HTML page.
 * It is designed to be resilient and always work with the most current data.
 *
 * --- Core Rendering Pipeline ---
 *
 * 1.  **"Sync on Load":** Before any rendering occurs, it calls `syncAndHydrateTheme`.
 *     This non-destructively merges the user's saved settings with the very latest
 *     version of the theme's schema and defaults. This ensures that if a theme author
 *     adds a new setting, it becomes available immediately without data loss.
 *
 * 2.  **Helper & Template Caching:** It registers all necessary Handlebars helpers
 *     (e.g., `{{formatDate}}`, `{{{image}}}`) and pre-compiles all available theme
 *     partials and layout templates for high-performance rendering.
 *
 * 3.  **Data Resolution:** It resolves all dynamic data needed for the page, such
 *     as navigation links and image URLs, using the synchronized manifest.
 *
 * 4.  **Style Generation:** It generates a dynamic, inline `<style>` block by
 *     converting the synchronized theme configuration into CSS variables.
 *
 * 5.  **Final Render:** It renders the main content layout and then injects that
 *     HTML into the theme's base shell (`base.hbs`) to produce the final,
 *     complete HTML document.
 */

// --- Type Definitions ---
export interface RenderOptions {
  siteRootPath: string;
  isExport: boolean;
  relativeAssetPath?: string;
}

// --- Helper Functions ---

/**
 * Registers all core Handlebars helpers. Uses a simple flag on the Handlebars
 * object to ensure this only happens once per application lifecycle.
 * @param {LocalSiteData} siteData - The complete site data, passed to helper factories.
 */
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
 * Pre-compiles and caches all available layout and theme partials in Handlebars.
 * This is crucial for performance and enables synchronous access to templates
 * during rendering (e.g., via the `render_layout_for_item` helper).
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

    const layoutPromises = allLayouts.map(async (layoutManifest) => {
        if (!layoutManifest?.files) return;
        const templateFile = layoutManifest.files.find((f: AssetFile) => f.type === 'template');
        if (templateFile) {
            const templateSource = await getAssetContent(siteData, 'layout', layoutManifest.id, templateFile.path);
            if (templateSource) {
                Handlebars.registerPartial(layoutManifest.id, templateSource);
            }
        }
    });

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
 * Generates an inline <style> block from the site's theme configuration.
 * It directly converts snake_case keys from the config (e.g., "color_primary")
 * into --kebab-case CSS variables (e.g., "--color-primary") for the browser.
 * @param {ThemeConfig['config']} themeConfig - The complete theme configuration object.
 * @returns {string} A string containing a complete <style> tag.
 */
function generateStyleOverrides(themeConfig: ThemeConfig['config']): string {
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
 * Renders a resolved page into a full HTML string based on the active theme and assets.
 * @param {LocalSiteData} siteData - The original site data from the store.
 * @param {PageResolutionResult} resolution - The resolved content for the current page.
 * @param {RenderOptions} options - Rendering options (e.g., for export or live preview).
 * @returns {Promise<string>} A promise that resolves to the final HTML string.
 */
export async function render(
  siteData: LocalSiteData, 
  resolution: PageResolutionResult, 
  options: RenderOptions
): Promise<string> {
    if (resolution.type === PageType.NotFound) {
      return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
    }

    // --- STEP 1: "Merge on Render" ---
    const savedThemeConfig = siteData.manifest.theme;
    
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        savedThemeConfig.name, 
        savedThemeConfig.config
    );    

    
    // Create a temporary, fully up-to-date manifest and siteData for this render cycle.
     const synchronizedManifest = { 
        ...siteData.manifest, 
        theme: { ...savedThemeConfig, config: finalMergedConfig }
    };
    const synchronizedSiteData = { ...siteData, manifest: synchronizedManifest };
    // ---

    // Register helpers and cache templates using the synchronized data.
    registerCoreHelpers(synchronizedSiteData);
    await cacheAllTemplates(synchronizedSiteData);

    const themePath = synchronizedManifest.theme.name;
    const pageLayoutPath = resolution.layoutPath;

    // --- STEP 2: Render the main body content ---
    const pageLayoutSource = Handlebars.partials[pageLayoutPath];
    if (!pageLayoutSource) {
        return `Error: Page layout template "${pageLayoutPath}" not found.`;
    }
    const pageLayoutTemplate = Handlebars.compile(pageLayoutSource);
    const bodyHtml = await pageLayoutTemplate({ ...resolution, options });

    // --- STEP 3: Resolve all top-level dynamic data ---
    const currentPageExportPath = getUrlForNode(resolution.contentFile, synchronizedManifest, true);
    const navLinks = generateNavLinks(synchronizedSiteData, currentPageExportPath, options);
    const siteBaseUrl = synchronizedManifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
    const canonicalUrl = new URL(currentPageExportPath, siteBaseUrl).href;
    const baseUrl = options.isExport ? (options.relativeAssetPath ?? '') : (typeof window !== 'undefined' ? window.location.origin : '');

    const imageService = getActiveImageService(synchronizedManifest);
    let logoUrl: string | undefined;
    if (synchronizedManifest.logo) {
      try {
          logoUrl = await imageService.getDisplayUrl(synchronizedManifest, synchronizedManifest.logo, { height: 32 }, options.isExport);
      } catch (e) { console.warn("Could not generate logo URL:", e); }
    }
  
    let faviconUrl: string | undefined;
    if (synchronizedManifest.favicon) {
        try {
            faviconUrl = await imageService.getDisplayUrl(synchronizedManifest, synchronizedManifest.favicon, { width: 32, height: 32 }, options.isExport);
        } catch (e) { console.warn("Could not generate favicon URL:", e); }
    }

    // Generate style overrides from the final merged config.
    const styleOverrides = generateStyleOverrides(synchronizedManifest.theme.config);

    // --- STEP 4: Render the final document in the base theme shell ---
    const themeManifest = await getJsonAsset<ThemeManifest>(synchronizedSiteData, 'theme', themePath, 'theme.json');
    if (!themeManifest) return 'Error: Could not load theme manifest.';
    const baseTemplateFile = themeManifest.files.find((f: AssetFile) => f.type === 'base');
    if (!baseTemplateFile) return 'Error: Theme manifest is missing a file with type "base".';
  
    const baseTemplateSource = await getAssetContent(synchronizedSiteData, 'theme', themePath, baseTemplateFile.path);
    if (!baseTemplateSource) return 'Error: Could not load base template source.';
    const baseTemplate = Handlebars.compile(baseTemplateSource);

    const finalContext = {
      manifest: synchronizedManifest,
      navLinks,
      year: new Date().getFullYear(),
      headContext: {
          pageTitle: resolution.pageTitle,
          manifest: synchronizedManifest,
          contentFile: resolution.contentFile,
          canonicalUrl: canonicalUrl,
          baseUrl: baseUrl,
          styleOverrides: new Handlebars.SafeString(styleOverrides),
          faviconUrl: faviconUrl,
      },
      body: new Handlebars.SafeString(bodyHtml),
      logoUrl: logoUrl,
      options: options,
      ...resolution,
    };

    return baseTemplate(finalContext);
}