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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';
import { type LayoutInfo } from '@/types'; // FIXED: Import the correct LayoutInfo type

interface NewCollectionDialogProps {
  children: ReactNode;
  existingSlugs: string[];
  onSubmit: (name: string, slug: string, layoutPath: string) => Promise<void>;
}

export default function NewCollectionDialog({ children, existingSlugs, onSubmit }: NewCollectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [selectedLayout, setSelectedLayout] = useState(''); // This will now store the layout *path*

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
    if (!selectedLayout) {
        toast.error("You must select a layout for the collection.");
        return;
    }
    if (existingSlugs.includes(slug)) {
      toast.error(`A collection or page with the folder name "${slug}" already exists.`);
      return;
    }

    // FIXED: onSubmit now receives the layout path
    await onSubmit(name, slug, selectedLayout);
    
    // Reset state after submission
    setIsOpen(false);
    setName('');
    setSlug('');
    setSelectedLayout('');
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
            <Button type="submit" disabled={!name || !selectedLayout}>Create Collection</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}