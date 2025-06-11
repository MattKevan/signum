// src/app/sites/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { exportSiteToZip } from '@/lib/siteExporter';
import { slugify } from '@/lib/utils';
import { useState } from 'react';
import ErrorBoundary from '@/components/core/ErrorBoundary';
import Image from 'next/image';
import { TbEdit, TbSettings } from "react-icons/tb";
export default function SingleSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishSite = async () => {
    if (!site) return;
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
      <div className="flex justify-center items-center h-full">
        <p>Loading site...</p>
      </div>
    );
  }

  // Determine active state for links based on the new structure
  const isViewActive = pathname === `/sites/${siteId}/view`;
  const isEditorActive = pathname.startsWith(`/sites/${siteId}/edit`);
  const isSettingsActive = pathname.startsWith(`/sites/${siteId}/settings`);

  return (
    <div className='h-screen w-full'>
      <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className=" flex h-[60px] items-center">
                  
                  <div className='w-[60px] h-[60px] border-r flex items-center'>
                    <Link href="/sites" title="Sites" className='m-auto '>
                      <Image src="/signum.svg" alt='Signum' width={26} height={26}/>
                    </Link>
                  </div>
                  
                  <div className='px-4'> 
                    
                    <div className="text-xl font-bold text-foreground hidden sm:inline">
                      {site.manifest.title}
                    </div>
                    <Button asChild variant="ghost">
                      <Link href="/sites">Dashboard</Link>
                    </Button>
                  </div>
                </div>
              </div>
              
    <div className="flex flex-row w-full h-full">
   
    
      {/* This is the persistent vertical menu for the site context */}
      <aside className="w-[60px]  flex-none flex flex-col gap-4 h-screen fixed top-[60px] border-r bg-muted/20">
        <div className="mt-3 flex flex-col gap-2">
          <Link href={`/sites/${site.siteId}/view`} 
            className={`p-1 rounded-sm aspect-square size-10 mx-auto flex items-center ${isViewActive && ('bg-gray-100')}`}
          >
            <div className='size-8 rounded-full bg-pink-200 '></div>
          </Link>

          <Link href={`/sites/${site.siteId}/edit`} 
            title="Edit site" 
            className={`p-1 rounded-sm aspect-square size-10 mx-auto flex items-center ${isEditorActive && ('bg-gray-100')}`}
            >
            <TbEdit className="size-7 mx-auto transition-colors" />
          </Link>

          <Link href={`/sites/${site.siteId}/settings`} 
            title="Settings" 
            className={`p-1 rounded-sm aspect-square size-10 mx-auto flex items-center ${isSettingsActive && ('bg-gray-100')}`}
            >
            <TbSettings className="size-7 mx-auto transition-colors" />
          </Link>
        </div>
        {/* Add other core app navigation icons here in the future (e.g., social, settings) */}
      </aside>
      

      {/* The content (preview, editor, settings) renders here */}
      <main className="flex-1 ml-[60px] overflow-y-auto bg-white dark:bg-zinc-900">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
    </div>
  );
}