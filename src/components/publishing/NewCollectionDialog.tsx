// src/components/publishing/NewCollectionDialog.tsx
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';

interface NewCollectionDialogProps {
  children: ReactNode; // The trigger button
  existingCollectionPaths: string[];
  onSubmit: (name: string, slug: string) => Promise<void>;
}

export default function NewCollectionDialog({ children, existingCollectionPaths, onSubmit }: NewCollectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  // Effect to auto-generate the slug from the collection name
  useEffect(() => {
    if (name) {
      const generatedSlug = slugify(name);
      setSlug(generatedSlug);
    } else {
      setSlug('');
    }
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Collection name cannot be empty.");
      return;
    }
    if (existingCollectionPaths.includes(slug)) {
      toast.error(`A collection with the folder name "${slug}" already exists.`);
      return;
    }

    await onSubmit(name, slug);
    
    // Close and reset the dialog
    setIsOpen(false);
    setName('');
    setSlug('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
                Create a new folder to organize your content. This will appear in your site structure.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                Name
                </Label>
                <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Blog Posts"
                autoComplete="off"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="slug" className="text-right">
                Folder Name
                </Label>
                <Input
                id="slug"
                value={slug}
                readOnly
                className="col-span-3 bg-muted"
                />
            </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Create Collection</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}