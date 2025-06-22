// src/features/site-settings/components/AppearanceSettingsForm.tsx

'use client';

import { RJSFSchema } from '@rjsf/utils';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { ThemeConfig } from '@/types';

// The props interface is simplified. It now expects to receive the schema directly.
interface AppearanceSettingsFormProps {
  schema: RJSFSchema | null; // Receive the schema as a prop.
  isLoading: boolean; // Receive loading state from the parent.
  themePath: string; // Keep this for displaying messages.
  themeConfig: ThemeConfig['config'];
  onConfigChange: (newConfig: ThemeConfig['config']) => void;
}

export default function AppearanceSettingsForm({ 
  schema, 
  isLoading,
  themePath,
  themeConfig, 
  onConfigChange 
}: AppearanceSettingsFormProps) {

  // The internal state and useEffect for loading the schema are now REMOVED.
  
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

  // If the parent passes a null schema, it means there are no settings.
  if (!schema) {
    return (
      <div className="text-center border-2 border-dashed p-6 rounded-lg">
        <p className="font-semibold">No Appearance Options</p>
        <p className="text-sm text-muted-foreground">The current theme "{themePath}" does not provide any customizable appearance settings.</p>
      </div>
    );
  }

  // The component now just renders the form with the props it was given.
  return (
    <SchemaDrivenForm
      schema={schema}
      formData={themeConfig}
      onFormChange={handleChange}
    />
  );
}