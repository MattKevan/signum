// src/features/site-settings/components/AppearanceSettingsForm.tsx
'use client';

import { RJSFSchema } from '@rjsf/utils';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { ThemeConfig } from '@/types';
// useEffect is no longer needed and is removed.
import { useState, forwardRef, useImperativeHandle } from 'react';

interface AppearanceSettingsFormProps {
  // These props are passed by the parent to initialize the form.
  schema: RJSFSchema | null;
  initialConfig: ThemeConfig['config'];
  onDirty: () => void;
  themePath: string; // Keep for display purposes
}

export interface AppearanceFormRef {
  getFormData: () => ThemeConfig['config'];
}

const AppearanceSettingsForm = forwardRef<AppearanceFormRef, AppearanceSettingsFormProps>(({ 
  schema, 
  initialConfig, 
  onDirty,
  themePath
}, ref) => {

  // The form's state is initialized ONCE from the initialConfig prop when the
  // component mounts. It will NOT be updated by parent re-renders.
  const [formData, setFormData] = useState(initialConfig);

  // The problematic useEffect hook has been removed entirely.

  useImperativeHandle(ref, () => ({
    getFormData: () => formData,
  }));

  const handleChange = (event: { formData?: Record<string, unknown> }) => {
    setFormData(event.formData as ThemeConfig['config'] || {});
    onDirty();
  };

  if (!schema) {
    return (
      <div className="text-center border-2 border-dashed p-6 rounded-lg">
        <p className="font-semibold">No Appearance Options</p>
        <p className="text-sm text-muted-foreground">The current theme "{themePath}" does not provide any customizable settings.</p>
      </div>
    );
  }

  return (
    <SchemaDrivenForm
      schema={schema}
      formData={formData}
      onFormChange={handleChange}
    />
  );
});

AppearanceSettingsForm.displayName = 'AppearanceSettingsForm';
export default AppearanceSettingsForm;