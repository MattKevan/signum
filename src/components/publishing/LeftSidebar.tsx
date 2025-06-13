// src/components/publishing/LeftSidebar.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback, useEffect, useState } from 'react';

// --- Store and Component Imports ---
import { useAppStore } from '@/stores/useAppStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import FileTree from '@/components/publishing/FileTree';
import NewCollectionDialog from '@/components/publishing/NewCollectionDialog';

// --- Type, Util, and Config Imports ---
import type { StructureNode, LayoutInfo, ParsedMarkdownFile } from '@/types'; // Added ParsedMarkdownFile
import { getAvailableLayouts } from '@/lib/configHelpers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

// --- Icon Imports ---
import { Home, FilePlus, FolderPlus } from 'lucide-react';

/**
 * Renders the primary left sidebar for the site editor.
 * It displays the site's file structure, handles navigation,
 * and provides actions for creating new pages and collections.
 */
export default function LeftSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const siteId = params.siteId as string;

  // --- State & Store Hooks ---
  const [activePath, setActivePath] = useState<string | undefined>();
  
  const isLeftOpen = useUIStore((state) => state.sidebar.isLeftOpen);
  const toggleLeftSidebar = useUIStore((state) => state.sidebar.toggleLeftSidebar);
  const isDesktop = useUIStore((state) => state.screen.isDesktop);

  // FIX: Changed `getById` to the correct `getSiteById`
  const site = useAppStore((state) => state.getSiteById(siteId));
  const addNewCollection = useAppStore((state) => state.addNewCollection);
  const updateManifest = useAppStore((state) => state.updateManifest);
  
  // --- Memoized Values ---
  const siteStructure = useMemo(() => site?.manifest.structure || [], [site?.manifest.structure]);

  const availableCollectionLayouts = useMemo(() => {
    if (!site?.manifest) return [];
    return getAvailableLayouts(site.manifest).filter((l: LayoutInfo) => l.type === 'collection');
  }, [site?.manifest]);

  // FIX: Explicitly typed `c` as `StructureNode` to resolve implicit 'any' error.
  const existingTopLevelSlugs = useMemo(() => site?.manifest.structure.map((c: StructureNode) => c.slug) || [], [site?.manifest.structure]);

  // --- Effects ---
  // Determines which file/collection is currently active based on the URL
  useEffect(() => {
    // Guard to ensure contentFiles is loaded before proceeding.
    if (!site || !site.contentFiles) {
      return;
    }

    const pathSegments = pathname.split('/');
    let currentPath = '';

    if (pathname.includes('/edit/collection/')) {
        const slug = pathSegments[pathSegments.indexOf('collection') + 1];
        currentPath = `content/${slug}`;
    } else if (pathname.includes('/edit/content/')) {
        const contentSlug = pathname.substring(pathname.indexOf('/edit/content/') + 14).replace(/\/$/, '') || 'index';
        const pathWithExt = `content/${contentSlug}.md`;
        
        // FIX: Explicitly typed `f` as `ParsedMarkdownFile` to resolve implicit 'any' error.
        currentPath = site.contentFiles.find((f: ParsedMarkdownFile) => f.path === pathWithExt)?.path || pathWithExt;
    } else {
        // Fallback for root edit pages that redirect
        currentPath = 'content/index.md';
    }
    setActivePath(currentPath);
    
  }, [pathname, site, site?.contentFiles]);

  // --- Handlers ---
  const handleStructureChange = useCallback((reorderedNodes: StructureNode[]) => {
      if (!site) return;
      const newManifest = { ...site.manifest, structure: reorderedNodes };
      updateManifest(siteId, newManifest);
  }, [site, siteId, updateManifest]);

  const handleNavigateToNewFile = useCallback((parentPath: string = 'content') => {
    const parentSlugPart = parentPath === 'content' ? '' : parentPath.replace(/^content\/?/, '');
    const newFileRoute = `/sites/${siteId}/edit/content/${parentSlugPart ? parentSlugPart + '/' : ''}${NEW_FILE_SLUG_MARKER}`;
    router.push(newFileRoute.replace(/\/\//g, '/'));
    if (!isDesktop) toggleLeftSidebar();
  }, [siteId, router, isDesktop, toggleLeftSidebar]);
  
  const handleCreateNewCollection = useCallback(async (name: string, slug: string, layout: string) => {
    if (!site) return;
    await addNewCollection(siteId, name, slug, layout);
    toast.success(`Collection "${name}" created!`);
    router.push(`/sites/${siteId}/edit/collection/${slug}`);
    if (!isDesktop) toggleLeftSidebar();
  }, [site, siteId, addNewCollection, router, isDesktop, toggleLeftSidebar]);

  // Render a loading state or null if the site manifest hasn't even loaded yet.
  if (!site) {
    return null;
  }

  return (
    <>
      {/* Mobile-only overlay to close the sidebar when clicking outside */}
      {!isDesktop && (
        <div
          onClick={toggleLeftSidebar}
          className={cn(
            'fixed inset-0 z-40 bg-black/60 transition-opacity',
            isLeftOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        ></div>
      )}

      {/* The main sidebar container */}
      <div
        className={cn(
          'flex h-full flex-col'
        )}
      >
        <div className="flex px-3 py-1 shrink-0 items-center justify-between border-b ">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content</h4>
            <div className="flex items-center gap-1">
                <Button variant="ghost" className='size-6 p-2 rounded-sm' onClick={() => handleNavigateToNewFile('content')} title="New Page">
                    <FilePlus className="h-4 w-4" />
                </Button>
                <NewCollectionDialog 
                    existingSlugs={existingTopLevelSlugs} 
                    availableLayouts={availableCollectionLayouts}
                    onSubmit={handleCreateNewCollection}
                >
                    <Button variant="ghost"  className='size-6 p-2  rounded-sm' title="New Collection">
                        <FolderPlus className="h-4 w-4" />
                    </Button>
                </NewCollectionDialog>
            </div>
        </div>
        
        <div className="flex-grow overflow-y-auto px-2 py-4">
            <FileTree 
                nodes={siteStructure} 
                baseEditPath={`/sites/${siteId}/edit`}
                activePath={activePath}
                onFileCreate={handleNavigateToNewFile} 
                onStructureChange={handleStructureChange}
            />
        </div>

        <div className="mt-auto shrink-0 border-t p-2">
            <Button variant="ghost" asChild className="w-full justify-start gap-2">
                <Link href="/sites">
                    <Home className="h-4 w-4" /> App Dashboard
                </Link>
            </Button>
        </div>
      </div>
    </>
  );
}