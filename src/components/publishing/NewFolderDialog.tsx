// src/components/publishing/NewFolderDialog.tsx
'use client';

import { useState, type ReactNode } from 'react';
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
import { toast } from 'sonner';

interface NewFolderDialogProps {
  children: ReactNode;
  onSubmit: (folderName: string) => Promise<void>;
}

export default function NewFolderDialog({ children, onSubmit }: NewFolderDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Folder name cannot be empty.");
      return;
    }
    
    try {
        await onSubmit(name);
        toast.success(`Folder "${name}" created!`);
        setIsOpen(false);
        setName('');
    } catch (error) {
        toast.error(`Failed to create folder: ${(error as Error).message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
                Create a folder to organize pages. An `index.md` file will be automatically created inside it.
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
                placeholder="e.g., About Us"
                autoComplete="off"
                />
            </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Create Folder</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}