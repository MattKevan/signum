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
// Import the new centralized service function for theme synchronization.
import { synchronizeThemeDefaults } from '@/core/services/theme.service';

/**
 * This service is the core rendering engine for Signum. It orchestrates the entire
 * process of converting raw site data (Markdown, manifest) into a final, viewable HTML page.
 * It is designed to be "dumb" about theme-specific logic, following these steps:
 *
 * 1.  **Defensively Synchronizes Manifest:** It first ensures the manifest's theme config
 *     is complete by calling the `synchronizeThemeDefaults` service. This protects
 *     against old or corrupted data.
 * 2.  Registers all necessary helper functions (e.g., `{{formatDate}}`, `{{{image}}}`).
 * 3.  Caches all available theme partials and layout templates for performance.
 * 4.  Resolves all dynamic/asynchronous data for a page (nav links, image URLs, etc.).
 * 5.  Generates an inline `<style>` block by directly converting user-defined settings
 *     from the manifest into CSS variables.
 * 6.  Renders the main content layout and then injects it into the theme's base HTML shell.
 */

// --- Type Definitions ---
export interface RenderOptions {
  siteRootPath: string;
  isExport: boolean;
  relativeAssetPath?: string;
}

// --- Helper Registration ---
function registerCoreHelpers(siteData: LocalSiteData) {
    // A simple flag to prevent re-registering helpers on every render.
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
    // Clear all existing partials to ensure a clean state for the current render.
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
 * Generates an inline <style> block from the user's saved theme configuration.
 * It directly converts snake_case keys from the manifest (e.g., "font_headings")
 * into --kebab-case CSS variables (e.g., "--font-headings") and uses the
 * exact value provided by the user's selection.
 * @param themeConfig The user's saved theme settings from manifest.theme.config.
 * @returns A string containing a complete <style> tag, or an empty string if no config is present.
 */
function generateStyleOverrides(themeConfig: ThemeConfig['config']): string {
  // Guard against empty or missing config
  if (!themeConfig || Object.keys(themeConfig).length === 0) {
    return '';
  }

  // Directly convert keys and use values. No special mapping logic needed.
  const variables = Object.entries(themeConfig)
    .map(([key, value]) => {
      // Ensure the value is not null/undefined before creating a CSS rule
      if (value) {
        const cssVariable = `--${key.replace(/_/g, '-')}`;
        return `  ${cssVariable}: ${value};`;
      }
      return null;
    })
    .filter(Boolean) // Remove any null entries from the array
    .join('\n');

  // If there are no valid variables after filtering, return an empty string.
  if (!variables) {
    return '';
  }

  // Return the complete, formatted <style> block, ready for injection into the HTML head.
  return `
<style id="signum-style-overrides">
:root {
${variables}
}
</style>
  `.trim();
}


/**
 * Renders a resolved page into a full HTML string based on the active theme and assets.
 */
export async function render(siteData: LocalSiteData, resolution: PageResolutionResult, options: RenderOptions): Promise<string> {
    if (resolution.type === PageType.NotFound) {
      // Return a basic error message for 404 pages.
      return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
    }

    // --- DEFENSIVE GUARD ---
    // Synchronize the manifest's theme config before rendering.
    // This ensures that even if the saved manifest has an empty or outdated
    // config, it will be populated with the correct defaults before being used.
    // This makes the rendering process resilient to old or corrupted data.
    const synchronizedTheme = await synchronizeThemeDefaults(siteData.manifest);
    // Create a new `manifest` variable for this render cycle that is guaranteed to be correct.
    const manifest = { ...siteData.manifest, theme: synchronizedTheme };
    // We also update the siteData object to pass the corrected manifest to helpers.
    const synchronizedSiteData = { ...siteData, manifest };
    // --- END GUARD ---
    
    registerCoreHelpers(synchronizedSiteData);
    await cacheAllTemplates(synchronizedSiteData);

    const themePath = manifest.theme.name;
    const pageLayoutPath = resolution.layoutPath;

    // --- STEP 1: Render the main body content first ---
    const pageLayoutSource = Handlebars.partials[pageLayoutPath];
    if (!pageLayoutSource) {
        return `Error: Page layout template "${pageLayoutPath}" not found.`;
    }
    const pageLayoutTemplate = Handlebars.compile(pageLayoutSource);
    
    const bodyHtml = await pageLayoutTemplate({
      ...resolution,
      options: options
    });

    // --- STEP 2: Resolve ALL top-level asynchronous and dynamic data ---
    const currentPageExportPath = getUrlForNode(resolution.contentFile, manifest, true);
    const navLinks = generateNavLinks(synchronizedSiteData, currentPageExportPath, options);
    const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
    const canonicalUrl = new URL(currentPageExportPath, siteBaseUrl).href;
    const baseUrl = options.isExport ? (options.relativeAssetPath ?? '') : (typeof window !== 'undefined' ? window.location.origin : '');

    let logoUrl: string | undefined = undefined;
    if (manifest.logo) {
      try {
          const service = getActiveImageService(manifest);
          logoUrl = await service.getDisplayUrl(manifest, manifest.logo, { height: 32 }, options.isExport);
      } catch (e) { console.warn("Could not generate logo URL:", e); }
    }
  
    let faviconUrl: string | undefined = undefined;
    if (manifest.favicon) {
        try {
            const service = getActiveImageService(manifest);
            faviconUrl = await service.getDisplayUrl(manifest, manifest.favicon, { width: 32, height: 32 }, options.isExport);
        } catch (e) { console.warn("Could not generate favicon URL:", e); }
    }

    const styleOverrides = generateStyleOverrides(manifest.theme.config);

    // --- STEP 3: Render the final document with all data now resolved ---
    const themeManifest = await getJsonAsset<ThemeManifest>(synchronizedSiteData, 'theme', themePath, 'theme.json');
    if (!themeManifest) return 'Error: Could not load theme manifest.';
    const baseTemplateFile = themeManifest.files.find((f: AssetFile) => f.type === 'base');
    if (!baseTemplateFile) return 'Error: Theme manifest is missing a file with type "base".';
  
    const baseTemplateSource = await getAssetContent(synchronizedSiteData, 'theme', themePath, baseTemplateFile.path);
    if (!baseTemplateSource) return 'Error: Could not load base template source.';
    const baseTemplate = Handlebars.compile(baseTemplateSource);

    const finalContext = {
      manifest,
      navLinks,
      year: new Date().getFullYear(),
      headContext: {
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
      options: options,
      ...resolution,
  };

  const finalHtml = baseTemplate(finalContext);

  return finalHtml;
}