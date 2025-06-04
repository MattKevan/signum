// src/app/(publishing)/edit/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Settings, Eye, Home, PlusCircle, FolderPlus } from 'lucide-react'; // Added FolderPlus
import { buildFileTree, type TreeNode, isValidName } from '@/lib/fileTreeUtils'; 
import FileTree from '@/components/publishing/FileTree';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const NEW_FILE_SLUG_MARKER = '_new';

export default function EditSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));

  const fileTreeNodes = useMemo(() => {
    if (site?.contentFiles) {
      // Pass the full site.contentFiles array to buildFileTree
      // buildFileTree will internally use frontmatter.title for node names
      return buildFileTree(site.contentFiles); 
    }
    return [];
  }, [site?.contentFiles]);

  const [currentOpenFile, setCurrentOpenFile] = useState<string | undefined>();

  useEffect(() => {
    // ... (useEffect for currentOpenFile remains the same as previous correct version)
    const pathSegments = pathname.split('/content/');
    if (pathSegments.length > 1) {
        const filePathPart = pathSegments[1]; 
        if (filePathPart === NEW_FILE_SLUG_MARKER || filePathPart.endsWith(`/${NEW_FILE_SLUG_MARKER}`)) {
            setCurrentOpenFile(undefined);
        } else if (filePathPart) {
            let potentialPath = `content/${filePathPart}.md`;
            if (site?.contentFiles.some(f => f.path === potentialPath)) {
                setCurrentOpenFile(potentialPath);
            } else {
                potentialPath = `content/${filePathPart}/index.md`.replace(/\/\//g, '/');
                if (site?.contentFiles.some(f => f.path === potentialPath)) {
                    setCurrentOpenFile(potentialPath);
                } else {
                    setCurrentOpenFile(undefined);
                }
            }
        } else { 
             const potentialIndexPath = `content/${pathname.split('/content/')[1] || ''}index.md`.replace(/\/index\.md$/, '/index.md').replace('//index.md', '/index.md');
             if (site?.contentFiles.some(f => f.path === potentialIndexPath)) {
                setCurrentOpenFile(potentialIndexPath);
             } else if (pathname.endsWith('/content/') || pathname.endsWith('/content')) {
                setCurrentOpenFile('content/index.md');
             } else {
                setCurrentOpenFile(undefined);
             }
        }
    } else if (pathname === `/edit/${siteId}`) {
        setCurrentOpenFile(undefined); 
    } else {
        setCurrentOpenFile(undefined);
    }
  }, [pathname, siteId, site?.contentFiles]);

  const handleNavigateToNewFile = (parentPath: string = 'content') => {
    const parentSlugPart = parentPath === 'content' ? '' : parentPath.replace(/^content\/?/, '');
    const newFileRoute = `/edit/${siteId}/content/${parentSlugPart ? parentSlugPart + '/' : ''}${NEW_FILE_SLUG_MARKER}`;
    router.push(newFileRoute.replace(/\/\//g, '/'));
  };
  
  const handleCreateNewFolderInPath = async (parentPath: string = 'content') => { // Renamed for clarity
    const folderName = prompt(`Enter new folder name in "${parentPath.replace('content/', '') || 'root'}":`);
    if (!folderName || !isValidName(folderName)) {
        if(folderName !== null) toast.error("Invalid folder name. It cannot be empty or contain slashes / invalid characters.");
        return;
    }
    toast.info(`Folder "${folderName}" is ready. Use "New Content File" (e.g., from the File Tree actions for this folder) to create files within this path.`);
    // To make the new folder appear visually without a page reload,
    // we would need to update the 'site.contentFiles' in the Zustand store
    // with a conceptual marker or an empty .keep file, then have FileTree re-render.
    // For now, this is a UX hint; the folder physically exists when a file is saved into it.
  };

  if (!site) {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <p className="mb-2">Loading site editor or site not found...</p>
            <Button variant="link" asChild><Link href="/">Go Home</Link></Button>
        </div>
    );
  }

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
          <Button variant="ghost" asChild className={`justify-start ${pathname === `/edit/${siteId}` ? 'bg-accent text-accent-foreground' : ''}`}>
            <Link href={`/edit/${siteId}`}>
              <Settings className="mr-2 h-4 w-4" /> Site Config
            </Link>
          </Button>
           <Button variant="ghost" onClick={() => handleNavigateToNewFile('content')} className="justify-start">
              <PlusCircle className="mr-2 h-4 w-4" /> New Content File
            </Button>
            <Button variant="ghost" onClick={() => handleCreateNewFolderInPath('content')} className="justify-start"> {/* New Folder in Root */}
              <FolderPlus className="mr-2 h-4 w-4" /> New Root Folder
            </Button>
        </nav>

        <div className="mb-2 flex justify-between items-center">
            <h3 className="text-sm font-semibold px-1">Content Files</h3>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-1 -mr-1 custom-scrollbar">
          <FileTree 
            nodes={fileTreeNodes} 
            baseEditPath={`/edit/${siteId}/content`}
            currentOpenFile={currentOpenFile}
            onFileCreate={handleNavigateToNewFile} 
            onFolderCreate={handleCreateNewFolderInPath} // Use the renamed handler
          />
        </div>

        <div className="mt-auto space-y-2 pt-4 border-t shrink-0">
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
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}