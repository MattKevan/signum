// src/lib/themeEngine.ts
import Handlebars from 'handlebars';
import { marked } from 'marked';
import { PageResolutionResult, PageType } from './pageResolver';
import { LocalSiteData, ParsedMarkdownFile, ThemeInfo, LayoutInfo } from '@/types';
import { generateNavLinks } from './navigationUtils';
import { getJsonAsset, getLayoutManifest, ThemeManifest } from './configHelpers';
import { CORE_THEMES, CORE_LAYOUTS } from '@/config/editorConfig';
import DOMPurify from 'dompurify'
import { getUrlForNode } from './urlUtils';

// --- Type Definition ---
export interface RenderOptions {
  siteRootPath: string;
  isExport: boolean;
  relativeAssetPath?: string;
}

// --- Caching and Core Helpers ---
const fileContentCache = new Map<string, Promise<string | null>>();
let helpersRegistered = false;

// Helpers are now defined at the top-level scope
const isCoreTheme = (path: string): boolean => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string): boolean => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);

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

async function getTemplateAsset(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<Handlebars.TemplateDelegate | null> {
    const source = await getAssetContent(siteData, assetType, path, fileName);
    if (!source) return null;
    try { return Handlebars.compile(source); } catch(e) { console.error(`Failed to compile Handlebars template ${assetType}/${path}/${fileName}:`, e); return null; }
}

async function registerPartialsFromManifest(siteData: LocalSiteData, partialsMap: Record<string, string> | undefined, assetType: 'theme' | 'layout', assetPath: string) {
    if (!partialsMap) return;
    for (const [name, fileRelPath] of Object.entries(partialsMap)) {
        const templateSource = await getAssetContent(siteData, assetType, assetPath, fileRelPath);
        if (templateSource) Handlebars.registerPartial(name, templateSource);
    }
}

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
 * Renders a resolved page or collection into a full HTML string.
 */
export async function render(siteData: LocalSiteData, resolution: PageResolutionResult, options: RenderOptions): Promise<string> {
  registerHelpers();
  fileContentCache.clear();
  Object.keys(Handlebars.partials).forEach(name => Handlebars.unregisterPartial(name));

  const { manifest } = siteData;
  const themePath = manifest.theme.name;

  if (resolution.type === PageType.NotFound) return `<h1>Error</h1><p>${resolution.errorMessage}</p>`;
  if (!themePath) return 'Error: Site manifest has no theme specified.';
  
  const layoutPath = resolution.layoutPath;
  
  const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themePath, 'theme.json');
  const layoutManifest = await getLayoutManifest(siteData, layoutPath);

  await registerPartialsFromManifest(siteData, themeManifest?.partials, 'theme', themePath);
  await registerPartialsFromManifest(siteData, layoutManifest?.partials, 'layout', layoutPath);
  
  if (resolution.type === PageType.Collection) {
    const sortBy = (resolution.collectionNode.sort_by as string) || 'date';
    const sortOrder = resolution.collectionNode.sort_order || 'descending';
    resolution.items.sort((a: ParsedMarkdownFile, b: ParsedMarkdownFile) => {
        resolution.items = resolution.items.map(item => {
            const itemUrl = getUrlForNode({
                slug: item.slug,
                path: item.path,
                type: 'page'
            }, options.isExport);
            return {
              ...item,
              url: itemUrl 
            };
        });

        const valA = (a.frontmatter as Record<string, unknown>)[sortBy] || '';
        const valB = (b.frontmatter as Record<string, unknown>)[sortBy] || '';
        const orderModifier = sortOrder === 'ascending' ? 1 : -1;
        if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB) * orderModifier;
        }
        if (valA < valB) return -1 * orderModifier;
        if (valA > valB) return 1 * orderModifier;
        return 0;
    });
  }
    const pageUrl = getUrlForNode(
        resolution.type === PageType.SinglePage 
            ? { slug: resolution.contentFile.slug, path: resolution.contentFile.path, type: 'page' }
            : { slug: resolution.collectionNode.slug, path: resolution.collectionNode.path, type: 'collection' },
        options.isExport
    );

  const mainTemplateFile = resolution.type === PageType.Collection ? 'listing.hbs' : 'page.hbs';
  const layoutTemplate = await getTemplateAsset(siteData, 'layout', layoutPath, mainTemplateFile);
  const bodyHtml = layoutTemplate ? layoutTemplate(resolution) : `Error: Layout template '${mainTemplateFile}' not found.`;

  const allAssets = [
    { type: 'stylesheet', path: '/css/signum-base.css' },
    { type: 'script', path: 'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js', isExternal: true },
    ...(themeManifest?.stylesheets || []).map((file: string) => ({ type: 'stylesheet', path: `/themes/${themePath}/${file}` })),
    ...(layoutManifest?.stylesheets || []).map((file: string) => ({ type: 'stylesheet', path: `/layouts/${layoutPath}/${file}` })),
  ];
  
    const assetTags = allAssets.map(asset => {
        let href: string;
        if (asset.isExternal) {
            href = asset.path;
        } else {
            href = asset.path;
            if (options.isExport) {
                const destFileName = href.substring(1).replace(/[^a-zA-Z0-9.\-_]/g, '-');
                const destFolder = asset.type === 'stylesheet' ? 'css' : 'js';
                href = `${options.relativeAssetPath || ''}${destFolder}/${destFileName}`;
            }
        }
        return asset.type === 'stylesheet' 
            ? `<link rel="stylesheet" href="${href}">` 
            : `<script src="${href}" defer></script>`;
    }).join('\n');

  let styleOverrides = '';
  if (manifest.theme.config && Object.keys(manifest.theme.config).length > 0) {
      const cssVars = Object.entries(manifest.theme.config).map(([k, v]) => `--${k.replace(/_/g, '-')}: ${v};`).join(' ');
      styleOverrides = `<style id="signum-overrides">:root { ${cssVars} }</style>`;
  }
  
  const baseTemplate = await getTemplateAsset(siteData, 'theme', themePath, 'base.hbs');
  if (!baseTemplate) return 'Error: Base theme template (base.hbs) not found.';

  const navLinks = generateNavLinks(siteData, { isStaticExport: options.isExport, siteRootPath: options.siteRootPath });

  return baseTemplate({
      manifest,
      navLinks,
      pageTitle: resolution.pageTitle,
      pageUrl: pageUrl,
      body: new Handlebars.SafeString(bodyHtml),
      assetTags: new Handlebars.SafeString(assetTags),
      styleOverrides: new Handlebars.SafeString(styleOverrides),
      year: new Date().getFullYear(),
  });
}