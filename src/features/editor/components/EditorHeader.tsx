// src/features/editor/components/EditorHeader.tsx
'use client';

import { ReactNode, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { toast } from 'sonner';
import { exportSiteToZip } from '@/core/services/siteExporter.service';
import { slugify } from '@/lib/utils';
import { Eye, PanelLeft, UploadCloud, PanelRight } from 'lucide-react';

/**
 * Props for the generic EditorHeader component.
 */
interface EditorHeaderProps {
  /**
   * An optional React node containing action buttons or other components
   * to be displayed in the header. This allows for context-specific actions.
   */
  actions?: ReactNode;
}

export default function EditorHeader({ actions }: EditorHeaderProps) {
  const params = useParams();
  const siteId = params.siteId as string;
  const [isPublishing, setIsPublishing] = useState(false);

  // Get site and UI state from the global stores
  const site = useAppStore((state) => state.getSiteById(siteId));
  const { toggleLeftSidebar, toggleRightSidebar, isLeftAvailable, isRightAvailable } = useUIStore((state) => state.sidebar);

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
  
  // Render a placeholder header if site data isn't loaded yet
  if (!site) {
    return (
        <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b bg-background px-4 lg:h-[60px]"></header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b bg-background lg:pl-4 pr-4 h-[60px]">
      <div className="flex items-center gap-2">
        <Link
            href="/sites"
            title="Dashboard"
            className='flex lg:hidden flex-col w-[60px] h-[60px] items-center border-r mr-2'
          >
            <Image src="/signum.svg" width={34} height={34} alt="Signum Logo" className='m-auto'/>
        </Link>
        {isLeftAvailable && (
            <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0" 
                onClick={toggleLeftSidebar}
                aria-label="Toggle file tree"
            >
                <PanelLeft className="h-5 w-5" />
            </Button>
        )}
      </div>

      <div className="flex-1 text-lg text-muted-foreground truncate">
       <span className="font-bold text-foreground">{site.manifest.title}</span>
      </div>
      
      <div className="flex items-center justify-end gap-2">
        {/* Render the custom actions passed via props. This is where the SaveButton will appear on the editor page. */}
        {actions}

        <Button variant="outline" asChild>
            <Link href={`/sites/${siteId}/view`} target="_blank">
                <Eye className="h-4 w-4" />
                <span className='hidden md:block '>View</span>
            </Link>
        </Button>
        <Button variant="default" onClick={handlePublishSite} disabled={isPublishing}>
            <UploadCloud className="h-4 w-4" /> 
            <span className='hidden md:block '>{isPublishing ? 'Publishing...' : 'Publish'}</span>
        </Button>

        {isRightAvailable && (
            <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0" 
                onClick={toggleRightSidebar}
                aria-label="Toggle settings sidebar"
            >
                <PanelRight className="h-5 w-5" />
            </Button>
        )}
      </div>
    </header>
  );
}