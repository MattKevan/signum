// src/app/(publishing)/edit/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { FileText, Settings, Eye, PlusCircle, Home, FolderPlus } from 'lucide-react';
import { buildFileTree, TreeNode, isValidName } from '@/lib/fileTreeUtils';
import FileTree from '@/components/publishing/FileTree';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ParsedMarkdownFile, MarkdownFrontmatter } from '@/types'; // Import these
import { stringifyToMarkdown } from '@/lib/markdownParser'; // Import this

export default function EditSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const siteId = params.siteId as string;

  const site = useAppStore((state) => state.getSiteById(siteId));
  const addOrUpdateContentFileAction = useAppStore((state) => state.addOrUpdateContentFile);

  const fileTreeNodes = useMemo(() => {
    if (site?.contentFiles) {
      return buildFileTree(site.contentFiles);
    }
    return [];
  }, [site?.contentFiles]);

  const [currentOpenFile, setCurrentOpenFile] = useState<string | undefined>();

  useEffect(() => {
    // Determine current open file from pathname
    // Pathname: /edit/siteId/content/path/to/file
    const pathSegments = pathname.split('/content/');
    if (pathSegments.length > 1) {
        const filePath = pathSegments[1];
        if (filePath) {
            setCurrentOpenFile(`content/${filePath}.md`);
        } else {
            // It might be the index file at a folder level, or site config page
            // Check if it's the site config page
            if (pathname === `/edit/${siteId}`) {
                 setCurrentOpenFile(undefined); // No file selected for site config
            } else {
                // It's likely content/index.md or content/folder/index.md
                const basePath = pathSegments[0] + '/content/';
                const potentialIndexPath = pathname.substring(basePath.length);
                if (potentialIndexPath === '' || potentialIndexPath === '/') { // Root index.md
                    setCurrentOpenFile('content/index.md');
                } else if (!potentialIndexPath.endsWith('/')) { // Specific index.md in a folder
                     setCurrentOpenFile(`content/${potentialIndexPath}/index.md`);
                } else {
                    setCurrentOpenFile(`content/${potentialIndexPath}index.md`);
                }
            }
        }
    } else if (pathname === `/edit/${siteId}/content` || pathname === `/edit/${siteId}/content/`) {
        setCurrentOpenFile('content/index.md'); // Default to root index.md if at /content
    } else {
        setCurrentOpenFile(undefined); // No file selected (e.g., on site config page)
    }
  }, [pathname, siteId]);


  const handleCreateNewFile = async (parentPath: string = 'content') => {
    const rawFileName = prompt(`Enter new file name (without .md) in "${parentPath.replace('content/', '') || 'root'}" folder:`);
    if (!rawFileName || !isValidName(rawFileName)) {
      if(rawFileName !== null) toast.error("Invalid file name. It cannot be empty or contain slashes / invalid characters.");
      return;
    }
    const fileName = rawFileName.endsWith('.md') ? rawFileName : `${rawFileName}.md`;
    const newFilePath = parentPath === 'content' ? `content/${fileName}` : `${parentPath}/${fileName}`;

    // Check if file already exists
    if (site?.contentFiles.some(f => f.path === newFilePath)) {
        toast.error(`File "${newFilePath}" already exists.`);
        return;
    }

    const defaultTitle = rawFileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const defaultFrontmatter: MarkdownFrontmatter = { title: defaultTitle };
    const defaultBody = `# ${defaultTitle}\n\nStart writing your content here.`;
    const rawMarkdownContent = stringifyToMarkdown(defaultFrontmatter, defaultBody);

    try {
        await addOrUpdateContentFileAction(siteId, newFilePath, rawMarkdownContent);
        toast.success(`File "${fileName}" created in "${parentPath.replace('content/', '') || 'root'}"`);
        // Navigate to the new file for editing
        const editSlug = newFilePath.replace('content/', '').replace(/\.md$/, '');
        router.push(`/edit/${siteId}/content/${editSlug}`);
    } catch (error) {
        toast.error("Failed to create file.");
        console.error("Error creating file:", error);
    }
  };
  
  const handleCreateNewFolder = async (parentPath: string = 'content') => {
    const folderName = prompt(`Enter new folder name in "${parentPath.replace('content/', '') || 'root'}":`);
    if (!folderName || !isValidName(folderName)) {
        if(folderName !== null) toast.error("Invalid folder name. It cannot be empty or contain slashes / invalid characters.");
        return;
    }
    
    // To "create" a folder, we'll create a placeholder .keep file in it,
    // then immediately prompt to create a real file inside it.
    // This is a common pattern if the system doesn't explicitly store empty folders.
    // OR, simply adjust the UI to allow creating files under this new conceptual path.
    // For now, let's make folder creation mean "create a new file inside this new folder path".
    
    const newFolderPath = parentPath === 'content' ? `content/${folderName}` : `${parentPath}/${folderName}`;
    
    toast.info(`Folder "${folderName}" conceptually created. Now, let's create a file inside it.`);
    handleCreateNewFile(newFolderPath); // Prompt to create a file in the new folder path
  };


  if (!site) {
    return (
        <div className="flex items-center justify-center h-screen">
            <p>Loading site editor or site not found...</p>
            <Button variant="link" asChild className="ml-2"><Link href="/">Go Home</Link></Button>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-72 border-r bg-muted/40 p-4 flex flex-col">
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
        </nav>

        <div className="mb-2 flex justify-between items-center">
            <h3 className="text-sm font-semibold px-1">Content Files</h3>
            <div className="flex gap-1">
                <Button variant="ghost" size="iconSm" onClick={() => handleCreateNewFile('content')} title="New File in Root">
                    <FileText className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="iconSm" onClick={() => handleCreateNewFolder('content')} title="New Folder in Root">
                    <FolderPlus className="h-4 w-4" />
                </Button>
            </div>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-1 -mr-1"> {/* Added pr and -mr for scrollbar */}
          <FileTree 
            nodes={fileTreeNodes} 
            baseEditPath={`/edit/${siteId}/content`}
            currentOpenFile={currentOpenFile}
            onFileCreate={handleCreateNewFile} // Pass handler down
            onFolderCreate={handleCreateNewFolder} // Pass handler down
          />
        </div>

        <div className="mt-auto space-y-2 pt-4 border-t">
            <Button variant="outline" asChild className="w-full justify-start">
                <Link href={`/${siteId}`} target="_blank" rel="noopener noreferrer">
                    <Eye className="mr-2 h-4 w-4" /> View Site (Local)
                </Link>
            </Button>
            <Button variant="ghost" asChild className="w-full justify-start">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" /> App Dashboard
              </Link>
            </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}