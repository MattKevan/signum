// src/components/publishing/AppearanceSettingsForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { RJSFSchema } from '@rjsf/utils';
import { getJsonAsset, type ThemeManifest } from '@/core/services/configHelpers.service';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { ThemeConfig, LocalSiteData } from '@/types';

interface AppearanceSettingsFormProps {
  site: LocalSiteData;
  themePath: string;
  themeConfig: ThemeConfig['config'];
  onConfigChange: (newConfig: ThemeConfig['config']) => void;
}

export default function AppearanceSettingsForm({ site, themePath, themeConfig, onConfigChange }: AppearanceSettingsFormProps) {
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSchema() {
      if (!themePath) {
        setIsLoading(false);
        setSchema(null);
        return;
      }
      
      setIsLoading(true);

      // --- START OF CORRECTED LOGIC ---

      // 1. Fetch the entire theme.json file for the active theme.
      const themeManifest = await getJsonAsset<ThemeManifest>(
        site,
        'theme',
        themePath,
        'theme.json' // <-- Correct filename
      );

      // 2. Check if the manifest was found and if it contains the appearance schema.
      if (themeManifest && themeManifest.appearanceSchema) {
        setSchema(themeManifest.appearanceSchema);
      } else {
        // If not found, there are no settings, so set the schema to null.
        setSchema(null);
      }
      
      // --- END OF CORRECTED LOGIC ---

      setIsLoading(false);
    }

    loadSchema();
  }, [site, themePath]);
  
  const handleChange = (event: { formData?: Record<string, unknown> }) => {
    onConfigChange(event.formData as ThemeConfig['config'] || {});
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center p-4 text-muted-foreground">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading appearance options...</span>
        </div>
    );
  }

  if (!schema) {
    return (
      <div className="text-center border-2 border-dashed p-6 rounded-lg">
        <p className="font-semibold">No Appearance Options</p>
        <p className="text-sm text-muted-foreground">The current theme ("{themePath}") does not provide any customizable appearance settings.</p>
      </div>
    );
  }

  return (
    <SchemaDrivenForm
      schema={schema}
      formData={themeConfig}
      onFormChange={handleChange}
    />
  );
}