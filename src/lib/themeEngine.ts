// src/lib/themeEngine.ts
import { RJSFSchema, UiSchema } from '@rjsf/utils';

// --- Type Definitions for this module ---

export interface ThemeLayout {
  id: string;
  name: string;
  type: 'page' | 'collection';
}

export interface LayoutSchema {
  schema: RJSFSchema;
  uiSchema?: UiSchema;
  itemSchema?: RJSFSchema;
  itemUiSchema?: UiSchema;
}

// Specific types for the JSON files we expect to parse
interface SchemaFile {
    schema: RJSFSchema;
    uiSchema?: UiSchema;
}
interface ThemeManifestFile {
    layouts: string[];
}

// --- Caching ---
const jsonCache: { [key: string]: object } = {};


// --- Core Functions ---

/**
 * A private helper function to fetch and cache a JSON file, with type safety.
 */
async function getJsonFile<T extends object>(path: string): Promise<T | null> {
  if (jsonCache[path]) {
    return jsonCache[path] as T;
  }
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const data = await response.json();
    jsonCache[path] = data;
    return data as T;
  } catch {
    return null;
  }
}

/**
 * Retrieves the full schema definition for a given layout within a theme.
 */
export async function getLayoutSchema(themeName: string, layoutId: string): Promise<LayoutSchema | null> {
  const layoutPath = `/themes/${themeName}/layouts/${layoutId}`;
  
  const mainSchemaFile = await getJsonFile<SchemaFile>(`${layoutPath}/schema.json`);
  const itemSchemaFile = await getJsonFile<SchemaFile>(`${layoutPath}/item.schema.json`);

  // The primary schema is the one for the main entity (page or collection listing)
  const primarySchema = mainSchemaFile || itemSchemaFile;

  if (!primarySchema || !primarySchema.schema) {
    return null; // The layout is invalid if it has no primary schema.
  }

  return {
    schema: primarySchema.schema,
    uiSchema: primarySchema.uiSchema,
    itemSchema: itemSchemaFile?.schema,
    itemUiSchema: itemSchemaFile?.uiSchema,
  };
}

/**
 * Retrieves a list of all available, declared layouts for a given theme.
 */
export async function getAvailableLayouts(themeName: string): Promise<ThemeLayout[]> {
  const themeManifest = await getJsonFile<ThemeManifestFile>(`/themes/${themeName}/theme.json`);

  if (!themeManifest || !Array.isArray(themeManifest.layouts)) {
    console.error(`Theme manifest not found or invalid for theme: ${themeName}`);
    return [];
  }

  const layouts: ThemeLayout[] = [];

  for (const layoutId of themeManifest.layouts) {
    const schemaData = await getLayoutSchema(themeName, layoutId);
    if (!schemaData) {
      console.warn(`Layout "${layoutId}" is missing its required schema files.`);
      continue;
    }

    const isCollection = !!schemaData.itemSchema;
    
    layouts.push({
      id: layoutId,
      name: schemaData.schema.title || layoutId.charAt(0).toUpperCase() + layoutId.slice(1),
      type: isCollection ? 'collection' : 'page',
    });
  }
  return layouts;
}