'use client';

import React, { useState, useEffect } from 'react';
import type { MarkdownFrontmatter, LocalSiteData } from '@/types';
import GroupedFrontmatterFields from '@/components/publishing/GroupedFrontmatterFields';
import { getLayoutManifest } from '@/lib/configHelpers';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Save } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FrontmatterSidebarProps {
  site: Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;
  layoutPath: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
}

export default function FrontmatterSidebar({
  site,
  layoutPath,
  frontmatter,
  onFrontmatterChange,
  isNewFileMode,
  slug,
  onSlugChange,
  onDelete,
  onSave
}: FrontmatterSidebarProps) {
  
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [uiSchema, setUiSchema] = useState<UiSchema | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSchemaForLayout() {
      if (!layoutPath) return;
      setIsLoading(true);
      try {
        const manifest = await getLayoutManifest(site, layoutPath);
        setSchema(manifest?.pageSchema || null);
        setUiSchema(manifest?.uiSchema);
      } catch (error) {
        console.error(`Failed to load schema for layout '${layoutPath}':`, error);
        setSchema(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadSchemaForLayout();
  }, [site, layoutPath]);
  
  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

   return (
    <div>
      <div className='py-4 px-3'>
      <Button onClick={onSave} className="w-full">
        <Save className="h-4 w-4 mr-2" /> Save Changes
      </Button>

      </div>

      {schema && Object.keys(schema.properties || {}).length > 0 ? (
            <GroupedFrontmatterFields
                schema={schema}
                uiSchema={uiSchema}
                formData={frontmatter}
                onFormChange={onFrontmatterChange}
            />
      ) : (
        <div className="text-sm text-muted-foreground p-3 rounded-md text-center border-dashed border">
            <p>No additional settings for this layout.</p>
        </div>
      )}
            <Accordion type='single' collapsible>

<AccordionItem value="item-1">                <AccordionTrigger>
                  Config
                </AccordionTrigger>
                <AccordionContent>
<div className="space-y-2">
        <Label htmlFor="slug-input">URL Slug</Label>
        <Input 
            id="slug-input"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            disabled={!isNewFileMode}
            className={!isNewFileMode ? 'bg-muted/50' : ''}
        />
        <p className="text-xs text-muted-foreground">
          {isNewFileMode 
            ? "Auto-generates from title." 
            : "URL cannot be changed."}
        </p>
      </div>
{!isNewFileMode && (
    
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-6 text-red-500">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete page
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent> 
                      <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently delete the file for &quot;{frontmatter?.title || 'this content'}&quot;. This cannot be undone.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                              Yes, Delete
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
      )}
                </AccordionContent>
                </AccordionItem>
                </Accordion>
      
          </div>

    // --- END OF FIX ---
  );
}