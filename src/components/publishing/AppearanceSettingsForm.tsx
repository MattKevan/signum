// src/components/publishing/AppearanceSettingsForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { RJSFSchema } from '@rjsf/utils';
import { getThemeAppearanceSchema } from '@/lib/themeEngine';
import SchemaDrivenForm from './SchemaDrivenForm';
import { ThemeConfig } from '@/types';

interface AppearanceSettingsFormProps {
  themeId: string;
  themeType: 'core' | 'contrib';
  themeConfig: ThemeConfig['config'];
  onConfigChange: (newConfig: ThemeConfig['config']) => void;
}

export default function AppearanceSettingsForm({ themeId, themeType, themeConfig, onConfigChange }: AppearanceSettingsFormProps) {
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSchema() {
      setIsLoading(true);
      // CORRECTED: Pass both themeId and themeType
      const appearanceSchema = await getThemeAppearanceSchema(themeId, themeType);
      setSchema(appearanceSchema);
      setIsLoading(false);
    }
    if (themeId && themeType) {
        loadSchema();
    }
  }, [themeId, themeType]);

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
        <p className="text-sm text-muted-foreground">The current theme (&quot;{themeId}&quot;) does not provide any customizable appearance settings.</p>
      </div>
    );
  }

  return (
    <SchemaDrivenForm
      schema={schema}
      formData={themeConfig}
      onFormChange={(data) => onConfigChange(data as ThemeConfig['config'])}
    />
  );
}