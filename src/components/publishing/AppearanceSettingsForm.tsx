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
    return <p className="text-muted-foreground">Loading appearance settings...</p>;
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