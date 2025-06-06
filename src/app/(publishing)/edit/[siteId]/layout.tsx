// src/app/(publishing)/edit/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Settings, Eye, Home, PlusCircle, FolderPlus, UploadCloud } from 'lucide-react';
import { buildFileTree, type TreeNode } from '@/lib/fileTreeUtils'; 
import FileTree from '@/components/publishing/FileTree';
import NewCollectionDialog from '@/components/publishing/NewCollectionDialog';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { exportSiteToZip } from '@/lib/siteExporter';
import { slugify } from '@/lib/utils';
import { NavItem } from '@/types';

const NEW_FILE_SLUG_MARKER = '_new';

const flattenTreeToNavItems = (nodes: TreeNode[]): NavItem[] => {
    const list: NavItem[] = []; // Use const as it's not reassigned
    nodes.forEach((node, index) => {
        const itemPath = node.path.replace('content/', '').replace('.md', '');
        const navItem: NavItem = {
            type: node.type === 'file' ? 'page' : node.type as 'collection' | 'folder',
            path: itemPath,
            order: index,
            children: node.children ? flattenTreeToNavItems(node.children) : [],
        };
        list.push(navItem);
    });
    return list;
};


export default function EditSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));
  const updateSiteStructure = useAppStore((state) => state.updateSiteStructure); // Get correct action
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [localNodes, setLocalNodes] = useState<TreeNode[]>([]);
  const [activePath, setActivePath] = useState<string | undefined>();

  useEffect(() => {
    if (site?.contentFiles && site.config) {
      const builtNodes = buildFileTree(site.config, site.contentFiles);
      setLocalNodes(builtNodes);
    } else {
      setLocalNodes([]);
    }
  }, [site]);

  useEffect(() => {
    const pathSegments = pathname.split('/');
    if (pathname.includes('/collection/')) {
        const collectionName = pathSegments.find((v, i) => pathSegments[i-1] === 'collection');
        if (collectionName) setActivePath(`content/${collectionName}`);
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

  const handleStructureChange = useCallback((reorderedNodes: TreeNode[]) => {
      if (!site) return;
      
      setLocalNodes(reorderedNodes);

      const newNavItems = flattenTreeToNavItems(reorderedNodes);
      
      updateSiteStructure(siteId, newNavItems); 
  }, [site, siteId, updateSiteStructure]);


  const handleNavigateToNewFile = (parentPath: string = 'content') => {
    const parentSlugPart = parentPath === 'content' ? '' : parentPath.replace(/^content\/?/, '');
    const newFileRoute = `/edit/${siteId}/content/${parentSlugPart ? parentSlugPart + '/' : ''}${NEW_FILE_SLUG_MARKER}`;
    router.push(newFileRoute.replace(/\/\//g, '/'));
  };
  
  const handleCreateNewCollection = async (name: string, slug: string) => {
    if (!site) return;

    const newCollectionConfig = {
        path: slug, nav_label: name, description: '',
        sort_by: 'date', sort_order: 'desc' as const,
    };
    
    const newNavItem: NavItem = {
        type: 'collection', path: slug,
        order: site.config.nav_items?.length || 0,
    };

    const newConfig = {
        ...site.config,
        collections: [...(site.config.collections || []), newCollectionConfig],
        nav_items: [...(site.config.nav_items || []), newNavItem],
    };
    // CORRECTED: Call the correct state update function
    await updateSiteStructure(siteId, newConfig.nav_items);
    
    toast.success(`Collection "${name}" created!`);
    router.push(`/edit/${siteId}/collection/${slug}`);
  };

  const handlePublishSite = async () => {
    // ... This function is unchanged
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
      link.download = `${slugify(site.config.title || 'signum-site')}.zip`;
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
  
  const existingCollectionPaths = useMemo(() => site?.config.collections?.map(c => c.path) || [], [site?.config.collections]);

  if (!site) {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <p className="mb-2">Loading site editor or site not found...</p>
            <Button variant="link" asChild><Link href="/">Go Home</Link></Button>
        </div>
    );
  }

  const isSiteConfigPageActive = pathname === `/edit/${siteId}/config`;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-72 border-r bg-muted/40 p-4 flex flex-col shrink-0">
        <div className="mb-4">
            <h2 className="text-xl font-semibold truncate" title={site.config.title}>
                {site.config.title || 'Site Editor'}
            </h2>
            <p className="text-xs text-muted-foreground truncate" title={siteId}>ID: {siteId}</p>
        </div>

        <nav className="flex flex-col space-y-1 mb-4">
          <Button variant="ghost" asChild className={`justify-start ${isSiteConfigPageActive ? 'bg-accent text-accent-foreground' : ''}`}>
            <Link href={`/edit/${siteId}/config`}>
              <Settings className="mr-2 h-4 w-4" /> Site Config
            </Link>
          </Button>
           <Button variant="ghost" onClick={() => handleNavigateToNewFile('content')} className="justify-start">
              <PlusCircle className="mr-2 h-4 w-4" /> New Content File
            </Button>
            <NewCollectionDialog existingCollectionPaths={existingCollectionPaths} onSubmit={handleCreateNewCollection}>
                <Button variant="ghost" className="w-full justify-start">
                    <FolderPlus className="mr-2 h-4 w-4" /> New Collection
                </Button>
            </NewCollectionDialog>
        </nav>

        <div className="mb-2 flex justify-between items-center">
            <h3 className="text-sm font-semibold px-1">Site Structure</h3>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-1 -mr-1 custom-scrollbar">
          <FileTree 
            nodes={localNodes} 
            baseEditPath={`/edit/${siteId}`}
            activePath={activePath}
            onFileCreate={handleNavigateToNewFile} 
            onStructureChange={handleStructureChange} // CORRECTED: Prop name matches component
          />
        </div>

        <div className="mt-auto space-y-2 pt-4 border-t shrink-0">
            <Button variant="default" onClick={handlePublishSite} disabled={isPublishing} className="w-full justify-start">
              <UploadCloud className="mr-2 h-4 w-4" /> {isPublishing ? 'Publishing...' : 'Publish Site'}
            </Button>
            <Button variant="outline" asChild className="w-full justify-start">
                <Link href={`/${siteId}`} target="_blank" rel="noopener noreferrer">
                    <Eye className="mr-2 h-4 w-4" /> View Site (Live)
                </Link>
            </Button>
            <Button variant="ghost" asChild className="w-full justify-start">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" /> App Dashboard
              </Link>
            </Button>
        </div>
      </aside>
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  );
}