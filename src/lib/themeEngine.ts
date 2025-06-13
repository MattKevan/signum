// src/lib/themeEngine.ts
import Handlebars from 'handlebars';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { PageResolutionResult, PageType } from './pageResolver';
import { 
    LocalSiteData, 
    ParsedMarkdownFile, 
    ThemeInfo, 
    LayoutInfo 
} from '@/types';
import { generateNavLinks } from './navigationUtils';
import { getJsonAsset, getLayoutManifest, ThemeManifest } from './configHelpers';
import { CORE_THEMES, CORE_LAYOUTS } from '@/config/editorConfig';
import { getUrlForNode } from './urlUtils';
import { getRelativePath } from './pathUtils';

// --- Type Definitions ---

/**
 * @interface RenderOptions
 * @description Defines the configuration for a single render operation.
 */
export interface RenderOptions {
  /** The base path for generated links (e.g., /sites/abc/view or '/'). */
  siteRootPath: string;
  /** Determines if paths should be relative (for export) or absolute (for live preview). */
  isExport: boolean;
  /** For exports, the relative path to the asset root (e.g., '../' or './'). Not used in live preview. */
  relativeAssetPath?: string;
}

// --- Caching and Core Helpers ---

const fileContentCache = new Map<string, Promise<string | null>>();
let helpersRegistered = false;

const isCoreTheme = (path: string): boolean => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string): boolean => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);

/**
 * Fetches the raw string content of a theme or layout asset.
 * It intelligently fetches from either the `/public` directory (for core assets)
 * or the `LocalSiteData` object (for user-provided custom assets), with caching.
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
 * Registers all partials declared in a theme or layout manifest.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @param {Record<string, string> | undefined} partialsMap - A map of partial names to file paths.
 * @param {'theme' | 'layout'} assetType - The type of asset the partials belong to.
 * @param {string} assetPath - The path/ID of the theme or layout.
 */
async function registerPartialsFromManifest(siteData: LocalSiteData, partialsMap: Record<string, string> | undefined, assetType: 'theme' | 'layout', assetPath: string) {
    if (!partialsMap) return;
    for (const [name, fileRelPath] of Object.entries(partialsMap)) {
        const templateSource = await getAssetContent(siteData, assetType, assetPath, fileRelPath);
        if (templateSource) Handlebars.registerPartial(name, templateSource);
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
  
  // 2. Load Manifests and Partials for the active theme and layout
  const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themePath, 'theme.json');
  const layoutManifest = await getLayoutManifest(siteData, layoutPath);
  await registerPartialsFromManifest(siteData, themeManifest?.partials, 'theme', themePath);
  await registerPartialsFromManifest(siteData, layoutManifest?.partials, 'layout', layoutPath);
  
  // 3. Prepare Data for Rendering
  
  const currentPagePath = getUrlForNode(
      resolution.type === PageType.SinglePage 
          ? { ...resolution.contentFile, type: 'page' }
          : { ...resolution.collectionNode, type: 'collection' },
      true
  );

  if (resolution.type === PageType.Collection) {
    const sortBy = (resolution.collectionNode.sort_by as string) || 'date';
    const sortOrder = resolution.collectionNode.sort_order || 'descending';
    resolution.items.sort((a: ParsedMarkdownFile, b: ParsedMarkdownFile) => {
        const valA = (a.frontmatter as Record<string, unknown>)[sortBy] || '';
        const valB = (b.frontmatter as Record<string, unknown>)[sortBy] || '';
        const orderModifier = sortOrder === 'ascending' ? 1 : -1;
        if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * orderModifier;
        if (valA < valB) return -1 * orderModifier;
        if (valA > valB) return 1 * orderModifier;
        return 0;
    });
    resolution.items = resolution.items.map(item => {
        const targetItemPath = getUrlForNode({ ...item, type: 'page' }, true);
        return {
            ...item,
            url: getRelativePath(currentPagePath, targetItemPath)
        };
    });
  }

  // 4. Render Main Content Body
  const mainTemplateFile = resolution.type === PageType.Collection ? 'listing.hbs' : 'page.hbs';
  const layoutTemplate = await getTemplateAsset(siteData, 'layout', layoutPath, mainTemplateFile);
  const bodyHtml = layoutTemplate ? layoutTemplate(resolution) : `Error: Layout template '${mainTemplateFile}' not found.`;
  
  // 5. Prepare the Final Context for the Base Template
  const navLinks = generateNavLinks(siteData, currentPagePath);
  
  const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
  const canonicalUrl = new URL(currentPagePath, siteBaseUrl).href;

  let styleOverrides = '';
  if (manifest.theme.config && Object.keys(manifest.theme.config).length > 0) {
      const cssVars = Object.entries(manifest.theme.config).map(([k, v]) => `--${k.replace(/_/g, '-')}: ${v};`).join(' ');
      styleOverrides = `<style id="signum-overrides">:root { ${cssVars} }</style>`;
  }
  
  const baseUrl = options.isExport ? '' : (typeof window !== 'undefined' ? window.location.origin : '');

  // 6. Render the Final HTML Document
  const baseTemplate = await getTemplateAsset(siteData, 'theme', themePath, 'base.hbs');
  if (!baseTemplate) return 'Error: Base theme template (base.hbs) not found.';

  return baseTemplate({
      manifest,
      navLinks,
      year: new Date().getFullYear(),
      pageTitle: resolution.pageTitle,
      canonicalUrl: canonicalUrl,
      baseUrl: baseUrl,
      styleOverrides: new Handlebars.SafeString(styleOverrides),
      body: new Handlebars.SafeString(bodyHtml),
  });
}