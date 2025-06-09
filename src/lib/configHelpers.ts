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

// --- Type Definitions ---
export type StrictUiSchema = UiSchema & { 'ui:groups'?: { title: string; fields: string[] }[] };
type PartialsMap = Record<string, string>;
interface BaseAssetManifest {
  name: string;
  partials?: PartialsMap;
  stylesheets?: string[];
  scripts?: string[];
}
export type ThemeManifest = BaseAssetManifest;
export interface LayoutManifest extends BaseAssetManifest {
  type: 'page' | 'collection';
  layoutSchema?: RJSFSchema;
  pageSchema: RJSFSchema;
  uiSchema?: StrictUiSchema;
}

// --- Caching and Core Helpers ---
let _baseSchemaCache: { schema: RJSFSchema, uiSchema: StrictUiSchema } | null = null;

const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);

async function getBaseSchema(): Promise<{ schema: RJSFSchema, uiSchema: StrictUiSchema } | null> {
    if (_baseSchemaCache) {
        return _baseSchemaCache;
    }
    try {
        const response = await fetch('/config/base.schema.json');
        if (!response.ok) {
            console.error("FATAL: Could not fetch /config/base.schema.json");
            return null;
        }
        const data = await response.json();
        _baseSchemaCache = data;
        return data;
    } catch (error) {
        console.error("Error fetching or parsing base.schema.json:", error);
        return null;
    }
}

// FIXED: Restored full implementation for getAssetContent
export async function getAssetContent(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      const fileContentCache = new Map<string, Promise<string | null>>();
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

// FIXED: Restored full implementation for getJsonAsset
export async function getJsonAsset<T>(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<T | null> {
    const content = await getAssetContent(siteData, assetType, path, fileName);
    if (!content) return null;
    try { return JSON.parse(content) as T; } catch (e) { console.error(`Failed to parse JSON from ${assetType}/${path}/${fileName}:`, e); return null; }
}

// FIXED: Restored full implementation for mergeSchemas
function mergeSchemas(base: RJSFSchema, specific?: RJSFSchema): RJSFSchema {
    if (!specific) return { ...base };
    return { ...base, ...specific, properties: { ...(base.properties || {}), ...(specific.properties || {}) }, required: [...new Set([...(base.required || []), ...(specific.required || [])])] };
}

// --- Public API ---

// FIXED: Restored full implementation for getAvailableLayouts
export function getAvailableLayouts(manifest?: Manifest): LayoutInfo[] {
  const available = [...CORE_LAYOUTS];
  if (manifest?.layouts) { const customLayouts = manifest.layouts.filter(cl => !available.some(coreL => coreL.path === cl.path)); available.push(...customLayouts); }
  return available;
}

// FIXED: Restored full implementation for getAvailableThemes
export function getAvailableThemes(manifest?: Manifest): ThemeInfo[] {
  const available = [...CORE_THEMES];
  if (manifest?.themes) { const customThemes = manifest.themes.filter(ct => !available.some(coreT => coreT.path === ct.path)); available.push(...customThemes); }
  return available;
}

/**
 * Fetches and prepares the manifest for a given layout.
 * It correctly merges the universal base schema with the layout-specific schema.
 */
export async function getLayoutManifest(siteData: LocalSiteData, layoutPath: string): Promise<LayoutManifest | null> {
    const layoutManifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    if (!layoutManifest) {
      console.error(`Could not load layout.json for layout: "${layoutPath}".`);
      return null;
    }
    
    const baseSchemaData = await getBaseSchema();

    if (baseSchemaData) {
        layoutManifest.pageSchema = mergeSchemas(baseSchemaData.schema, layoutManifest.pageSchema);
        layoutManifest.uiSchema = { ...(baseSchemaData.uiSchema || {}), ...(layoutManifest.uiSchema || {}) };
    }
    
    // Always remove hardcoded fields to prevent them from appearing in generic forms.
    if (layoutManifest.pageSchema?.properties) {
      delete layoutManifest.pageSchema.properties.title;
      delete layoutManifest.pageSchema.properties.description;
      delete layoutManifest.pageSchema.properties.slug;
    }
    
    if (layoutManifest.layoutSchema?.properties) {
        delete layoutManifest.layoutSchema.properties.title;
        delete layoutManifest.layoutSchema.properties.description;
    }
    
    return layoutManifest;
}