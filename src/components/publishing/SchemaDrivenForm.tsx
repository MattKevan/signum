'use client';

import Form from '@rjsf/shadcn';
import validator from '@rjsf/validator-ajv8';
import { RJSFSchema, UiSchema, FieldTemplateProps, ObjectFieldTemplateProps } from '@rjsf/utils';
import { Label } from '@/core/components/ui/label';


// --- Props Definition ---
interface SchemaDrivenFormProps {
  /** The JSON Schema object that defines the form fields, types, and validation. */
  schema: RJSFSchema;
  /** The UI Schema object for customizing widget types and field appearances. */
  uiSchema?: UiSchema;
  /** The current data/state of the form. */
  formData: object;
  /** Callback function that is triggered every time the form data changes. */
  onFormChange: (data: object) => void;
  /** Set to true to enable live validation as the user types. Defaults to false. */
  liveValidate?: boolean;
}


// --- Custom Field Template (for better layout and labels) ---
function CustomFieldTemplate(props: FieldTemplateProps) {
  const { id, classNames, label, help, required, description, errors, children, schema } = props;

  if (props.hidden) {
    return <div className="hidden">{children}</div>;
  }
  
  const isCheckbox = schema.type === 'boolean' && (props.uiSchema?.['ui:widget'] === 'checkbox' || props.uiSchema?.['ui:widget'] === undefined);

  if (isCheckbox) {
      return <div className={classNames}>{children}</div>
  }

  return (
    <div className={classNames}>
      {label && (
        <Label htmlFor={id} className="block text-sm font-medium mb-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      {description}
      
      {children}
      
      {errors}
      
      {help}
    </div>
  );
}

// --- Custom Object Field Template (for overall form layout) ---
function CustomObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  return (
    <div>
        {props.description && <p className="text-sm text-muted-foreground">{props.description}</p>}
        <div className="mt-4">
            {props.properties.map(element => (
                <div key={element.name} className="mb-4">
                    {element.content}
                </div>
            ))}
        </div>
    </div>
  );
}

// --- Custom Submit Button Template (to hide it) ---
// FIXED: The 'props' parameter was defined but never used, so it has been removed.
function HideSubmitButton() {
    return null;
}

/**
 * A reusable component that dynamically generates a form from a given JSON Schema.
 * It uses react-jsonschema-form with a shadcn/ui theme for a consistent look and feel.
 */
export default function SchemaDrivenForm({ 
  schema, 
  uiSchema, 
  formData, 
  onFormChange, 
  liveValidate = false 
}: SchemaDrivenFormProps) {

  const safeFormData = formData || {};

  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={safeFormData}
      validator={validator}
      onChange={(e) => onFormChange(e.formData)}
      liveValidate={liveValidate}
      showErrorList={false}
      
      templates={{
        FieldTemplate: CustomFieldTemplate,
        ObjectFieldTemplate: CustomObjectFieldTemplate,
        ButtonTemplates: {
            SubmitButton: HideSubmitButton,
        }
      }}
    />
  );
}