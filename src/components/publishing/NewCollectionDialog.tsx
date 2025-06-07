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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';
import { type ThemeLayout } from '@/lib/themeEngine'; // Import the layout type

interface NewCollectionDialogProps {
  children: ReactNode;
  existingSlugs: string[];
  availableLayouts: ThemeLayout[]; // Pass in available layouts
  onSubmit: (name: string, slug: string, layout: string) => Promise<void>; // Update signature
}

export default function NewCollectionDialog({ children, existingSlugs, availableLayouts, onSubmit }: NewCollectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [selectedLayout, setSelectedLayout] = useState('');

  useEffect(() => {
    if (name) {
      setSlug(slugify(name));
    } else {
      setSlug('');
    }
  }, [name]);
  
  // Set a default layout when the dialog opens
  useEffect(() => {
    if (isOpen && availableLayouts.length > 0) {
      setSelectedLayout(availableLayouts[0].id);
    }
  }, [isOpen, availableLayouts]);

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

    await onSubmit(name, slug, selectedLayout);
    
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
            <div className="space-y-1">
              <Label htmlFor="layout-select">Layout</Label>
               <Select value={selectedLayout} onValueChange={setSelectedLayout}>
                    <SelectTrigger id="layout-select"><SelectValue placeholder="Select a layout..." /></SelectTrigger>
                    <SelectContent>
                        {availableLayouts.map(layout => (
                            <SelectItem key={layout.id} value={layout.id}>{layout.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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