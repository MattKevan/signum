// src/core/services/configHelpers.service.ts

import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES, BASE_SCHEMA } from '@/config/editorConfig';
import {
    LocalSiteData,
    Manifest,
    LayoutInfo,
    ThemeInfo,
    RawFile,
} from '@/core/types';

// --- Type Definitions ---

export type StrictUiSchema = UiSchema & { 'ui:groups'?: { title: string; fields: string[] }[] };

export type AssetFileType =
  | 'manifest'
  | 'base'
  | 'template'
  | 'partial'
  | 'stylesheet'
  | 'script'
  | 'asset';

export interface AssetFile {
  path: string;
  type: AssetFileType;
  name?: string;
}

/** The base properties shared by all asset manifests. */
export interface BaseAssetManifest {
  name: string;
  version: string;
  description?: string;
  icon?: string;
  files: AssetFile[];
}

/** The structure of a theme.json file. */
export interface ThemeManifest extends BaseAssetManifest {
  appearanceSchema?: RJSFSchema;
}

/** The structure of a layout.json file. */
export interface LayoutManifest extends BaseAssetManifest {
  id: string;
  layoutType: 'page' | 'list' | 'item';
  schema?: RJSFSchema;
  uiSchema?: StrictUiSchema;
}

export type SiteDataForAssets = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

// --- Helper Functions ---

const fileContentCache = new Map<string, Promise<string | null>>();

// --- FIX: Exported the helper functions for use in siteBackup.service ---
/**
 * Checks if a given theme path corresponds to a core (built-in) theme.
 * @param path The path/ID of the theme (e.g., 'default').
 * @returns {boolean} True if the theme is a core theme.
 */
export const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);

/**
 * Checks if a given layout path corresponds to a core (built-in) layout.
 * @param path The path/ID of the layout (e.g., 'page', 'listing').
 * @returns {boolean} True if the layout is a core layout.
 */
export const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.id === path);

/**
 * Provides a base schema for all content, ensuring common fields are available.
 * @returns An object containing the base RJSFSchema and UiSchema.
 */
function getBaseSchema(): { schema: RJSFSchema, uiSchema: UiSchema } {
    return BASE_SCHEMA;
}

/**
 * Fetches the raw string content of a theme or layout asset.
 * It intelligently fetches from either the `/public` directory (for core assets)
 * or the `LocalSiteData` object (for user-provided custom assets), with caching.
 */
export async function getAssetContent(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<string | null> {
    const isCore = assetType === 'theme' ? isCoreTheme(path) : isCoreLayout(path);
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      if (fileContentCache.has(sourcePath)) {
        return fileContentCache.get(sourcePath)!;
      }
      const promise = fetch(sourcePath)
        .then(res => res.ok ? res.text() : null)
        .catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      const fileStore: RawFile[] | undefined =
          assetType === 'theme' ? siteData.themeFiles
          : assetType === 'layout' ? siteData.layoutFiles
          : undefined;

      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

/**
 * A generic function to fetch and parse any JSON asset manifest (theme, layout).
 */
export async function getJsonAsset<T>(siteData: SiteDataForAssets, assetType: 'theme' | 'layout', path: string, fileName: string): Promise<T | null> {
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
 * Merges a layout's specific schema with the universal base schema.
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

/**
 * Gets a list of all available themes (core and custom).
 */
export function getAvailableThemes(manifest?: Manifest): ThemeInfo[] {
  const available = [...CORE_THEMES];
  if (manifest?.themes) {
    const customThemes = manifest.themes.filter(ct => !available.some(coreT => coreT.path === ct.path));
    available.push(...customThemes);
  }
  return available;
}

/**
 * Fetches and processes the manifest for a specific layout, merging its
 * schema with the base content schema.
 */
export async function getLayoutManifest(siteData: SiteDataForAssets, layoutPath: string): Promise<LayoutManifest | null> {
    const layoutManifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    const baseSchemaData = getBaseSchema();

    if (!layoutManifest) {
      // Fallback for a missing layout.json.
      return {
          id: layoutPath,
          name: layoutPath,
          version: '1.0.0',
          layoutType: 'page',
          files: [],
          schema: baseSchemaData.schema,
          uiSchema: baseSchemaData.uiSchema,
      }
    }

    layoutManifest.schema = mergeSchemas(baseSchemaData.schema, layoutManifest.schema);
    layoutManifest.uiSchema = { ...baseSchemaData.uiSchema, ...(layoutManifest.uiSchema || {}) };

    if (layoutManifest.schema?.properties) {
      delete layoutManifest.schema.properties.title;
      delete layoutManifest.schema.properties.description;
      delete layoutManifest.schema.properties.slug;
    }

    return { ...layoutManifest, id: layoutPath };
}

/**
 * Gets a list of the full manifest objects for all available layouts,
 * optionally filtered by a specific layout type.
 */
export async function getAvailableLayouts(
  siteData: SiteDataForAssets,
  type?: LayoutManifest['layoutType']
): Promise<LayoutManifest[]> {
  const coreLayoutIds = CORE_LAYOUTS.map(l => l.id);
  const customLayoutIds = siteData.manifest.layouts?.map(l => l.id) || [];
  const allLayoutIds = [...new Set([...coreLayoutIds, ...customLayoutIds])];

  const manifestPromises = allLayoutIds.map(layoutId =>
    getLayoutManifest(siteData, layoutId)
  );

  const allManifests = (await Promise.all(manifestPromises))
    .filter((m): m is LayoutManifest => m !== null);

  if (type) {
    return allManifests.filter(m => m.layoutType === type);
  }

  return allManifests;
}