'use client';

import { useState, useContext } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { toast } from 'sonner';
import { exportSiteToZip } from '@/core/services/siteExporter.service';
import { EditorContext, useEditor } from '@/features/editor/contexts/EditorContext'; 
import { slugify } from '@/lib/utils';
import { Eye, PanelLeft, UploadCloud, PanelRight, Save, Check, Loader2 } from 'lucide-react';
import Image from 'next/image';

const SaveButton = () => {
  // --- START OF FIX ---
  // Directly get the context. If it's undefined, we are not in an EditorProvider.
  const editorContext = useContext(EditorContext);

  // If there's no context, this button has no purpose, so render nothing.
  if (!editorContext) {
    return null;
  }
  // --- END OF FIX ---

  // Now that we know the context exists, we can safely call the hook.
  const { saveState, triggerSave } = useEditor();

  const buttonContent = {
    idle: { icon: <Save className="h-4 w-4" />, text: 'Save ' },
    saving: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'Saving' },
    saved: { icon: <Check className="h-4 w-4" />, text: 'Saved' },
    no_changes: { icon: <Check className="h-4 w-4" />, text: 'Saved' },
  };

  const current = buttonContent[saveState];
  const isDisabled = saveState === 'saving' || saveState === 'saved' || saveState === 'no_changes';

  return (
    <Button variant='ghost' onClick={triggerSave} disabled={isDisabled}>
      {current.icon}
      <span className='hidden md:block'>{current.text}</span>
    </Button>
  );
};


export default function EditorHeader() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [isPublishing, setIsPublishing] = useState(false);
  const site = useAppStore((state) => state.getSiteById(siteId));
  
  const toggleLeftSidebar = useUIStore((state) => state.sidebar.toggleLeftSidebar);
  const toggleRightSidebar = useUIStore((state) => state.sidebar.toggleRightSidebar);
  const isLeftAvailable = useUIStore((state) => state.sidebar.isLeftAvailable);
  const isRightAvailable = useUIStore((state) => state.sidebar.isRightAvailable);


  const handlePublishSite = async () => {
    if (!site) {
      toast.error("Site data not found. Cannot publish.");
      return;
    }
    setIsPublishing(true);
    toast.info("Generating site bundle for download...");
    try {
      const blob = await exportSiteToZip(site);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${slugify(site.manifest.title || 'signum-site')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Site bundle downloaded!");
    } catch (error) {
      console.error("Error publishing site to Zip:", error);
      toast.error(`Failed to generate Zip: ${(error as Error).message}`);
    } finally {
        setIsPublishing(false);
    }
  };
  
  if (!site) {
    return (
        <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b bg-background px-4 lg:h-[60px]"></header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b bg-background lg:pl-4 pr-4 h-[60px]">
      <div className="flex items-center gap-2">
        {/* Render button only if the left sidebar is available for the current page */}
        <Link
            href="/sites"
            title="Dashboard"
            className=' flex lg:hidden flex-col w-[60px] h-[60px] items-center border-r mr-2'
          >
            <Image src="/signum.svg" width={34} height={34} alt="" className='m-auto'/>
          </Link>
        {isLeftAvailable && (
            <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0" 
                onClick={toggleLeftSidebar}
            >
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle file tree</span>
            </Button>
        )}
      </div>

      <div className="flex-1 text-lg text-muted-foreground">
       <span className="font-bold text-foreground">{site.manifest.title}</span>
      </div>
      
      <div className="flex items-center justify-end gap-2">
        <SaveButton />
        <Button variant="outline" asChild>
            <Link href={`/sites/${siteId}/view`} target="_blank">
                <Eye className="h-4 w-4" /> <span className='hidden md:block '>View</span>
            </Link>
        </Button>
        <Button variant="default" onClick={handlePublishSite} disabled={isPublishing}>
            <UploadCloud className="h-4 w-4" /> 
            <span className='hidden md:block '>{isPublishing ? 'Publishing...' : 'Publish'}</span>
        </Button>

        {/* Render button only if the right sidebar is available for the current page */}
        {isRightAvailable && (
            <Button variant="outline" size="icon" className="shrink-0" onClick={toggleRightSidebar}>
                <PanelRight className="h-5 w-5" />
                <span className="sr-only">Toggle settings sidebar</span>
            </Button>
        )}
      </div>
    </header>
  );
}