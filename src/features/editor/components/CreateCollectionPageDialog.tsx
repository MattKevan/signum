// src/features/editor/components/CreateCollectionPageDialog.tsx
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';
import yaml from 'js-yaml';

// UI & Type Imports
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Plus } from 'lucide-react';
import type { MarkdownFrontmatter } from '@/types';
//import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

interface CreateCollectionPageDialogProps {
  siteId: string;
  children: ReactNode;
  onComplete?: () => void;
}

// Default layouts for a new collection page
const DEFAULT_LIST_LAYOUT = 'listing';
const DEFAULT_ITEM_LAYOUT = 'teaser';
const DEFAULT_ITEM_PAGE_LAYOUT = 'page';

export default function CreateCollectionPageDialog({ siteId, children, onComplete }: CreateCollectionPageDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const site = useAppStore((state) => state.getSiteById(siteId));
  const { addOrUpdateContentFile } = useAppStore.getState();

  useEffect(() => {
    setSlug(slugify(name));
  }, [name]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setName('');
        setSlug('');
        setIsSubmitting(false);
      }, 200);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Collection name cannot be empty.");
      return;
    }

    const filePath = `content/${slug}.md`;
    if (site?.contentFiles?.some(f => f.path === filePath)) {
        toast.error(`A page with the folder name "${slug}" already exists.`);
        return;
    }

    setIsSubmitting(true);

    const frontmatter: MarkdownFrontmatter = {
        title: name.trim(),
        layout: DEFAULT_LIST_LAYOUT, // The layout for this page itself
        collection: { // The special block that makes this a Collection Page
            item_layout: DEFAULT_ITEM_LAYOUT,
            item_page_layout: DEFAULT_ITEM_PAGE_LAYOUT,
            sort_by: 'date',
            sort_order: 'desc',
            items_per_page: 10,
        }
    };

    const initialContent = `---\n${yaml.dump(frontmatter)}---\n\n# Welcome to the ${name.trim()} collection!\n\nYou can write an introduction for this collection here.`;

    try {
      const success = await addOrUpdateContentFile(siteId, filePath, initialContent);
      if (success) {
        toast.success(`Collection page "${name}" created!`);
        handleOpenChange(false);
        onComplete?.();
        // Redirect to the editor for the new collection page itself
        router.push(`/sites/${siteId}/edit/content/${slug}`);
      } else {
        throw new Error("Failed to update manifest or save file.");
      }
    } catch (error) {
      toast.error(`Failed to create page: ${(error as Error).message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Collection Page</DialogTitle>
            <DialogDescription>
              Create a new page that will list other pages, like a blog or a portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="name">Collection Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Blog Posts"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="slug">Folder Name (URL)</Label>
              <Input id="slug" value={slug} readOnly className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
                {isSubmitting ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" /> Create Collection</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}