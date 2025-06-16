// src/features/editor/components/DataSourceSelectWidget.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { getAvailableLayouts } from '@/core/services/configHelpers.service';
import { WidgetProps } from '@rjsf/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from '@/core/components/ui/label';
// --- FIX: Import types from their correct source files ---
import type { LocalSiteData, StructureNode } from '@/types';
import type { LayoutManifest } from '@/core/services/configHelpers.service';

// Define a consistent shape for the dropdown options
interface SelectOption {
  label: string;
  value: string;
}

// The widget's props now correctly type the `formContext` which will contain the site data
interface DataSourceSelectWidgetProps extends WidgetProps {
    formContext?: { // The context is now optional
        site?: LocalSiteData; // The site within the context is also optional
    };
}

const DataSourceSelectWidget = ({ id, label, options, value, onChange, required, formContext }: DataSourceSelectWidgetProps) => {
  const { uiSchema } = options;
    const site = formContext?.site;

  const dataSource = uiSchema?.['ui:dataSource'] as string;
  const layoutTypeFilter = uiSchema?.['ui:layoutType'] as string | undefined;

  const [items, setItems] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This effect fetches the dynamic options for the dropdown.
    const fetchItems = async () => {
      if (!site) {
        setItems([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      let fetchedItems: SelectOption[] = [];

      try {
        switch (dataSource) {
          case 'collections':
            // --- FIX: Explicitly type 'n' as StructureNode ---
            fetchedItems = site.manifest.structure
              .filter((n: StructureNode) => n.type === 'collection')
              .map((c: StructureNode) => ({ label: c.title, value: c.slug }));
            break;
          
          case 'layouts':
            const allLayouts: LayoutManifest[] = await getAvailableLayouts(site);
            fetchedItems = allLayouts
              .filter(l => !layoutTypeFilter || l.layoutType === layoutTypeFilter)
              // --- FIX: Use `l.name` as the unique ID, not `l.id` ---
              .map(l => ({ label: l.name, value: l.name })); 
            break;
            
          default:
            fetchedItems = [];
        }
        setItems(fetchedItems);
      } catch (error) {
        console.error(`Failed to fetch data source "${dataSource}":`, error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [site, dataSource, layoutTypeFilter]);

  const placeholder = useMemo(() => {
    if (isLoading) {
        return `Loading ${dataSource || 'options'}...`;
    }
    if (dataSource) {
        return `Select a ${dataSource.replace(/s$/, '')}...`;
    }
    return 'Select an option...'; // Generic fallback
  }, [isLoading, dataSource]);

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required ? '*' : ''}</Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger id={id} className="mt-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DataSourceSelectWidget;