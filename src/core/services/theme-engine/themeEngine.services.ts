// src/lib/themeEngine.ts
import Handlebars from 'handlebars';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { PageResolutionResult, PageType } from '../pageResolver.service';
import { 
    LocalSiteData, 
    ParsedMarkdownFile, 
    ThemeInfo, 
    LayoutInfo 
} from '@/types';
import { generateNavLinks } from '../../../lib/navigationUtils';
import { getJsonAsset, getLayoutManifest, ThemeManifest, LayoutManifest, AssetFile, AssetFileType } from '../../../lib/configHelpers';
import { CORE_THEMES, CORE_LAYOUTS } from '@/config/editorConfig';
import { getUrlForNode } from '../../../lib/urlUtils';
import { getRelativePath } from '../../../lib/pathUtils';

// --- Type Definitions ---

/**
 * @interface RenderOptions
 * @description Defines the configuration for a single render operation.
 */
export interface RenderOptions {
  /** The base path for generated links in live preview mode (e.g., /sites/abc/view). */
  siteRootPath: string;
  /** Determines if paths should be relative (for export) or absolute-style (for live preview). */
  isExport: boolean;
  /** For exports, the relative path to the asset root (e.g., '../' or './'). */
  relativeAssetPath?: string;
}

// --- Caching and Core Helpers ---

const fileContentCache = new Map<string, Promise<string | null>>();
let helpersRegistered = false;

const isCoreTheme = (path: string): boolean => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string): boolean => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);

/**
 * Fetches the raw string content of a theme or layout asset.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @param {'theme' | 'layout'} assetType - The type of asset to fetch.
 * @param {string} path - The path/ID of the theme or layout (e.g., 'default').
 * @param {string} fileName - The name of the file to fetch (e.g., 'base.hbs').
 * @returns {Promise<string | null>} The raw file content or null if not found.
 */
