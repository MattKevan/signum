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
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';

interface NewCollectionDialogProps {
  children: ReactNode;
  existingSlugs: string[];
  onSubmit: (name: string, slug: string) => Promise<void>;
}

export default function NewCollectionDialog({ children, existingSlugs, onSubmit }: NewCollectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (name) {
      setSlug(slugify(name));
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

    if (existingSlugs.includes(slug)) {
      toast.error(`A collection or page with the folder name "${slug}" already exists.`);
      return;
    }

    await onSubmit(name, slug);
    
    // Reset state after submission
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
              Create a new folder to organize your content. All items in this collection will share a common layout.
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
            <Button type="submit" disabled={!name.trim()}>Create collection</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}