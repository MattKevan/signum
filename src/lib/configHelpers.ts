// src/lib/configHelpers.ts
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES, BASE_SCHEMA } from '@/config/editorConfig';
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
}
export type ThemeManifest = BaseAssetManifest;
export interface LayoutManifest extends BaseAssetManifest {
  type: 'page' | 'collection';
  layoutSchema?: RJSFSchema;
  pageSchema: RJSFSchema;
  uiSchema?: StrictUiSchema;
}

// --- START OF FIX: Define the leaner site data type once ---
type SiteDataForAssets = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;
// --- END OF FIX ---


// --- Caching and Core Helpers ---
const fileContentCache = new Map<string, Promise<string | null>>();

const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);

function getBaseSchema(): { schema: RJSFSchema, uiSchema: UiSchema } {
    return BASE_SCHEMA;
}

// --- START OF FIX: Update function signature ---
export async function getAssetContent(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
// --- END OF FIX ---
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      if (fileContentCache.has(sourcePath)) {
        return fileContentCache.get(sourcePath)!;
      }
      const promise = fetch(sourcePath)
        .then(res => {
          if (!res.ok) return null;
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) return null;
          return res.text();
        })
        .catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      const fileStore: RawFile[] | undefined = assetType === 'theme' ? siteData.themeFiles : siteData.layoutFiles;
      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

// --- START OF FIX: Update function signature ---
export async function getJsonAsset<T>(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<T | null> {
// --- END OF FIX ---
    const content = await getAssetContent(siteData, assetType, path, fileName);
    if (!content) return null;
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.error(`Failed to parse JSON from ${assetType}/${path}/${fileName}:`, e);
      return null;
    }
}

function mergeSchemas(base: RJSFSchema, specific?: RJSFSchema): RJSFSchema {
    if (!specific) return { ...base };
    return {
        ...base,
        ...specific,
        properties: { ...(base.properties || {}), ...(specific.properties || {}) },
        required: [...new Set([...(base.required || []), ...(specific.required || [])])]
    };
}

// --- Public API ---

export function getAvailableLayouts(manifest?: Manifest): LayoutInfo[] {
  const available = [...CORE_LAYOUTS];
  if (manifest?.layouts) {
    const customLayouts = manifest.layouts.filter(cl => !available.some(coreL => coreL.path === cl.path));
    available.push(...customLayouts);
  }
  return available;
}

export function getAvailableThemes(manifest?: Manifest): ThemeInfo[] {
  const available = [...CORE_THEMES];
  if (manifest?.themes) {
    const customThemes = manifest.themes.filter(ct => !available.some(coreT => coreT.path === ct.path));
    available.push(...customThemes);
  }
  return available;
}

// --- START OF FIX: Update function signature ---
export async function getLayoutManifest(siteData: SiteDataForAssets, layoutPath: string): Promise<LayoutManifest | null> {
// --- END OF FIX ---
    const layoutManifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    const baseSchemaData = getBaseSchema();

    if (!layoutManifest) {
      return {
          name: layoutPath,
          type: 'page',
          pageSchema: baseSchemaData.schema,
          uiSchema: baseSchemaData.uiSchema
      }
    }

    layoutManifest.pageSchema = mergeSchemas(baseSchemaData.schema, layoutManifest.pageSchema);
    layoutManifest.uiSchema = { ...(baseSchemaData.uiSchema || {}), ...(layoutManifest.uiSchema || {}) };

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