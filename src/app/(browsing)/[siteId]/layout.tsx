// src/app/(browsing)/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import { fetchRemoteSiteData } from '@/lib/remoteSiteFetcher';
import { LocalSiteData, ParsedMarkdownFile } from '@/types';
import { Home, ExternalLink, Menu, X, FileText, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseSiteIdentifier, ParsedSiteIdentifier } from '@/lib/browsingUtils';
import { cn } from '@/lib/utils';

interface NavLinkItem {
  href: string;
  label: string;
  icon?: React.ElementType;
  isActive?: boolean;
}

export default function SiteBrowsingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();

  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined);
  // ... (isLoading, errorMessage, parsedIdentifier, isMobileMenuOpen states remain the same) ...
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedIdentifier, setParsedIdentifier] = useState<ParsedSiteIdentifier | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const siteIdParamValue = useMemo(() => params.siteId as string, [params.siteId]);

  useEffect(() => {
    // ... (useEffect for fetching siteData remains the same as the last correct version) ...
    const localParsedResult = parseSiteIdentifier(siteIdParamValue);

    if (!localParsedResult || (localParsedResult.isRemote && !localParsedResult.remoteBaseUrl)) {
      setParsedIdentifier(null); setIsLoading(false); setSiteData(null);
      setErrorMessage(localParsedResult?.isRemote ? `Invalid remote site URL: ${localParsedResult.cleanedIdOrUrl}` : "Site ID invalid.");
      return;
    }
    setParsedIdentifier(localParsedResult);

    let mounted = true;
    setIsLoading(true); setSiteData(undefined); setErrorMessage(null);

    async function fetchLayoutData(validParsedResult: ParsedSiteIdentifier) {
      let fetchedSiteData: LocalSiteData | null = null;
      if (validParsedResult.isRemote && validParsedResult.remoteBaseUrl) {
        fetchedSiteData = await fetchRemoteSiteData(validParsedResult.remoteBaseUrl);
        if (!fetchedSiteData) setErrorMessage(`Failed to fetch remote: ${validParsedResult.remoteBaseUrl}.`);
      } else if (!validParsedResult.isRemote) {
        fetchedSiteData = await localSiteFs.getSiteById(validParsedResult.effectiveSiteId);
        if (!fetchedSiteData) setErrorMessage(`Local site "${validParsedResult.effectiveSiteId}" not found.`);
      }
      if (!mounted) return;
      setSiteData(fetchedSiteData);
      setIsLoading(false);
    }
    fetchLayoutData(localParsedResult);
    return () => { mounted = false; };
  }, [siteIdParamValue]);


  const navLinks: NavLinkItem[] = useMemo(() => {
    if (!siteData?.contentFiles || !parsedIdentifier) return [];

    const links: NavLinkItem[] = [];
    const topLevelPageSlugs = new Set<string>();
    const folderInfo: Record<string, { count: number, files: ParsedMarkdownFile[] }> = {};

    // --- Pass 1: Categorize files and count items in folders ---
    siteData.contentFiles.forEach(file => {
      if (file.frontmatter.draft) return;

      const relativePath = file.path.replace(/^content\//, '');
      const pathParts = relativePath.split('/');

      if (pathParts.length === 1 && relativePath.endsWith('.md') && relativePath !== 'index.md') {
        // Top-level page file (e.g., content/about.md)
        const slug = pathParts[0].replace(/\.md$/, '');
        topLevelPageSlugs.add(slug);
        // Store the file info for later to get title
        if (!folderInfo[slug]) folderInfo[slug] = { count: 0, files: [] }; // Ensure entry exists
        folderInfo[slug].files.push(file);


      } else if (pathParts.length > 1 && pathParts[0] !== '') {
        // File is in a subdirectory (e.g., content/blog/post1.md)
        const folderSlug = pathParts[0];
        if (!folderInfo[folderSlug]) {
          folderInfo[folderSlug] = { count: 0, files: [] };
        }
        if (relativePath.endsWith('.md')) { // Only count markdown files for this logic
            folderInfo[folderSlug].count++;
            folderInfo[folderSlug].files.push(file);
        }
      }
    });

    // --- Pass 2: Generate Nav Links ---
    // Home link
    const homeHref = `/${parsedIdentifier.rawParam}`;
    links.push({ href: homeHref, label: "Home", icon: Home, isActive: pathname === homeHref || pathname === `${homeHref}/` });

    // Top-level page links (that are not folders)
    topLevelPageSlugs.forEach(slug => {
        // Ensure this slug doesn't also represent a folder that would be treated as a collection/page
        if (folderInfo[slug] && folderInfo[slug].count === 0) { // It's a top-level file, not a folder with same name
            const fileForTitle = folderInfo[slug].files[0]; // Should be the page itself
            const href = `/${parsedIdentifier.rawParam}/${slug}`;
            links.push({
            href,
            label: fileForTitle?.frontmatter.title || slug.charAt(0).toUpperCase() + slug.slice(1),
            icon: FileText,
            isActive: pathname === href,
            });
        }
    });
    
    // Folder links (either single page folder or collection)
    Object.entries(folderInfo).forEach(([folderSlug, info]) => {
      if (topLevelPageSlugs.has(folderSlug) && info.count === 0) return; // Already handled as top-level page

      if (info.count > 0) { // It's a folder with content
        const href = `/${parsedIdentifier.rawParam}/${folderSlug}`;
        let label = folderSlug.charAt(0).toUpperCase() + folderSlug.slice(1);
        let icon = Columns; // Default to collection icon

        if (info.count === 1) {
          // If it's a single-page folder, the label might come from that single page's title
          label = info.files[0]?.frontmatter.title || label;
          icon = FileText; // Icon for single page
        }

        links.push({
          href,
          label,
          icon,
          isActive: pathname === href || pathname.startsWith(`${href}/`),
        });
      }
    });
    
    // Remove duplicates that might arise if a top-level page slug is same as a folder slug (folder takes precedence)
    const uniqueLinks = Array.from(new Map(links.map(link => [link.href, link])).values());

    return uniqueLinks.sort((a, b) => {
        if (a.label === "Home") return -1;
        if (b.label === "Home") return 1;
        return a.label.localeCompare(b.label);
    });

  }, [siteData, parsedIdentifier, pathname]);

  // ... (isLoading, error UI, SiteNavMenu, and main return structure remain similar to your last full version)
  if (isLoading) { return <div className="p-4 text-center">Loading site layout...</div>; }
  if (!siteData || !parsedIdentifier) { return <div className="p-4 text-center">{errorMessage || "Site not found or error loading layout."}</div>;}

  const siteConfig = siteData.config;
  const currentDisplaySiteId = parsedIdentifier.rawParam;

  const SiteNavMenu = ({ isMobile }: { isMobile?: boolean }) => (
    <>
      {navLinks.map(link => (
        <Button 
          variant="ghost" 
          size="sm" 
          asChild 
          key={link.href}
          className={cn(
            "justify-start",
            isMobile ? "w-full text-base py-3" : "md:w-auto", // Adjusted for better mobile feel
            link.isActive && "bg-accent text-accent-foreground hover:bg-accent/90"
          )}
        >
          <Link href={link.href} title={link.label} passHref onClick={() => setIsMobileMenuOpen(false)}>
            {link.icon && <link.icon className={cn("h-4 w-4 shrink-0", isMobile ? "mr-3" : "mr-1.5")} />}
            <span>{link.label}</span>
          </Link>
        </Button>
      ))}
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-16 md:top-0 z-30 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center"> {/* Increased height for better touch targets / spacing */}
          <Link href={`/${currentDisplaySiteId}`} className="flex items-center space-x-2 mr-auto" onClick={() => setIsMobileMenuOpen(false)}>
            <span className="text-xl font-semibold text-foreground truncate hover:text-primary transition-colors">
              {siteConfig?.title || parsedIdentifier.cleanedIdOrUrl}
            </span>
            {parsedIdentifier.isRemote && parsedIdentifier.remoteBaseUrl && (
                <a href={parsedIdentifier.remoteBaseUrl} target="_blank" rel="noopener noreferrer" title={`Open original remote site: ${parsedIdentifier.remoteBaseUrl}`} className="ml-1 flex-shrink-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </a>
            )}
          </Link>
          
          <nav className="hidden md:flex items-center space-x-1">
            <SiteNavMenu />
          </nav>

          <div className="md:hidden ml-2">
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu">
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
         {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-background shadow-lg"> {/* Added background and shadow for mobile menu */}
            <nav className="container flex flex-col space-y-1 py-3">
              <SiteNavMenu isMobile={true} />
            </nav>
          </div>
        )}
      </header>
      
      <main className="flex-grow w-full">
        {children}
      </main>
      
      <footer className="border-t bg-muted/10 py-6 text-center"> {/* Updated bg-muted/10 for subtlety */}
        <p className="text-sm text-muted-foreground">
          Viewing: {siteConfig?.title || parsedIdentifier.cleanedIdOrUrl} ({parsedIdentifier.isRemote ? "Remote" : "Local"})
        </p>
         <Link href="/" className="mt-1 inline-block text-sm text-primary hover:underline">
            Back to Signum Dashboard
          </Link>
      </footer>
    </div>
  );
}