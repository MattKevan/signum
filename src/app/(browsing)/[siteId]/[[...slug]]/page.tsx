// src/app/(browsing)/[siteId]/[[...slug]]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import { fetchRemoteSiteData } from '@/lib/remoteSiteFetcher';
// MarkdownRenderer is no longer used directly here for the main content if we pre-render to string
// import MarkdownRenderer from '@/components/browsing/MarkdownRenderer'; 
import { marked } from 'marked'; // Use marked directly for rendering body to string
import type { LocalSiteData, ParsedMarkdownFile as ParsedMarkdownFileType, SiteConfigFile } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CalendarDays, ArrowRight, ListChecks, FolderOpen } from 'lucide-react';
import { parseSiteIdentifier, type ParsedSiteIdentifier } from '@/lib/browsingUtils';
import Link from 'next/link';
import { cn } from '@/lib/utils'; // For combining classes

// Template partials for constructing the header and footer strings for preview
// (These are NOT React components, they return HTML strings)
import { renderHeader as renderThemeHeaderString } from '@/themes/default/partials/header';
import { renderFooter as renderThemeFooterString } from '@/themes/default/partials/footer';
import { renderArticleContent as renderThemeArticleString } from '@/themes/default/partials/article';
import { renderCollectionListContent as renderThemeCollectionListString } from '@/themes/default/partials/collection';


interface CollectionListItemReact extends Omit<ParsedMarkdownFileType, 'frontmatter' | 'content'> {
  frontmatter: ParsedMarkdownFileType['frontmatter'] & {
    date?: string;
    title: string;
  };
  itemLink: string;
  summaryOrContentTeaser: string; // For collection item preview
}

enum PageRenderType { Loading, SinglePageDisplay, CollectionListingDisplay, NotFound, Error }

const THEME_WRAPPER_CLASS = "signum-theme-default-wrapper"; // Consistent wrapper class

