// src/app/(browsing)/[siteId]/[[...slug]]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import { fetchRemoteSiteData } from '@/lib/remoteSiteFetcher';
import MarkdownRenderer from '@/components/browsing/MarkdownRenderer';
import { ParsedMarkdownFile, LocalSiteData } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CalendarDays, ArrowRight, ListChecks, FolderOpen } from 'lucide-react';
import { parseSiteIdentifier, ParsedSiteIdentifier } from '@/lib/browsingUtils';
import Link from 'next/link';

interface CollectionListItem extends Omit<ParsedMarkdownFile, 'frontmatter'> {
  frontmatter: ParsedMarkdownFile['frontmatter'] & {
    date?: string;
    title: string;
  };
  itemLink: string;
}

enum PageRenderType { // Renamed from PageType to avoid conflict if imported
  Loading,
  SinglePageDisplay,
  CollectionListingDisplay,
  NotFound,
  Error,
}

export default function CatchAllSitePage() {
  const paramsHook = useParams();

  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined);
  const [renderType, setRenderType] = useState<PageRenderType>(PageRenderType.Loading);
  
  const [singlePageContentFile, setSinglePageContentFile] = useState<ParsedMarkdownFile | null>(null);
  const [collectionItems, setCollectionItems] = useState<CollectionListItem[]>([]);
  const [collectionDisplayTitle, setCollectionDisplayTitle] = useState<string>(""); // For Collection Listing

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageMetaTitle, setPageMetaTitle] = useState<string>("Loading..."); // For document.title and UI headers
  const [parsedPageIdentifier, setParsedPageIdentifier] = useState<ParsedSiteIdentifier | null>(null);

  const siteIdParamValue = useMemo(() => paramsHook.siteId as string, [paramsHook.siteId]);
  const slugArray = useMemo(() => (paramsHook.slug as string[] | undefined) || [], [paramsHook.slug]);

  useEffect(() => {
    setRenderType(PageRenderType.Loading);
    setSinglePageContentFile(null); setCollectionItems([]); setErrorMessage(null); setPageMetaTitle("Loading...");

    const localParsedResult = parseSiteIdentifier(siteIdParamValue);
    
    if (!localParsedResult || (localParsedResult.isRemote && !localParsedResult.remoteBaseUrl)) {
      setParsedPageIdentifier(null); setRenderType(PageRenderType.Error);
      setErrorMessage(localParsedResult?.isRemote ? `Invalid remote URL: ${localParsedResult.cleanedIdOrUrl}` : "Site ID missing.");
      setPageMetaTitle("Error");
      return;
    }
    setParsedPageIdentifier(localParsedResult);

    let mounted = true;

    async function processSiteContent(validParsedResult: ParsedSiteIdentifier) {
      let fetchedSiteData: LocalSiteData | null = null;
      // ... (fetch siteData - same as before) ...
      if (validParsedResult.isRemote && validParsedResult.remoteBaseUrl) {
        fetchedSiteData = await fetchRemoteSiteData(validParsedResult.remoteBaseUrl);
        if (!fetchedSiteData) setErrorMessage(`Failed to fetch remote: ${validParsedResult.remoteBaseUrl}.`);
      } else if (!validParsedResult.isRemote) {
        fetchedSiteData = await localSiteFs.getSiteById(validParsedResult.effectiveSiteId);
        if (!fetchedSiteData) setErrorMessage(`Local site "${validParsedResult.effectiveSiteId}" not found.`);
      }

      if (!mounted) return;
      if (!fetchedSiteData) {
        setSiteData(null); setRenderType(PageRenderType.Error);
        setPageMetaTitle("Site Not Found");
        return;
      }
      setSiteData(fetchedSiteData);

      const currentSlugPath = slugArray.join('/'); // e.g., "" or "about" or "blog" or "blog/my-post"
      const contentFiles = fetchedSiteData.contentFiles.filter(f => !f.frontmatter.draft);

      // --- Determine Render Type ---

      // 1. Check for direct single page match (e.g., /about -> content/about.md; /blog/my-post -> content/blog/my-post.md)
      const singlePagePath = `content/${currentSlugPath || 'index'}.md`;
      const directFileMatch = contentFiles.find(f => f.path === singlePagePath);

      if (directFileMatch) {
        setSinglePageContentFile(directFileMatch);
        setRenderType(PageRenderType.SinglePageDisplay);
        setPageMetaTitle(directFileMatch.frontmatter.title || "Untitled Page");
        return;
      }

      // 2. If not a direct file, check if currentSlugPath refers to a folder
      //    A folder is identified if there are files starting with `content/${currentSlugPath}/`
      const itemsInThisFolder = contentFiles.filter(
        f => f.path.startsWith(`content/${currentSlugPath}/`) && 
             f.path !== `content/${currentSlugPath}/index.md` // Exclude index for listing
      );
      
      if (itemsInThisFolder.length > 0) {
        // This path is a folder containing items
        if (itemsInThisFolder.length === 1 && !slugArray.some(s => s.endsWith('.md'))) { 
            // Folder with exactly one non-draft .md file (and the URL doesn't look like it's trying to be a file itself)
            // Treat this single file as the page for this folder slug.
            const singleItemInFolder = itemsInThisFolder[0];
            // Check if the URL intended to target this specific file or the folder
            // If slugArray.join('/') is 'about' and file is 'content/about/page.md', render page.md
            setSinglePageContentFile(singleItemInFolder);
            setRenderType(PageRenderType.SinglePageDisplay);
            setPageMetaTitle(singleItemInFolder.frontmatter.title || currentSlugPath.split('/').pop() || "Page");

        } else {
            // Folder with 2+ items, or 1 item where URL seems to target the folder for listing
            const mappedItems: CollectionListItem[] = itemsInThisFolder
            .map(file => ({
                ...file,
                frontmatter: {
                title: file.frontmatter.title || file.slug,
                date: file.frontmatter.date,
                ...file.frontmatter,
                },
                itemLink: `/${validParsedResult.rawParam}/${file.path.replace(/^content\//, '').replace(/\.md$/, '')}`
            }))
            .sort((a, b) => {
                if (a.frontmatter.date && b.frontmatter.date) {
                return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();
                }
                return (a.frontmatter.title || '').localeCompare(b.frontmatter.title || '');
            });

            setCollectionItems(mappedItems);
            const title = currentSlugPath.split('/').pop() || "Collection";
            setCollectionDisplayTitle(title.charAt(0).toUpperCase() + title.slice(1));
            setPageMetaTitle(collectionDisplayTitle); // Title for the listing page itself
            setRenderType(PageRenderType.CollectionListingDisplay);
        }
      } else {
        // No direct file, no items in folder
        setRenderType(PageRenderType.NotFound);
        setErrorMessage(`Content not found at: "${currentSlugPath || 'homepage'}"`);
        setPageMetaTitle("Page Not Found");
      }
    }

    if (localParsedResult) { // Ensure localParsedResult is not null before calling
        processSiteContent(localParsedResult);
    }
    return () => { mounted = false; };
  }, [siteIdParamValue, slugArray, collectionDisplayTitle]); // Added collectionDisplayTitle

  useEffect(() => {
    // ... (document.title update logic as before, using pageMetaTitle) ...
    if (renderType === PageRenderType.Loading) {
        document.title = "Loading... | Signum";
        return;
    }
    let title = pageMetaTitle;
    if (siteData?.config?.title) {
        title += ` | ${siteData.config.title}`;
    } else if (renderType === PageRenderType.Error || renderType === PageRenderType.NotFound) {
        title += ` | Signum`;
    }
    document.title = title;
  }, [renderType, pageMetaTitle, siteData]);

  // --- Render logic based on renderType ---
  if (renderType === PageRenderType.Loading) { /* ... loading UI ... */ }
  const siteHomeLinkForError = parsedPageIdentifier?.rawParam ? `/${parsedPageIdentifier.rawParam}` : '/';
  if (renderType === PageRenderType.Error || renderType === PageRenderType.NotFound) { /* ... error/not found UI ... */ }
  if (renderType === PageRenderType.SinglePageDisplay && singlePageContentFile) { /* ... single page render UI ... */ }
  if (renderType === PageRenderType.CollectionListingDisplay) { /* ... collection listing render UI ... */ }
  
  // Re-add full render blocks for brevity, they are similar to previous version
  // Make sure to use `singlePageContentFile` for single page and `collectionItems` for listing.

  if (renderType === PageRenderType.Loading) {
    return ( <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[300px]"><p>Loading content...</p></div> );
  }

  if (renderType === PageRenderType.Error || renderType === PageRenderType.NotFound) {
    return ( <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center"> <div className="flex flex-col items-center"> <AlertTriangle className="h-12 w-12 text-destructive mb-4" /> <h1 className="text-2xl font-bold mb-2">{pageMetaTitle}</h1> <p className="text-muted-foreground max-w-md"> {errorMessage || "The requested content could not be loaded or found."} </p> <Button asChild variant="outline" className="mt-6"> <Link href={siteData ? siteHomeLinkForError : '/'}> {siteData ? 'Go to Site Home' : 'Go to Dashboard'} </Link> </Button> </div> </div> );
  }

  if (renderType === PageRenderType.SinglePageDisplay && singlePageContentFile) {
    return (
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <article className="prose dark:prose-invert lg:prose-xl max-w-none">
          <header className="mb-8">
              <h1 className="mb-2 text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
              {singlePageContentFile.frontmatter.title || "Untitled Page"}
              </h1>
              {singlePageContentFile.frontmatter.date && (
              <p className="text-base font-medium text-muted-foreground">
                  Published on: {new Date(singlePageContentFile.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              )}
          </header>
          <MarkdownRenderer markdown={singlePageContentFile.content} />
        </article>
      </div>
    );
  }

  if (renderType === PageRenderType.CollectionListingDisplay) {
    return (
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 pb-4 border-b">
          <div className="flex items-center space-x-3">
              <FolderOpen className="h-10 w-10 text-primary" /> {/* Consistent Icon */}
              <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
              {collectionDisplayTitle}
              </h1>
          </div>
          {siteData?.config.title && ( // Ensure siteData exists
            <p className="text-lg text-muted-foreground mt-2">
              From site: <Link href={parsedPageIdentifier?.rawParam ? `/${parsedPageIdentifier.rawParam}` : '/'} className="hover:underline text-primary font-medium">{siteData.config.title}</Link>
            </p>
          )}
        </div>

        {collectionItems.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg bg-card">
            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No Items Found</h2>
            <p className="text-muted-foreground">
              {errorMessage || `There are no items in this collection.`}
            </p>
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {collectionItems.map((item) => {
            // ... (item rendering - same as before) ...
            const itemDate = item.frontmatter.date ? new Date(item.frontmatter.date) : null;
            const isValidDate = itemDate && itemDate.getFullYear() > 1970;
            return (
              <article key={item.path} className="flex flex-col p-6 bg-card border border-border rounded-lg shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex-grow">
                  <h2 className="text-xl font-semibold mb-2 leading-tight">
                    <Link href={item.itemLink} className="hover:text-primary transition-colors">
                      {item.frontmatter.title}
                    </Link>
                  </h2>
                  {isValidDate && (
                    <p className="text-xs text-muted-foreground mb-3 flex items-center">
                      <CalendarDays className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                      {itemDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-4 leading-relaxed">
                    {item.frontmatter.summary || item.content.substring(0, 180).replace(/#.*$/gm, '').replace(/[\*\`\[\]]/g, '').trim() + '...'}
                  </p>
                </div>
                <div className="mt-auto">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={item.itemLink}>
                      View Item <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }
  
  return <div className="p-4 text-center">Unable to determine content type.</div>;
}