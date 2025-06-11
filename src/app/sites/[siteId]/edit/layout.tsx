// src/app/(publishing)/edit/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Eye, Home,  UploadCloud } from 'lucide-react';
import FileTree from '@/components/publishing/FileTree';
import NewCollectionDialog from '@/components/publishing/NewCollectionDialog';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { exportSiteToZip } from '@/lib/siteExporter';
import { slugify } from '@/lib/utils';
import { StructureNode, LayoutInfo } from '@/types'; // FIXED: Import LayoutInfo
import { getAvailableLayouts } from '@/lib/configHelpers'; // FIXED: Correct import path
import ErrorBoundary from '@/components/core/ErrorBoundary';
import { TbFilePlus, TbLayoutGrid } from "react-icons/tb";

const NEW_FILE_SLUG_MARKER = '_new';

export default function EditSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));
  const updateManifest = useAppStore((state) => state.updateManifest);
  const addNewCollection = useAppStore((state) => state.addNewCollection);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [activePath, setActivePath] = useState<string | undefined>();

  const siteStructure = useMemo(() => site?.manifest.structure || [], [site?.manifest.structure]);

  // FIXED: Replaced useEffect with a simpler useMemo. The helper function is synchronous.
  const availableCollectionLayouts = useMemo(() => {
    if (!site?.manifest) {
      return [];
    }
    // The getAvailableLayouts function now reads from the manifest itself.
    return getAvailableLayouts(site.manifest).filter((l: LayoutInfo) => l.type === 'collection');
  }, [site?.manifest]);


  // This useEffect correctly determines the active file in the sidebar tree.
  useEffect(() => {
    const pathSegments = pathname.split('/');
    if (pathname.includes('/edit/collection/')) {
        const slug = pathSegments[pathSegments.indexOf('collection') + 1];
        setActivePath(`content/${slug}`);
    } else if (pathname.includes('/edit/content/')) {
        // Correctly handle the root index page and nested pages
        const contentPath = pathname.substring(pathname.indexOf('/edit/content/') + 14).replace(/\/$/, '') || 'index';
        const pathWithExt = `content/${contentPath}.md`;
        setActivePath(site?.contentFiles.find(f => f.path === pathWithExt)?.path);
    } else {
        // If we are at the root of /edit, highlight the index file
        setActivePath('content/index.md');
    }
  }, [pathname, site?.contentFiles]);


   const handleStructureChange = useCallback((reorderedNodes: StructureNode[]) => {
      if (!site) return;
      const newManifest = { ...site.manifest, structure: reorderedNodes };
      updateManifest(siteId, newManifest);
  }, [site, siteId, updateManifest]);

  const handleNavigateToNewFile = (parentPath: string = 'content') => {
    const parentSlugPart = parentPath === 'content' ? '' : parentPath.replace(/^content\/?/, '');
    // Use the new route structure
    const newFileRoute = `/sites/${siteId}/edit/content/${parentSlugPart ? parentSlugPart + '/' : ''}${NEW_FILE_SLUG_MARKER}`;
    router.push(newFileRoute.replace(/\/\//g, '/'));
  };
  
   const handleCreateNewCollection = async (name: string, slug: string, layout: string) => {
    if (!site) return;
    await addNewCollection(siteId, name, slug, layout);
    toast.success(`Collection "${name}" created!`);
    router.push(`/sites/${siteId}/edit/collection/${slug}`);
  };
  


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
  const existingTopLevelSlugs = useMemo(() => site?.manifest.structure.map(c => c.slug) || [], [site?.manifest.structure]);

  if (!site) {
    return <div className="p-6">Loading editor...</div>;
  }

  const isSiteSettingsActive = pathname.startsWith(`/edit/${siteId}/settings/`);
  const isAppearanceSettingsActive = pathname.startsWith(`/edit/${siteId}/settings/appearance`);

  return (
    <div className='h-screen'>
   
    <div className="flex  bg-background w-full">
        
      <aside className="w-[280px] fixed top-[60px] border-r flex flex-col shrink-0 h-full">
    

        <div className='flex w-full justify-between items-center border-b py-2 px-3'>
          <h4 className='text-[11px] uppercase'>Content</h4>
          <div className='flex flex-row gap-2 items-center'>
            <Button variant="ghost" onClick={() => handleNavigateToNewFile('content')} className="!p-0.5 !m-0 h-3 hover:cursor-pointer">
              <TbFilePlus className="h-4 w-4" /> 
            </Button>
            <NewCollectionDialog 
                existingSlugs={existingTopLevelSlugs} 
                availableLayouts={availableCollectionLayouts}
                onSubmit={handleCreateNewCollection}
            >
              <Button variant="ghost" className="!p-0.5 !m-0 h-3 hover:cursor-pointer">

                <TbLayoutGrid className="h-4 w-4" />
              </Button>
            </NewCollectionDialog>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto py-2 pl-2 pr-3">
          <FileTree 
            nodes={siteStructure} 
            baseEditPath={`/sites/${siteId}/edit/`}
            activePath={activePath}
            onFileCreate={handleNavigateToNewFile} 
            onStructureChange={handleStructureChange}
          />
        </div>
 
        
        
        

        <div className="mt-auto space-y-2 pt-4 border-t shrink-0">
            <Button variant="default" onClick={handlePublishSite} disabled={isPublishing} className="w-full">
              <UploadCloud className="mr-2 h-4 w-4" /> {isPublishing ? 'Publishing...' : 'Publish Site'}
            </Button>
            <Button variant="outline" asChild className="w-full">
                <Link href={`/${siteId}`} target="_blank"><Eye className="mr-2 h-4 w-4" /> View Site</Link>
            </Button>
            <Button variant="ghost" asChild className="w-full">
              <Link href="/"><Home className="mr-2 h-4 w-4" /> App Dashboard</Link>
            </Button>
        </div>
      </aside>
      <div className='ml-[340px] w-full'>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        </div>
    </div>
    </div>
  );
}