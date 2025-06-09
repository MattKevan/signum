// src/lib/config-driven-helpers.ts
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES } from '@/config/editorConfig';
import {
    LocalSiteData,
    Manifest,
    LayoutInfo,
    ThemeInfo,
    RawFile,
} from '@/types';

// --- Type Definitions (Exported for use elsewhere) ---
export type StrictUiSchema = UiSchema & { 'ui:groups'?: { title: string; fields: string[] }[] };
type PartialsMap = Record<string, string>;

// This is the base contract for both theme and layout manifests.
interface BaseAssetManifest {
  name: string;
  partials?: PartialsMap;
  stylesheets?: string[];
  scripts?: string[];
}

// FIXED: Exporting the ThemeManifest type. It's an alias for the base, as it has no extra properties yet.
export type ThemeManifest = BaseAssetManifest;

// FIXED: Exporting the LayoutManifest type.
export interface LayoutManifest extends BaseAssetManifest {
  type: 'page' | 'collection';
  layoutSchema?: RJSFSchema;
  pageSchema: RJSFSchema;
  uiSchema?: StrictUiSchema;
}

// --- Caching and Core Helpers ---
const fileContentCache = new Map<string, Promise<string | null>>();
const isCoreTheme = (path: string) => CORE_THEMES.some(t => t.path === path);
const isCoreLayout = (path: string) => CORE_LAYOUTS.some(l => l.path === path);

export async function getAssetContent(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;
    if (isCore) {
      if (fileContentCache.has(sourcePath)) return fileContentCache.get(sourcePath)!;
      const promise = fetch(sourcePath).then(res => (res.ok ? res.text() : null)).catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      const fileStore: RawFile[] | undefined = assetType === 'theme' ? siteData.themeFiles : siteData.layoutFiles;
      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

export async function getJsonAsset<T>(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<T | null> {
    const content = await getAssetContent(siteData, assetType, path, fileName);
    if (!content) return null;
    try { return JSON.parse(content) as T; } catch (e) { console.error(`Failed to parse JSON from ${assetType}/${path}/${fileName}:`, e); return null; }
}

function mergeSchemas(base: RJSFSchema, specific?: RJSFSchema): RJSFSchema {
    if (!specific) return { ...base };
    return { ...base, ...specific, properties: { ...(base.properties || {}), ...(specific.properties || {}) }, required: [...new Set([...(base.required || []), ...(specific.required || [])])] };
}

// --- Public API ---

export function getAvailableLayouts(manifest?: Manifest): LayoutInfo[] {
  const available = [...CORE_LAYOUTS];
  if (manifest?.layouts) { const customLayouts = manifest.layouts.filter(cl => !available.some(coreL => coreL.path === cl.path)); available.push(...customLayouts); }
  return available;
}

export function getAvailableThemes(manifest?: Manifest): ThemeInfo[] {
  const available = [...CORE_THEMES];
  if (manifest?.themes) { const customThemes = manifest.themes.filter(ct => !available.some(coreT => coreT.path === ct.path)); available.push(...customThemes); }
  return available;
}

export async function getLayoutManifest(siteData: LocalSiteData, layoutPath: string): Promise<LayoutManifest | null> {
    const layoutManifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    if (!layoutManifest) {
      console.error(`Could not load layout manifest for "${layoutPath}".`);
      return null;
    }
    
    // An optional base schema could provide other common fields like 'date' or 'status'
    const baseSchemaFile = await getJsonAsset<{ pageSchema: RJSFSchema, uiSchema: StrictUiSchema }>(siteData, 'theme', 'default', 'config/base.schema.json');
    if (baseSchemaFile) {
        layoutManifest.pageSchema = mergeSchemas(baseSchemaFile.pageSchema, layoutManifest.pageSchema);
        layoutManifest.uiSchema = { ...(baseSchemaFile.uiSchema || {}), ...(layoutManifest.uiSchema || {}) };
    }
    
    // This ensures they are only handled by their dedicated UI components.
    if (layoutManifest.pageSchema?.properties) {
      delete layoutManifest.pageSchema.properties.title;
      delete layoutManifest.pageSchema.properties.description;
      delete layoutManifest.pageSchema.properties.slug; // Slug is not part of any schema
    }
    
    // Also clean the layout-specific schema if it exists
    if (layoutManifest.layoutSchema?.properties) {
        delete layoutManifest.layoutSchema.properties.title;
        delete layoutManifest.layoutSchema.properties.description;
    }
    
    return layoutManifest;
}