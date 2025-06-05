// src/app/(publishing)/edit/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Settings, Eye, Home, PlusCircle, FolderPlus, UploadCloud } from 'lucide-react'; // Using UploadCloud for Publish
import { buildFileTree, type TreeNode, isValidName } from '@/lib/fileTreeUtils'; 
import FileTree from '@/components/publishing/FileTree';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { exportSiteToZip } from '@/lib/siteExporter'; // Re-import for Zip export
import { slugify } from '@/lib/utils'; // For default filename

const NEW_FILE_SLUG_MARKER = '_new';

export default function EditSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));
  const [isPublishing, setIsPublishing] = useState(false); // For the Publish button

  const fileTreeNodes = useMemo(() => {
    if (site?.contentFiles) {
      return buildFileTree(site.contentFiles); 
    }
    return [];
  }, [site?.contentFiles]);

  const [currentOpenFile, setCurrentOpenFile] = useState<string | undefined>();

  useEffect(() => {
    const isConfigPage = pathname === `/edit/${siteId}/config`;
    const isEditorRootPage = pathname === `/edit/${siteId}`; // This will redirect, but good to handle

    if (isConfigPage || isEditorRootPage) {
        setCurrentOpenFile(undefined); // No file selected on config or root editor page
        return;
    }

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
    } else {
        setCurrentOpenFile(undefined); // Not a content editing page
    }
  }, [pathname, siteId, site?.contentFiles]);

  const handleNavigateToNewFile = (parentPath: string = 'content') => {
    const parentSlugPart = parentPath === 'content' ? '' : parentPath.replace(/^content\/?/, '');
    const newFileRoute = `/edit/${siteId}/content/${parentSlugPart ? parentSlugPart + '/' : ''}${NEW_FILE_SLUG_MARKER}`;
    router.push(newFileRoute.replace(/\/\//g, '/'));
  };
  
  const handleCreateNewFolderInPath = async (parentPath: string = 'content') => {
    const folderName = prompt(`Enter new folder name in "${parentPath.replace('content/', '') || 'root'}":`);
    if (!folderName || !isValidName(folderName)) {
        if(folderName !== null) toast.error("Invalid folder name.");
        return;
    }
    toast.info(`Folder "${folderName}" is ready. Use "New Content File" to create files within this path.`);
  };

  const handlePublishSite = async () => {
    if (!site) {
      toast.error("Site data not found. Cannot publish.");
      return;
    }

    // Later, read site.config.publishingTarget or similar
    const publishingTarget = 'zip'; // Default to zip for now

    setIsPublishing(true);
    
    if (publishingTarget === 'zip') {
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
      }
    } else {
      // Handle other targets like Netlify, Signum Hosting
      toast.warn(`Publishing to "${publishingTarget}" is not yet implemented.`);
    }
    setIsPublishing(false);
  };

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
            <Link href={`/edit/${siteId}/config`}> {/* Updated Link */}
              <Settings className="mr-2 h-4 w-4" /> Site Config
            </Link>
          </Button>
           <Button variant="ghost" onClick={() => handleNavigateToNewFile('content')} className="justify-start">
              <PlusCircle className="mr-2 h-4 w-4" /> New Content File
            </Button>
            <Button variant="ghost" onClick={() => handleCreateNewFolderInPath('content')} className="justify-start">
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
            onFolderCreate={handleCreateNewFolderInPath}
          />
        </div>

        <div className="mt-auto space-y-2 pt-4 border-t shrink-0">
            <Button 
              variant="default" 
              onClick={handlePublishSite} 
              disabled={isPublishing}
              className="w-full justify-start"
            >
              <UploadCloud className="mr-2 h-4 w-4" /> 
              {isPublishing ? 'Publishing...' : 'Publish Site'}
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