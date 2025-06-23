// src/components/publishing/GroupedFrontmatterFields.tsx
'use client';

import { useMemo } from 'react';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import SchemaDrivenForm from '../../../core/components/SchemaDrivenForm';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/core/components/ui/accordion";

interface Group {
  title: string;
  fields: string[];
}
type StrictUiSchema = UiSchema & { 'ui:groups'?: Group[] };

interface GroupedFrontmatterFormProps {
  schema: RJSFSchema;
  uiSchema?: StrictUiSchema;
  formData: Record<string, unknown>;
  onFormChange: (newData: Record<string, unknown>) => void;
}

function createSubSchema(originalSchema: RJSFSchema, fields: string[]): RJSFSchema {
  const subSchema: RJSFSchema = { ...originalSchema, properties: {}, required: originalSchema.required?.filter(field => fields.includes(field)) };
  if (!subSchema.properties) subSchema.properties = {};
  for (const field of fields) {
    if (originalSchema.properties && originalSchema.properties[field]) {
      subSchema.properties[field] = originalSchema.properties[field];
    }
  }
  return subSchema;
}

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

  // FIXED: The handler now accepts the event from rjsf and extracts the formData.
  const handleChange = (event: { formData?: Record<string, unknown> }) => {
    onFormChange(event.formData || {});
  };

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return <p className="text-sm text-muted-foreground">This layout has no configurable fields.</p>;
  }

  return (
    <div className="border-t">
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
                  onFormChange={handleChange}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {ungroupedFields.length > 0 && (
        <div className="">
            <Accordion type='single' collapsible>

<AccordionItem value="item-1">                <AccordionTrigger>
                  Fields
                </AccordionTrigger>
                <AccordionContent>
<SchemaDrivenForm
            schema={createSubSchema(schema, ungroupedFields)}
            formData={formData}
            onFormChange={handleChange}
          />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
      )}
    </div>
  );
}