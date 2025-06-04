// src/app/(browsing)/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import { fetchRemoteSiteData } from '@/lib/remoteSiteFetcher';
import type { LocalSiteData, ParsedMarkdownFile, NavLinkItem as NavLinkItemType } from '@/types'; // Use NavLinkItemType
import { Home, ExternalLink, Menu, X, FileText as FileTextIcon, Columns as ColumnsIcon } from 'lucide-react'; // Aliased icons
import { Button } from '@/components/ui/button';
import { parseSiteIdentifier, type ParsedSiteIdentifier } from '@/lib/browsingUtils';
import { cn } from '@/lib/utils';

// NavLinkItem is now imported from '@/types'

export default function SiteBrowsingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();

  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedIdentifier, setParsedIdentifier] = useState<ParsedSiteIdentifier | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const siteIdParamValue = useMemo(() => params.siteId as string, [params.siteId]);

  useEffect(() => {
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
        if (!fetchedSiteData && mounted) setErrorMessage(`Failed to fetch remote: ${validParsedResult.remoteBaseUrl}.`);
      } else if (!validParsedResult.isRemote) {
        fetchedSiteData = await localSiteFs.getSiteById(validParsedResult.effectiveSiteId);
        if (!fetchedSiteData && mounted) setErrorMessage(`Local site "${validParsedResult.effectiveSiteId}" not found.`);
      }
      if (!mounted) return;
      setSiteData(fetchedSiteData);
      setIsLoading(false);
    }
    if (localParsedResult) {
        fetchLayoutData(localParsedResult);
    }
    return () => { mounted = false; };
  }, [siteIdParamValue]);


  const navLinks: NavLinkItemType[] = useMemo(() => {
    if (!siteData?.contentFiles || !parsedIdentifier) return [];

    const links: NavLinkItemType[] = [];
    const topLevelPageSlugs = new Set<string>();
    const folderInfo: Record<string, { count: number, files: ParsedMarkdownFile[], representativeFile?: ParsedMarkdownFile }> = {};

    siteData.contentFiles.forEach(file => {
      if (file.frontmatter.draft || file.frontmatter.status === 'draft') return;

      const relativePath = file.path.replace(/^content\//, '');
      const pathParts = relativePath.split('/');

      if (pathParts.length === 1 && relativePath.endsWith('.md') && relativePath !== 'index.md') {
        const slug = pathParts[0].replace(/\.md$/, '');
        topLevelPageSlugs.add(slug);
        if (!folderInfo[slug]) folderInfo[slug] = { count: 0, files: [] };
        folderInfo[slug].files.push(file);
        folderInfo[slug].representativeFile = file;
      } else if (pathParts.length > 1 && pathParts[0] !== '') {
        const folderSlug = pathParts[0];
        if (!folderInfo[folderSlug]) {
          folderInfo[folderSlug] = { count: 0, files: [] };
        }
        if (relativePath.endsWith('.md')) {
            folderInfo[folderSlug].count++;
            folderInfo[folderSlug].files.push(file);
            if(relativePath === `${folderSlug}/index.md` || !folderInfo[folderSlug].representativeFile) {
                folderInfo[folderSlug].representativeFile = file;
            }
        }
      }
    });

    const homeHref = `/${parsedIdentifier.rawParam}`;
    links.push({ href: homeHref, label: "Home", iconComponent: Home, isActive: pathname === homeHref || pathname === `${homeHref}/` });

    topLevelPageSlugs.forEach(slug => {
        if (folderInfo[slug] && folderInfo[slug].count === 0 && folderInfo[slug].representativeFile) { 
            const fileForTitle = folderInfo[slug].representativeFile!;
            const href = `/${parsedIdentifier.rawParam}/${slug}`;
            links.push({
                href,
                label: fileForTitle.frontmatter.title || slug.charAt(0).toUpperCase() + slug.slice(1),
                iconComponent: FileTextIcon,
                isActive: pathname === href,
            });
        }
    });
    
    Object.entries(folderInfo).forEach(([folderSlug, info]) => {
      if (topLevelPageSlugs.has(folderSlug) && info.count === 0) return; 

      if (info.count > 0 && info.representativeFile) { 
        const href = `/${parsedIdentifier.rawParam}/${folderSlug}`;
        let label = folderSlug.charAt(0).toUpperCase() + folderSlug.slice(1);
        const indexFileInFolder = info.files.find(f => f.path === `content/${folderSlug}/index.md`);
        if (indexFileInFolder?.frontmatter.title) {
            label = indexFileInFolder.frontmatter.title;
        } else if (siteData.config.collections?.find(c => c.path === folderSlug)?.nav_label) {
            label = siteData.config.collections.find(c => c.path === folderSlug)!.nav_label!;
        } else if (info.count === 1 && info.files[0]?.frontmatter.title) {
            label = info.files[0].frontmatter.title;
        }
        
        links.push({
          href,
          label,
          iconComponent: ColumnsIcon,
          isActive: pathname === href || pathname.startsWith(`${href}/`),
        });
      }
    });
    
    const uniqueLinks = Array.from(new Map(links.map(link => [link.href, link])).values());

    return uniqueLinks.sort((a, b) => {
        if (a.label === "Home") return -1;
        if (b.label === "Home") return 1;
        return a.label.localeCompare(b.label);
    });

  }, [siteData, parsedIdentifier, pathname]);

  if (isLoading) { return <div className="p-4 text-center">Loading site layout...</div>; }
  if (!siteData || !parsedIdentifier) { return <div className="p-4 text-center">{errorMessage || "Site not found or error loading layout."}</div>;}

  const siteConfig = siteData.config;
  const currentDisplaySiteId = parsedIdentifier.rawParam;

  const SiteNavMenu = ({ isMobile }: { isMobile?: boolean }) => (
    <>
      {navLinks.map(link => {
        const IconComp = link.iconComponent;
        return (
            <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            key={link.href}
            className={cn(
                "justify-start",
                isMobile ? "w-full text-base py-3" : "md:w-auto",
                link.isActive && "bg-accent text-accent-foreground hover:bg-accent/90"
            )}
            >
            <Link href={link.href} title={link.label} passHref onClick={() => setIsMobileMenuOpen(false)}>
                {IconComp && <IconComp className={cn("h-4 w-4 shrink-0", isMobile ? "mr-3" : "mr-1.5")} />}
                <span>{link.label}</span>
            </Link>
            </Button>
        );
      })}
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-16 md:top-0 z-30 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
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
          <div className="md:hidden border-t bg-background shadow-lg">
            <nav className="container flex flex-col space-y-1 py-3">
              <SiteNavMenu isMobile={true} />
            </nav>
          </div>
        )}
      </header>
      
      <main className="flex-grow w-full">
        {children}
      </main>
      
      <footer className="border-t bg-muted/10 py-6 text-center">
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