async function getAssetContent(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      if (fileContentCache.has(sourcePath)) return fileContentCache.get(sourcePath)!;
      const promise = fetch(sourcePath)
        .then(res => (res.ok ? res.text() : null))
        .catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      const fileStore = assetType === 'theme' ? siteData.themeFiles : siteData.layoutFiles;
      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

/**
 * Fetches and compiles a Handlebars template from an asset file.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @param {'theme' | 'layout'} assetType - The type of asset to fetch.
 * @param {string} path - The path/ID of the theme or layout.
 * @param {string} fileName - The name of the Handlebars template file.
 * @returns {Promise<Handlebars.TemplateDelegate | null>} The compiled template or null on failure.
 */
async function getTemplateAsset(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<Handlebars.TemplateDelegate | null> {
    const source = await getAssetContent(siteData, assetType, path, fileName);
    if (!source) return null;
    try { 
        return Handlebars.compile(source); 
    } catch(e) { 
        console.error(`Failed to compile Handlebars template ${assetType}/${path}/${fileName}:`, e); 
        return null; 
    }
}

/**
 * Registers all partials declared in a theme or layout manifest by reading the 'files' array.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @param {ThemeManifest | LayoutManifest | null} manifest - The manifest object containing the files array.
 * @param {'theme' | 'layout'} assetType - The type of asset the partials belong to.
 * @param {string} assetPath - The path/ID of the theme or layout.
 */
async function registerPartialsFromManifest(siteData: LocalSiteData, manifest: ThemeManifest | LayoutManifest | null, assetType: 'theme' | 'layout', assetPath: string) {
    if (!manifest || !manifest.files) return;
    const partials = manifest.files.filter(file => file.type === 'partial');

    for (const partial of partials) {
        if (partial.name) {
            const templateSource = await getAssetContent(siteData, assetType, assetPath, partial.path);
            if (templateSource) {
                Handlebars.registerPartial(partial.name, templateSource);
            }
        }
    }
}

/**
 * Registers global Handlebars helpers. Ensures helpers are only registered once.
 */
function registerHelpers() {
    if (helpersRegistered) return;
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('formatDate', (date) => (date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''));
    Handlebars.registerHelper('markdown', (md) => {
        if (!md) return '';
        const unsafeHtml = marked.parse(md, { async: false }) as string;
        const safeHtml = DOMPurify.sanitize(unsafeHtml);
        return new Handlebars.SafeString(safeHtml);
    });
    helpersRegistered = true;
}


/**
 * Renders a resolved page or collection into a full HTML string based on the active theme and layout.
 * This is the main public function of the theme engine. It handles both live previews and static exports.
 *
 * @param {LocalSiteData} siteData - The complete data for the site to be rendered.
 * @param {PageResolutionResult} resolution - The resolved content (page or collection) to render.
 * @param {RenderOptions} options - Configuration for the render, specifying context (preview vs. export).
 * @returns {Promise<string>} A promise that resolves to the final, complete HTML document string.
 */
export async function render(siteData: LocalSiteData, resolution: PageResolutionResult, options: RenderOptions): Promise<string> {
  // 1. Setup & Validation
  registerHelpers();
  fileContentCache.clear();
  Object.keys(Handlebars.partials).forEach(name => Handlebars.unregisterPartial(name));

  if (!siteData.contentFiles) {
    return 'Error: Site content has not been loaded. Cannot render page.';
  }

  const { manifest } = siteData;
  const themePath = manifest.theme.name;

  if (resolution.type === PageType.NotFound) return `<h1>Error</h1><p>${resolution.errorMessage}</p>`;
  if (!themePath) return 'Error: Site manifest has no theme specified.';
  
  const layoutPath = resolution.layoutPath;
  
  // 2. Load Manifests and Partials
  const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themePath, 'theme.json');
  const layoutManifest = await getLayoutManifest(siteData, layoutPath);
  await registerPartialsFromManifest(siteData, themeManifest, 'theme', themePath);
  await registerPartialsFromManifest(siteData, layoutManifest, 'layout', layoutPath);
  
  // 3. Prepare Data for Rendering
  const currentPageExportPath = getUrlForNode(
      resolution.type === PageType.SinglePage ? { ...resolution.contentFile, type: 'page' } : { ...resolution.collectionNode, type: 'collection' },
      true
  );

  if (resolution.type === PageType.Collection) {
    // ... (sorting logic is unchanged) ...
    resolution.items = resolution.items.map(item => {
        const targetUrlSegment = getUrlForNode({ ...item, type: 'page' }, options.isExport);
        const itemUrl = options.isExport ? getRelativePath(currentPageExportPath, targetUrlSegment) : `${options.siteRootPath}/${targetUrlSegment}`;
        return { ...item, url: itemUrl };
    });
  }

  // 4. Render Main Content Body
  const findTemplatePath = (manifest: ThemeManifest | LayoutManifest | null, type: string) => manifest?.files?.find(f => f.type === type)?.path;
  const mainTemplateType = resolution.type === PageType.Collection ? 'collection-index' : (layoutManifest?.type === 'collection' ? 'collection-item' : 'page');
  const mainTemplatePath = findTemplatePath(layoutManifest, mainTemplateType);
  if (!mainTemplatePath) return `Error: Layout '${layoutPath}' is missing a template with type '${mainTemplateType}'.`;
  const layoutTemplate = await getTemplateAsset(siteData, 'layout', layoutPath, mainTemplatePath);
  const bodyHtml = layoutTemplate ? layoutTemplate(resolution) : `Error: Could not render template at '${mainTemplatePath}'.`;
  
  // 5. Prepare the Final Context for the Base Template
  const navLinks = generateNavLinks(siteData, currentPageExportPath, options);
  const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
  const canonicalUrl = new URL(currentPageExportPath, siteBaseUrl).href;

  let styleOverrides = '';
  const themeConfig = manifest.theme.config;
  if (themeConfig && Object.keys(themeConfig).length > 0) {
      const cssVars = Object.entries(themeConfig)
          .map(([key, value]) => `--${key.replace(/_/g, '-')}: ${value};`)
          .join(' ');
      if (cssVars) {
          styleOverrides = `<style id="signum-theme-overrides">:root { ${cssVars} }</style>`;
      }
  }
  
  const baseUrl = options.isExport ? '' : (typeof window !== 'undefined' ? window.location.origin : '');

  // 6. Render the Final HTML Document
  const baseTemplatePath = findTemplatePath(themeManifest, 'base');
  if (!baseTemplatePath) return 'Error: Active theme is missing a template with type "base".';
  const baseTemplate = await getTemplateAsset(siteData, 'theme', themePath, baseTemplatePath);
  if (!baseTemplate) return `Error: Could not render base template at '${baseTemplatePath}'.`;

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
  });
}