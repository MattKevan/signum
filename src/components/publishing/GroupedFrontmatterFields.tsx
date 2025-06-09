'use client';

import { useMemo } from 'react';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import SchemaDrivenForm from './SchemaDrivenForm';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// --- Type Definitions ---

interface Group {
  title: string;
  fields: string[];
}
// This type is now safe and avoids 'any'
type StrictUiSchema = UiSchema & { 'ui:groups'?: Group[] };

interface GroupedFrontmatterFormProps {
  schema: RJSFSchema;
  uiSchema?: StrictUiSchema;
  // FIX: Use Record<string, unknown> which is a type-safe alternative to { [key: string]: any }
  formData: Record<string, unknown>;
  onFormChange: (newData: Record<string, unknown>) => void;
}


/**
 * A helper function to create a new schema containing only a specific
 * subset of properties from the original schema.
 */
function createSubSchema(originalSchema: RJSFSchema, fields: string[]): RJSFSchema {
  const subSchema: RJSFSchema = {
    ...originalSchema,
    properties: {},
    required: originalSchema.required?.filter(field => fields.includes(field)),
  };

  // Ensure the properties object exists before trying to assign to it.
  if (!subSchema.properties) {
    subSchema.properties = {};
  }

  for (const field of fields) {
    if (originalSchema.properties && originalSchema.properties[field]) {
      subSchema.properties[field] = originalSchema.properties[field];
    }
  }
  return subSchema;
}

/**
 * Renders a frontmatter form with fields dynamically organized into
 * collapsible accordion groups based on a provided uiSchema.
 */
export default function GroupedFrontmatterForm({
  schema,
  uiSchema,
  formData,
  onFormChange,
}: GroupedFrontmatterFormProps) {
  
  const { groups, ungroupedFields } = useMemo(() => {
    const definedGroups = uiSchema?.['ui:groups'] || [];
    const allSchemaFields = Object.keys(schema.properties || {});
    const fieldsInGroups = new Set(definedGroups.flatMap(g => g.fields));
    
    const remainingFields = allSchemaFields.filter(f => !fieldsInGroups.has(f));
    
    return { groups: definedGroups, ungroupedFields: remainingFields };
  }, [schema, uiSchema]);

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return <p className="text-sm text-muted-foreground">This layout has no configurable fields.</p>;
  }

  return (
    <div className="space-y-6">
      <Accordion type="multiple" defaultValue={groups.map(g => g.title)} className="w-full">
        {groups.map((group) => {
          if (group.fields.length === 0) return null;

          return (
            <AccordionItem value={group.title} key={group.title}>
              <AccordionTrigger>{group.title}</AccordionTrigger>
              <AccordionContent className="pt-4">
                <SchemaDrivenForm
                  schema={createSubSchema(schema, group.fields)}
                  formData={formData}
                  onFormChange={onFormChange}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {ungroupedFields.length > 0 && (
        <div className="border-t pt-6 mt-6">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
            Other Fields
          </h3>
          <SchemaDrivenForm
            schema={createSubSchema(schema, ungroupedFields)}
            formData={formData}
            onFormChange={onFormChange}
          />
        </div>
      )}
    </div>
  );
}