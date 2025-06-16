// src/components/publishing/NewPageDialog.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { slugify } from '@/lib/utils';
import { toast } from 'sonner';

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
import { FileText, Newspaper, Plus } from 'lucide-react';

// Define the steps of our creation flow
type PageCreationStep = 'choose_type' | 'configure_content' | 'configure_view';

interface NewPageDialogProps {
  siteId: string;
  // The trigger element for the dialog
  children: ReactNode;
  // A callback to close the sidebar on mobile after creation
  onComplete?: () => void; 
}

export default function NewPageDialog({ siteId, children, onComplete }: NewPageDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<PageCreationStep>('choose_type');
  const [title, setTitle] = useState('');

  // We will need the action to create a content file
  const { addOrUpdateContentFile } = useAppStore.getState();

  // Reset state whenever the dialog is closed
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setStep('choose_type');
        setTitle('');
      }, 200); // Delay reset to allow for closing animation
    }
  };

  const handleCreateContentPage = async () => {
    if (!title.trim()) {
        toast.error("Page title cannot be empty.");
        return;
    }

    const slug = slugify(title);
    const filePath = `content/${slug}.md`;
    
    // For now, we use a hardcoded default layout and simple content.
    // This would be expanded in the full implementation of the 'Configure Content' step.
    const defaultLayoutId = 'page'; 
    const initialContent = `---\ntitle: "${title.trim()}"\nlayout: "${defaultLayoutId}"\n---\n\n# ${title.trim()}\n\nStart writing your content here.\n`;
    
    try {
        const success = await addOrUpdateContentFile(siteId, filePath, initialContent, defaultLayoutId);
        if (success) {
            toast.success(`Page "${title}" created!`);
            handleOpenChange(false);
            onComplete?.();
            // Redirect to the new page's editor
            router.push(`/sites/${siteId}/edit/content/${slug}`);
        } else {
            throw new Error("Failed to update manifest or save file.");
        }
    } catch (error) {
        toast.error(`Failed to create page: ${(error as Error).message}`);
    }
  };


  const renderStep = () => {
    switch (step) {
      // Step 2A: Configure Content Page (Simplified for this implementation)
      case 'configure_content':
        return (
            <>
                <DialogHeader>
                    <DialogTitle>Create New Content Page</DialogTitle>
                    <DialogDescription>
                        Give your new page a title. You can add content and change settings later.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-1">
                        <Label htmlFor="title">Page Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., About Us"
                            autoComplete="off"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setStep('choose_type')}>Back</Button>
                    <Button type="button" onClick={handleCreateContentPage} disabled={!title.trim()}>
                        <Plus className="mr-2 h-4 w-4" /> Create Page
                    </Button>
                </DialogFooter>
            </>
        );

      // Step 2B: Configure View Page (Placeholder for now)
      case 'configure_view':
         return (
            <>
                <DialogHeader>
                    <DialogTitle>Create New View Page (Coming Soon)</DialogTitle>
                    <DialogDescription>
                        This feature is not yet implemented. Please go back to create a content page.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setStep('choose_type')}>Back</Button>
                </DialogFooter>
            </>
        );

      // Step 1: Choose Page Type (Default)
      case 'choose_type':
      default:
        return (
            <>
                <DialogHeader>
                    <DialogTitle>Create a New Page</DialogTitle>
                    <DialogDescription>
                        What kind of page would you like to create?
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <button
                        onClick={() => setStep('configure_content')}
                        className="flex flex-col items-center justify-center p-6 border rounded-lg text-center hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                        <FileText className="h-8 w-8 mb-2" />
                        <span className="font-semibold">Content Page</span>
                        <p className="text-xs text-muted-foreground mt-1">A standard page with written content, like an "About Us" page.</p>
                    </button>
                    <button
                        onClick={() => setStep('configure_view')}
                        className="flex flex-col items-center justify-center p-6 border rounded-lg text-center hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                        <Newspaper className="h-8 w-8 mb-2" />
                        <span className="font-semibold">View Page</span>
                         <p className="text-xs text-muted-foreground mt-1">A page that automatically lists content from a collection, like a blog.</p>
                    </button>
                </div>
            </>
        );
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}