export default function CatchAllSitePage() {
  const paramsHook = useParams();
  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined);
  const [renderType, setRenderType] = useState<PageRenderType>(PageRenderType.Loading);
  const [pageHtmlContent, setPageHtmlContent] = useState<string>(""); // To store the fully rendered HTML string for the page
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageMetaTitle, setPageMetaTitle] = useState<string>("Loading...");
  const [parsedPageIdentifier, setParsedPageIdentifier] = useState<ParsedSiteIdentifier | null>(null);

  const siteIdParamValue = useMemo(() => paramsHook.siteId as string, [paramsHook.siteId]);
  const slugArray = useMemo(() => (paramsHook.slug as string[] | undefined) || [], [paramsHook.slug]);

  useEffect(() => {
    // ... (fetching siteData logic remains the same as your last working version) ...
    // When siteData and page type are determined, call a function to render HTML string
    setRenderType(PageRenderType.Loading);
    setPageHtmlContent(""); setErrorMessage(null); setPageMetaTitle("Loading...");

    const localParsedResult = parseSiteIdentifier(siteIdParamValue);
    if (!localParsedResult) { /* ... error handling ... */ return; }
    setParsedPageIdentifier(localParsedResult);

    async function processAndRenderSiteContent(validParsedResult: ParsedSiteIdentifier) {
      let fetchedSiteData: LocalSiteData | null = null;
      // ... Fetch siteData logic ...
      if (validParsedResult.isRemote && validParsedResult.remoteBaseUrl) {
        fetchedSiteData = await fetchRemoteSiteData(validParsedResult.remoteBaseUrl);
        if (!fetchedSiteData) setErrorMessage(`Failed to fetch remote: ${validParsedResult.remoteBaseUrl}.`);
      } else if (!validParsedResult.isRemote) {
        fetchedSiteData = await localSiteFs.getSiteById(validParsedResult.effectiveSiteId);
        if (!fetchedSiteData) setErrorMessage(`Local site "${validParsedResult.effectiveSiteId}" not found.`);
      }

      if (!fetchedSiteData) {
        setSiteData(null); setRenderType(PageRenderType.Error); setPageMetaTitle("Site Not Found"); return;
      }
      setSiteData(fetchedSiteData);

      // --- Determine Page Type and Render HTML String ---
      const currentSlugPath = slugArray.join('/');
      const contentFiles = fetchedSiteData.contentFiles.filter(f => !f.frontmatter.draft && f.frontmatter.status !== 'draft');
      const singlePagePath = `content/${currentSlugPath || 'index'}.md`.toLowerCase();
      const directFileMatch = contentFiles.find(f => f.path.toLowerCase() === singlePagePath);

      const siteRootPathForLinks = `/${validParsedResult.rawParam}/`.replace(/\/\//g, '/');
      const ssgNavLinks = getSsgNavLinks(fetchedSiteData, siteRootPathForLinks); // Use the same nav link logic as exporter
      const themeHeaderHtml = renderThemeHeaderString(fetchedSiteData.config, ssgNavLinks, siteRootPathForLinks);
      const themeFooterHtml = renderThemeFooterString(fetchedSiteData.config);
      let mainContentHtml = "";

      if (directFileMatch) {
        mainContentHtml = renderThemeArticleString(directFileMatch);
        setPageMetaTitle(directFileMatch.frontmatter.title || "Untitled Page");
        setRenderType(PageRenderType.SinglePageDisplay);
      } else {
        const itemsInThisFolder = contentFiles.filter(
          f => f.path.toLowerCase().startsWith(`content/${currentSlugPath}/`.toLowerCase()) && 
               f.path.toLowerCase() !== `content/${currentSlugPath}/index.md`.toLowerCase()
        );
        if (itemsInThisFolder.length > 0) {
          // Collection Listing
          const mappedItems: CollectionListItemReact[] = itemsInThisFolder
            .map(file => {
                const summary = file.frontmatter.summary || (marked.parse((file.content || '').substring(0, 180) + '...') as string);
                return {
                    ...file, // slug, path, frontmatter
                    itemLink: `${siteRootPathForLinks}${file.path.replace(/^content\//i, '').replace(/\.md$/i, '')}`.replace(/\/\//g, '/'),
                    summaryOrContentTeaser: summary,
                };
            })
            .sort((a, b) => new Date(b.frontmatter.date || 0).getTime() - new Date(a.frontmatter.date || 0).getTime());

          let collectionTitle = currentSlugPath.split('/').pop() || "Collection";
          const collectionConfig = fetchedSiteData.config.collections?.find(c => c.path === currentSlugPath.split('/').pop());
          if(collectionConfig?.nav_label) collectionTitle = collectionConfig.nav_label;
          else collectionTitle = collectionTitle.charAt(0).toUpperCase() + collectionTitle.slice(1);
          
          const collectionIndexFile = contentFiles.find(f => f.path.toLowerCase() === `content/${currentSlugPath}/index.md`.toLowerCase());
          const collectionIndexContentHtml = collectionIndexFile ? marked.parse(collectionIndexFile.content || '') as string : undefined;

          mainContentHtml = renderThemeCollectionListString(collectionTitle, mappedItems, collectionIndexContentHtml);
          setPageMetaTitle(collectionTitle);
          setRenderType(PageRenderType.CollectionListingDisplay);
        } else {
          setRenderType(PageRenderType.NotFound);
          setErrorMessage(`Content not found at: "${currentSlugPath || 'homepage'}"`);
          setPageMetaTitle("Page Not Found");
        }
      }
      setPageHtmlContent(`${themeHeaderHtml}<main class="site-content">${mainContentHtml}</main>${themeFooterHtml}`);
    }
    if (localParsedResult) processAndRenderSiteContent(localParsedResult);
  }, [siteIdParamValue, slugArray]); // Dependencies

  useEffect(() => { /* ... document.title update ... */ 
    if (renderType === PageRenderType.Loading) document.title = "Loading... | Signum";
    else {
        let title = pageMetaTitle;
        if (siteData?.config?.title) title += ` | ${siteData.config.title}`;
        else if (renderType === PageRenderType.Error || renderType === PageRenderType.NotFound) title += ` | Signum`;
        document.title = title;
    }
  }, [renderType, pageMetaTitle, siteData]);

  // --- Dynamic classes and styles for the wrapper ---
  const wrapperClasses = [THEME_WRAPPER_CLASS];
  const wrapperStyles: React.CSSProperties = {};

  if (siteData?.config) {
    if (siteData.config.theme === 'dark') wrapperClasses.push('theme-dark');
    else if (siteData.config.theme === 'auto') wrapperClasses.push('theme-auto');
    else wrapperClasses.push('theme-light');

    if (siteData.config.font_family === 'serif') {
      wrapperClasses.push('font-serif');
      wrapperStyles['--font-stack-active'] = 'var(--font-stack-serif)';
    } else if (siteData.config.font_family === 'monospace') {
      wrapperClasses.push('font-mono');
      wrapperStyles['--font-stack-active'] = 'var(--font-stack-mono)';
    } else {
      wrapperClasses.push('font-sans');
      wrapperStyles['--font-stack-active'] = 'var(--font-stack-sans)';
    }
    if (siteData.config.primary_color) {
      wrapperStyles['--primary-color'] = siteData.config.primary_color;
    }
  }
  
  // --- Render logic ---
  if (renderType === PageRenderType.Loading) { /* ... loading UI ... */ }
  if (renderType === PageRenderType.Error || renderType === PageRenderType.NotFound) { /* ... error/not found UI ... */ }

  // Main content render
  return (
    <div 
      className={cn(wrapperClasses)} 
      style={wrapperStyles}
      dangerouslySetInnerHTML={{ __html: pageHtmlContent }} // Inject the themed HTML string
    />
  );
}

// Helper to get SSG Nav Links (can be moved to a shared util if siteExporter also uses identical logic)
// Ensure this logic matches what siteExporter.ts uses for getSsgNavLinks
function getSsgNavLinks(siteData: LocalSiteData, siteRootPath: string): NavLinkItem[] {
    const navLinks: NavLinkItem[] = [];
    const homePath = siteRootPath.endsWith('/') ? siteRootPath : `${siteRootPath}/`;
    navLinks.push({ href: homePath, label: "Home", iconName: "home", isActive: false });
    const collections = new Map<string, {label: string}>();
    const topLevelPages = new Map<string, ParsedMarkdownFileType>();

    siteData.contentFiles.forEach(file => {
        if (file.frontmatter.draft || file.frontmatter.status === 'draft') return;
        const relativePath = file.path.replace(/^content\//i, '');
        const pathParts = relativePath.split('/');
        if (pathParts.length > 1 && pathParts[0].toLowerCase() !== 'index.md') {
            const collectionSlug = pathParts[0];
            if (!collections.has(collectionSlug)) {
                const collectionConfig = siteData.config.collections?.find(c => c.path === collectionSlug);
                collections.set(collectionSlug, {
                    label: collectionConfig?.nav_label || collectionSlug.charAt(0).toUpperCase() + collectionSlug.slice(1)
                });
            }
        } else if (pathParts.length === 1 && relativePath.toLowerCase() !== 'index.md') {
            const slug = relativePath.replace(/\.md$/i, '');
            topLevelPages.set(slug, file);
        }
    });
    topLevelPages.forEach((file, slug) => {
        navLinks.push({
            href: `${siteRootPath}${slug}`.replace(/\/\//g, '/'), // Live preview links to slugs, not .html
            label: file.frontmatter.title || slug, iconName: "file-text", isActive: false,
        });
    });
    collections.forEach((collectionData, collectionSlug) => {
        navLinks.push({
            href: `${siteRootPath}${collectionSlug}`.replace(/\/\//g, '/'), // Live preview links to folder slugs
            label: collectionData.label, iconName: "folder", isActive: false,
        });
    });
    return navLinks.filter((link, index, self) => index === self.findIndex((l) => (l.href === link.href)));
 }

// Placed loading/error returns at the end of the component for clarity
// These are fallback displays if the main return isn't reached due to these states.
if (renderType === PageRenderType.Loading) {
    return ( <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[300px]"><p>Loading content...</p></div> );
}
const siteHomeLinkForError = parsedPageIdentifier?.rawParam ? `/${parsedPageIdentifier.rawParam}` : '/';
if (renderType === PageRenderType.Error || renderType === PageRenderType.NotFound) {
    return ( <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center"> <div className="flex flex-col items-center"> <AlertTriangle className="h-12 w-12 text-destructive mb-4" /> <h1 className="text-2xl font-bold mb-2">{pageMetaTitle}</h1> <p className="text-muted-foreground max-w-md"> {errorMessage || "The requested content could not be loaded or found."} </p> <Button asChild variant="outline" className="mt-6"> <Link href={siteData ? siteHomeLinkForError : '/'}> {siteData ? 'Go to Site Home' : 'Go to Dashboard'} </Link> </Button> </div> </div> );
}