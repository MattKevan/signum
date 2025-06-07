// src/app/(publishing)/edit/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Settings, Eye, Home, PlusCircle, FolderPlus, UploadCloud } from 'lucide-react';
import FileTree from '@/components/publishing/FileTree';
import NewCollectionDialog from '@/components/publishing/NewCollectionDialog';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { exportSiteToZip } from '@/lib/siteExporter';
import { slugify } from '@/lib/utils';
import { StructureNode } from '@/types';

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

  useEffect(() => {
    const pathSegments = pathname.split('/');
    if (pathname.includes('/collection/')) {
        const slug = pathSegments.find((v, i) => pathSegments[i-1] === 'collection');
        setActivePath(`content/${slug}`);
    } else if (pathname.includes('/content/')) {
        const contentPath = pathname.substring(pathname.indexOf('/content/') + 8).replace(/\/$/, '');
        const existingFile = site?.contentFiles.find(f => 
            f.path === `content/${contentPath}.md`
        );
        setActivePath(existingFile?.path);
    } else {
        setActivePath(undefined);
    }
  }, [pathname, site?.contentFiles]);


  const handleStructureChange = useCallback((reorderedNodes: StructureNode[]) => {
      if (!site) return;
      const newManifest = { ...site.manifest, structure: reorderedNodes };
      updateManifest(siteId, newManifest);
  }, [site, siteId, updateManifest]);

  const handleNavigateToNewFile = (parentPath: string = 'content') => {
    const parentSlugPart = parentPath === 'content' ? '' : parentPath.replace(/^content\/?/, '');
    const newFileRoute = `/edit/${siteId}/content/${parentSlugPart ? parentSlugPart + '/' : ''}${NEW_FILE_SLUG_MARKER}`;
    router.push(newFileRoute.replace(/\/\//g, '/'));
  };
  
  const handleCreateNewCollection = async (name: string, slug: string) => {
    if (!site) return;
    await addNewCollection(siteId, name, slug);
    toast.success(`Collection "${name}" created!`);
    router.push(`/edit/${siteId}/collection/${slug}`);
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
    return <div className="p-6">Loading site editor...</div>;
  }

  const isSiteConfigPageActive = pathname === `/edit/${siteId}/config`;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-72 border-r bg-muted/40 p-4 flex flex-col shrink-0">
        <h2 className="text-xl font-semibold truncate mb-4" title={site.manifest.title}>
            {site.manifest.title || 'Site Editor'}
        </h2>

        <nav className="flex flex-col space-y-1 mb-4">
          <Button variant="ghost" asChild className={`justify-start ${isSiteConfigPageActive ? 'bg-accent text-accent-foreground' : ''}`}>
            <Link href={`/edit/${siteId}/config`}><Settings className="mr-2 h-4 w-4" /> Site Config</Link>
          </Button>
           <Button variant="ghost" onClick={() => handleNavigateToNewFile('content')} className="justify-start">
              <PlusCircle className="mr-2 h-4 w-4" /> New Page
            </Button>
            <NewCollectionDialog existingSlugs={existingTopLevelSlugs} onSubmit={handleCreateNewCollection}>
                <Button variant="ghost" className="w-full justify-start">
                    <FolderPlus className="mr-2 h-4 w-4" /> New Collection
                </Button>
            </NewCollectionDialog>
        </nav>
        
        <div className="flex-grow overflow-y-auto pr-1 -mr-1">
          <FileTree 
            nodes={siteStructure} 
            baseEditPath={`/edit/${siteId}`}
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
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  );
}