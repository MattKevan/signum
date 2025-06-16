// src/features/editor/components/NewViewDialog.tsx
'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';
import yaml from 'js-yaml';

// --- UI & Type Imports ---
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Plus } from 'lucide-react';
import type { MarkdownFrontmatter, StructureNode } from '@/types';
import { DEFAULT_VIEW_LAYOUT_PATH } from '@/config/editorConfig';

interface NewViewDialogProps {
  siteId: string;
  children: ReactNode;
  onComplete?: () => void;
}

export default function NewViewDialog({ siteId, children, onComplete }: NewViewDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [sourceCollection, setSourceCollection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const site = useAppStore((state) => state.getSiteById(siteId));
  const { addOrUpdateContentFile } = useAppStore.getState();

  const availableCollections = useMemo(() => {
    return site?.manifest.structure.filter((node: StructureNode) => node.type === 'collection') || [];
  }, [site?.manifest.structure]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setTitle('');
        setSourceCollection('');
        setIsSubmitting(false);
      }, 200);
    }
  };

  const handleCreateView = async () => {
    if (!title.trim() || !sourceCollection) {
      toast.error("Both a title and a source collection are required.");
      return;
    }
    setIsSubmitting(true);
    const slug = slugify(title);
    const filePath = `content/${slug}.md`;

    const slugExists = site?.contentFiles?.some(f => f.slug === slug);
    if (slugExists) {
        toast.error(`A page with the slug "${slug}" already exists.`);
        setIsSubmitting(false);
        return;
    }

    const frontmatter: MarkdownFrontmatter = {
        title: title.trim(),
        layout: DEFAULT_VIEW_LAYOUT_PATH,
        date: new Date().toISOString().split('T')[0],
        view: {
            template: 'list',
            source_collection: sourceCollection,
        }
    };

    const initialContent = `---\n${yaml.dump(frontmatter)}---\n\n# ${title.trim()}\n\nThis page lists content from the "${sourceCollection}" collection. You can add introductory text here.`;

    try {
      const success = await addOrUpdateContentFile(siteId, filePath, initialContent, frontmatter.layout);
      if (success) {
        toast.success(`View page "${title}" created!`);
        handleOpenChange(false);
        onComplete?.();
        router.push(`/sites/${siteId}/edit/content/${slug}`);
      } else { throw new Error("Failed to update manifest or save file."); }
    } catch (error) {
      toast.error(`Failed to create page: ${(error as Error).message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New View Page</DialogTitle>
          <DialogDescription>
            This page will display a list of items from a collection.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="view-title">Page Title</Label>
            <Input id="view-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Blog" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="source-collection">Content Source</Label>
            <Select value={sourceCollection} onValueChange={setSourceCollection}>
              <SelectTrigger id="source-collection"><SelectValue placeholder="Select a collection..." /></SelectTrigger>
              <SelectContent>
                {availableCollections.map(c => <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button type="button" onClick={handleCreateView} disabled={!title.trim() || !sourceCollection || isSubmitting}>
            {isSubmitting ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" /> Create View Page</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}