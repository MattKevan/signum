// core/services/theme.service.ts

import type { RJSFSchema } from '@rjsf/utils';
import type { ThemeConfig } from '@/types';

// Extract default values from JSON schema
const extractDefaultsFromSchema = (schema: RJSFSchema): ThemeConfig['config'] => {
  const defaults: ThemeConfig['config'] = {};
  
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, property]) => {
      if (typeof property === 'object' && property !== null && 'default' in property) {
        defaults[key] = property.default as string | number | boolean;
      }
    });
  }
  
  return defaults;
};

// Smart field-by-field config merging
const getMergedThemeConfig = (
  themeSchema: RJSFSchema,
  savedConfig: ThemeConfig['config'],
  isThemeChange: boolean = false
): ThemeConfig['config'] => {
  const defaults = extractDefaultsFromSchema(themeSchema);
  
  if (!isThemeChange) {
    // Same theme: Use saved values, fall back to defaults for missing fields
    return { ...defaults, ...savedConfig };
  }
  
  // Theme change: Field-by-field merge to preserve matching user preferences
  const merged = { ...defaults };
  
  // For each saved setting, check if it exists in the new theme
  Object.entries(savedConfig).forEach(([key, value]) => {
    const fieldExists = themeSchema.properties?.[key];
    const hasValidType = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    
    if (fieldExists && hasValidType) {
      // Field exists in new theme and has valid type - preserve user's value
      merged[key] = value;
    }
    // If field doesn't exist or has invalid type, use default (already set above)
  });
  
  return merged;
};

// Updated main function with smart merging
export const getMergedThemeDataForForm = async (
  themeName: string,
  savedConfig: ThemeConfig['config'] = {},
  currentThemeName?: string
): Promise<{ schema: RJSFSchema | null; initialConfig: ThemeConfig['config'] }> => {
  try {
    // Load the theme data (this function should already exist)
    const themeData = await getThemeData(themeName);
    const schema = themeData?.appearanceSchema;
    
    if (!schema || !schema.properties) {
      return { schema: null, initialConfig: {} };
    }
    
    // Determine if this is a theme change
    const isThemeChange = Boolean(currentThemeName && currentThemeName !== themeName);
    
    // Use smart merging logic
    const mergedConfig = getMergedThemeConfig(schema, savedConfig, isThemeChange);
    
    return {
      schema,
      initialConfig: mergedConfig
    };
    
  } catch (error) {
    console.error('Error loading theme data:', error);
    return { schema: null, initialConfig: {} };
  }
};

// Helper function to get theme data (implement based on your existing code)
const getThemeData = async (themeName: string) => {
  // This should load the theme.json file for the specified theme
  // Replace with your existing implementation
  const response = await fetch(`/themes/${themeName}/theme.json`);
  if (!response.ok) {
    throw new Error(`Failed to load theme: ${themeName}`);
  }
  return response.json();
};