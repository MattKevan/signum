// src/core/services/theme.service.ts

import { Manifest, ThemeConfig } from '@/types';
import { getJsonAsset, ThemeManifest } from './configHelpers.service';
import { RJSFSchema } from '@rjsf/utils';

/**
 * Parses a JSON Schema and extracts all defined default values into an object.
 * @param schema The RJSFSchema to parse.
 * @returns An object containing the key-value pairs of default properties.
 */
function getDefaultsFromSchema(schema: RJSFSchema | null): Record<string, any> {
  if (!schema || !schema.properties) return {};
  
  const defaults: Record<string, any> = {};
  
  for (const key in schema.properties) {
    const property = schema.properties[key];
    if (typeof property === 'object' && 'default' in property) {
      defaults[key] = property.default;
    }
  }
  
  return defaults;
}

/**
 * Synchronizes a site's manifest with its selected theme's defaults.
 * 
 * This is the single source of truth for ensuring a manifest's theme configuration
 * is valid and complete. It fetches the theme's schema, gets the default values,
 * and intelligently merges them with any existing user-saved values.
 * 
 * @param manifest The site's manifest object to be synchronized.
 * @returns A promise that resolves to the synchronized theme configuration.
 */
export async function synchronizeThemeDefaults(manifest: Manifest): Promise<ThemeConfig> {
  const themeName = manifest.theme.name;
  
  // We pass a minimal mock siteData object, as getJsonAsset only needs the manifest
  // for core themes. This makes the function self-contained.
  const mockSiteData = { manifest };
  const themeManifest = await getJsonAsset<ThemeManifest>(mockSiteData as any, 'theme', themeName, 'theme.json');
  
  const schema = themeManifest?.appearanceSchema || null;
  const schemaDefaults = getDefaultsFromSchema(schema);
  
  // Intelligently merge: start with the theme's defaults, then apply the user's saved values over them.
  // This ensures that if a new default is added to a theme, existing sites will pick it up.
  const synchronizedConfig = { ...schemaDefaults, ...(manifest.theme.config || {}) };
  
  return {
    name: themeName,
    config: synchronizedConfig,
  };
}