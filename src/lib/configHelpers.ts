// src/lib/configHelpers.ts
import { RJSFSchema, UiSchema } from '@rjsf/utils';
// MODIFIED: Import BASE_SCHEMA directly from your config file, removing the need to fetch it.
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

// --- Caching and Core Helpers ---

// A persistent cache for theme/layout assets fetched from the `/public` directory.
const fileContentCache = new Map<string, Promise<string | null>>();

const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);

/**
 * Returns the universal base schema. This is now a synchronous function
 * that reads from the imported constant, eliminating network errors.
 */
function getBaseSchema(): { schema: RJSFSchema, uiSchema: UiSchema } {
    return BASE_SCHEMA;
}

/**
 * Fetches the raw text content of a theme or layout asset.
 * This is still needed for layout-specific manifests, templates, and stylesheets.
 * It is hardened against server fallbacks that return HTML instead of the requested asset.
 */
export async function getAssetContent(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      if (fileContentCache.has(sourcePath)) {
        return fileContentCache.get(sourcePath)!;
      }

      const promise = fetch(sourcePath)
        .then(res => {
          if (!res.ok) {
            return null;
          }
          // CRITICAL: Prevent parsing HTML fallback pages as assets.
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            console.warn(`Asset fetch for "${sourcePath}" returned an HTML page, likely a 404 fallback. Treating as not found.`);
            return null;
          }
          return res.text();
        })
        .catch((e) => {
            console.error(`Network error fetching asset "${sourcePath}":`, e);
            return null;
        });

      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      // Logic for custom user-provided files from local storage.
      const fileStore: RawFile[] | undefined = assetType === 'theme' ? siteData.themeFiles : siteData.layoutFiles;
      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

/**
 * Fetches and safely parses a JSON asset (like a layout.json or theme.json).
 * Returns null if the file doesn't exist or contains invalid JSON.
 */
export async function getJsonAsset<T>(siteData: LocalSiteData, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<T | null> {
    const content = await getAssetContent(siteData, assetType, path, fileName);
    if (!content) return null;

    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.error(`Failed to parse JSON from ${assetType}/${path}/${fileName}:`, e);
      return null;
    }
}

/**
 * Merges a layout-specific schema into the base schema.
 */
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

/**
 * Fetches and prepares the manifest for a given layout.
 * It correctly merges the universal base schema with the layout-specific schema.
 */
export async function getLayoutManifest(siteData: LocalSiteData, layoutPath: string): Promise<LayoutManifest | null> {
    const layoutManifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');

    // Get the base schema directly from the imported constant. No `await` is needed.
    const baseSchemaData = getBaseSchema();

    // If a layout has no `layout.json`, we can still build a valid manifest for it
    // by using the base schema as its default.
    if (!layoutManifest) {
      return {
          name: layoutPath,
          type: 'page', // Assume 'page' as a safe default
          pageSchema: baseSchemaData.schema,
          uiSchema: baseSchemaData.uiSchema
      }
    }

    // If a layout.json exists, merge its schema with the base schema.
    layoutManifest.pageSchema = mergeSchemas(baseSchemaData.schema, layoutManifest.pageSchema);
    layoutManifest.uiSchema = { ...(baseSchemaData.uiSchema || {}), ...(layoutManifest.uiSchema || {}) };

    // This logic prevents fields handled by dedicated UI components (like PrimaryContentFields)
    // from being rendered again by the generic form generator.
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