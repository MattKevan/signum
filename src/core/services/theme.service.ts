// src/core/services/theme.service.ts
import { getJsonAsset, ThemeManifest } from './configHelpers.service';
import { RJSFSchema } from '@rjsf/utils';
import { ThemeConfig } from '@/types';

function getDefaultsFromSchema(schema: RJSFSchema | undefined): Record<string, any> {
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
 * Gets the complete, merged data needed to initialize a form or render a page.
 * It fetches the latest schema and defaults from the theme file, then intelligently
 * merges them with the user's saved configuration from the manifest.
 */
export async function getMergedThemeDataForForm(
  themeName: string,
  userSavedConfig: ThemeConfig['config']
): Promise<{
  schema: RJSFSchema | null;
  initialConfig: ThemeConfig['config'];
}> {
  const mockSiteData = { manifest: { theme: { name: themeName } } };
  const themeManifest = await getJsonAsset<ThemeManifest>(
    mockSiteData as any, 'theme', themeName, 'theme.json'
  );
  
  // [THE FIX] The optional chaining `?.` correctly produces `undefined`, which is what
  // getDefaultsFromSchema expects. We no longer convert this to `null`.
  const schema = themeManifest?.appearanceSchema;

  const defaults = getDefaultsFromSchema(schema);
  const initialConfig = { ...defaults, ...userSavedConfig };
  
  return { schema: schema || null, initialConfig };
}