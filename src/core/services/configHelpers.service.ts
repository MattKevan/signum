// src/core/services/configHelpers.service.ts

import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { CORE_LAYOUTS, CORE_THEMES, BASE_SCHEMA, CORE_VIEWS } from '@/config/editorConfig';
import {
    LocalSiteData,
    Manifest,
    LayoutInfo,
    ThemeInfo,
    ViewInfo,
    RawFile,
} from '@/types';

// --- Type Definitions ---

export type StrictUiSchema = UiSchema & { 'ui:groups'?: { title: string; fields: string[] }[] };

export type AssetFileType = 
  | 'manifest' 
  | 'base'              // A theme's main HTML shell
  | 'template'          // A generic template (used by Views)
  | 'page'              // A layout template for a standard content page
  | 'item'   // A layout template for an item within a list
  | 'view'
  | 'partial' 
  | 'stylesheet' 
  | 'script' 
  | 'asset';

export interface AssetFile {
  path: string;
  type: AssetFileType;
  name?: string; // User-friendly name for UI selectors
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
  layoutType: 'page' | 'view' | 'item';
  schema?: RJSFSchema; // Optional schema for a layout's own settings.
  uiSchema?: StrictUiSchema;
}

/** The structure of a view.json file. */
export interface ViewManifest extends BaseAssetManifest {
  // The schema for the form that configures this View in the editor UI.
  schema: RJSFSchema;
}


export type SiteDataForAssets = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

// --- Helper Functions ---

const fileContentCache = new Map<string, Promise<string | null>>();

const isCoreTheme = (path: string) => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string) => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);
const isCoreView = (path: string) => CORE_VIEWS.some((v: ViewInfo) => v.path === path);

/**
 * Provides a base schema for all content, ensuring common fields like
 * date and status are available without being redefined in every layout.
 * @returns An object containing the base RJSFSchema and UiSchema.
 */
function getBaseSchema(): { schema: RJSFSchema, uiSchema: UiSchema } {
    return BASE_SCHEMA;
}

/**
 * Fetches the raw string content of a theme or layout asset.
 * It intelligently fetches from either the `/public` directory (for core assets)
 * or the `LocalSiteData` object (for user-provided custom assets), with caching.
 * @param {SiteDataForAssets} siteData - A lean version of the site data.
 * @param {'theme' | 'layout' | 'view'} assetType - The type of asset to fetch.
 * @param {string} path - The path/ID of the theme or layout (e.g., 'default').
 * @param {string} fileName - The name of the file to fetch (e.g., 'base.hbs').
 * @returns {Promise<string | null>} The raw file content or null if not found.
 */
export async function getAssetContent(siteData: SiteDataForAssets, assetType: 'theme' | 'layout' | 'view', path: string, fileName: string): Promise<string | null> {
 let isCore = false;
    if (assetType === 'theme') {
        isCore = isCoreTheme(path);
    } else if (assetType === 'layout') {
        isCore = isCoreLayout(path);
    } else if (assetType === 'view') {
        isCore = isCoreView(path);
    }    
    
    const sourcePath = `/${assetType}s/${path}/${fileName}`;

    if (isCore) {
      // This part is correct. It fetches from /public/...
      if (fileContentCache.has(sourcePath)) {
        return fileContentCache.get(sourcePath)!;
      }
      const promise = fetch(sourcePath)
        .then(res => res.ok ? res.text() : null)
        .catch(() => null);
      fileContentCache.set(sourcePath, promise);
      return promise;
    } else {
      // This is for custom assets stored in siteData.
      // We need to check for a new `viewFiles` array here in the future.
      const fileStore: RawFile[] | undefined = 
          assetType === 'theme' ? siteData.themeFiles 
          : assetType === 'layout' ? siteData.layoutFiles
          : undefined; // <-- Future: siteData.viewFiles
      
      const fullPath = `${assetType}s/${path}/${fileName}`;
      return fileStore?.find(f => f.path === fullPath)?.content ?? null;
    }
}

/**
 * A generic function to fetch and parse any JSON asset manifest (theme, layout, view).
 * @param {SiteDataForAssets} siteData - Lean site data.
 * @param {'theme' | 'layout' | 'view'} assetType - The type of asset manifest to fetch.
 * @param {string} path - The path/ID of the asset.
 * @param {string} fileName - The name of the JSON manifest file.
 * @returns {Promise<T | null>} The parsed JSON object, or null if not found or invalid.
 */
export async function getJsonAsset<T>(siteData: SiteDataForAssets, assetType: 'theme' | 'layout' | 'view', path: string, fileName: string): Promise<T | null> {
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
 * @param {RJSFSchema} base - The base schema with common fields.
 * @param {RJSFSchema | undefined} specific - The layout's own schema.
 * @returns {RJSFSchema} The combined schema.
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
 * @param {Manifest | undefined} manifest - The site's manifest.
 * @returns {ThemeInfo[]} A list of themes for use in UI selectors.
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
 * @param {SiteDataForAssets} siteData - Lean site data.
 * @param {string} layoutPath - The path/ID of the layout to fetch.
 * @returns {Promise<LayoutManifest | null>} The processed layout manifest.
 */
export async function getLayoutManifest(siteData: SiteDataForAssets, layoutPath: string): Promise<LayoutManifest | null> {
    const layoutManifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
    const baseSchemaData = getBaseSchema();

    if (!layoutManifest) {
      // Fallback for a missing layout.json. Create a default in-memory manifest.
      // --- FIX: This object now correctly includes all required and optional properties of LayoutManifest ---
      return {
          name: layoutPath,
          version: '1.0.0',
          layoutType: 'page',
          files: [],
          schema: baseSchemaData.schema,
          uiSchema: baseSchemaData.uiSchema, // Assign to the correct property
      }
    }

    // Merge the layout's schema and uiSchema with the base schemas.
    layoutManifest.schema = mergeSchemas(baseSchemaData.schema, layoutManifest.schema);
    // The specific layout's uiSchema overrides the base uiSchema.
    layoutManifest.uiSchema = { ...baseSchemaData.uiSchema, ...(layoutManifest.uiSchema || {}) };
    
    // Clean up properties that are handled by dedicated UI fields, not the generic form.
    if (layoutManifest.schema?.properties) {
      delete layoutManifest.schema.properties.title;
      delete layoutManifest.schema.properties.description;
      delete layoutManifest.schema.properties.slug;
    }

    return layoutManifest;
}

/**
 * Gets a list of all available views (core and eventually custom).
 * For now, it returns a hardcoded list of core views from /public/views/.
 * @returns {ViewInfo[]} A list of views for use in UI selectors.
 */
// FIX: The unused '_manifest' parameter has been completely removed from the function signature.
export function getAvailableViews(): ViewInfo[] {
  // In the future, this could be expanded to scan for custom views in a manifest.
  // The manifest would be passed back in as a parameter at that time.
  const coreViews: ViewInfo[] = [
    { id: 'list', name: 'Simple List View', path: 'list' },
  ];
  return coreViews;
}
/**
 * Gets a list of the full manifest objects for all available layouts,
 * optionally filtered by a specific layout type.
 * @param {SiteDataForAssets} siteData - Lean site data needed to fetch custom layouts.
 * @param {LayoutManifest['layoutType']} [type] - Optional type to filter by.
 * @returns {Promise<LayoutManifest[]>} A promise that resolves to a list of full layout manifests.
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

  // If a type filter was provided, apply it now.
  if (type) {
    return allManifests.filter(m => m.layoutType === type);
  }

  return allManifests;
}