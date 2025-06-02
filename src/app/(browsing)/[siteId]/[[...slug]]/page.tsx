// src/app/(browsing)/[siteId]/[[...slug]]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import { fetchRemoteSiteData } from '@/lib/remoteSiteFetcher';
import MarkdownRenderer from '@/components/browsing/MarkdownRenderer';
import { ParsedMarkdownFile, LocalSiteData } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

const REMOTE_SITE_ID_PREFIX_PAGE = "remote@"; // Use a distinct constant name if preferred

function checkIsRemotePage(id: string): boolean { // Renamed for clarity within this file
  console.log(`[Page] checkIsRemotePage called with ID: "${id}", prefix: "${REMOTE_SITE_ID_PREFIX_PAGE}"`);
  const result = id && id.startsWith(REMOTE_SITE_ID_PREFIX_PAGE);
  console.log(`[Page] checkIsRemotePage result: ${result}`);
  return !!result;
}

function decodeRemoteUrlFromSiteIdPage(siteIdFromUrl: string): string | null { // Renamed
  if (checkIsRemotePage(siteIdFromUrl)) {
    try {
      const encodedUrlPart = siteIdFromUrl.substring(REMOTE_SITE_ID_PREFIX_PAGE.length);
      const decoded = decodeURIComponent(encodedUrlPart);
      console.log(`[Page] Successfully decoded "${encodedUrlPart}" to "${decoded}"`);
      return decoded;
    } catch (e) {
      console.error("[Page] Failed to decode remote URL from siteId:", siteIdFromUrl, e);
      return null;
    }
  }
  console.log(`[Page] decodeRemoteUrlFromSiteIdPage: ID "${siteIdFromUrl}" is not a remote pattern.`);
  return null;
}

export default function SitePage() {
  const paramsHook = useParams();
  const router = useRouter();

  const [siteDataForPage, setSiteDataForPage] = useState<LocalSiteData | null | undefined>(undefined);
  const [contentFile, setContentFile] = useState<ParsedMarkdownFile | null | undefined>(undefined);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageSpecificErrorMessage, setPageSpecificErrorMessage] = useState<string | null>(null);
  const [displayTitle, setDisplayTitle] = useState<string>("Loading Page...");


  useEffect(() => {
    const siteIdFromParams = paramsHook.siteId as string;
    const slugArray = paramsHook.slug as string[] | undefined;

    if (!siteIdFromParams) {
      console.log("[Page] useEffect: No siteIdFromParams.");
      setIsLoadingPage(false); setSiteDataForPage(null); setContentFile(null);
      setPageSpecificErrorMessage("Site identifier missing."); setDisplayTitle("Error");
      return;
    }
    
    console.log("[Page] useEffect triggered. siteIdFromParams to process:", `"${siteIdFromParams}"`, "slugArray:", slugArray);

    let mounted = true;
    setIsLoadingPage(true);
    setSiteDataForPage(undefined); 
    setContentFile(undefined);
    setPageSpecificErrorMessage(null);

    async function fetchDataForPage() {
      let fetchedSiteData: LocalSiteData | null = null;
      const isRemoteCheckResult = checkIsRemotePage(siteIdFromParams); // Call refined checker
      
      if (isRemoteCheckResult) {
        console.log("[Page] fetchDataForPage: Path taken for REMOTE site.");
        const decodedUrl = decodeRemoteUrlFromSiteIdPage(siteIdFromParams);
        console.log("[Page] fetchDataForPage: Decoded URL for remote fetch:", `"${decodedUrl}"`);
        if (decodedUrl) {
          fetchedSiteData = await fetchRemoteSiteData(decodedUrl);
          if (!fetchedSiteData) {
            setPageSpecificErrorMessage(`Failed to fetch remote site data from ${decodedUrl}. Check layout console for [RFS] details.`);
          }
        } else {
          setPageSpecificErrorMessage(`Invalid remote site URL could not be decoded from ID: ${siteIdFromParams}`);
        }
      } else {
        console.log("[Page] fetchDataForPage: Path taken for LOCAL site.");
        fetchedSiteData = await localSiteFs.getSiteById(siteIdFromParams);
        if (!fetchedSiteData) {
            setPageSpecificErrorMessage(`Local site with ID "${siteIdFromParams}" not found.`);
        }
      }

      if (!mounted) return;

      if (!fetchedSiteData) {
        console.log("[Page] Site data ultimately not found for page.");
        setSiteDataForPage(null); setContentFile(null); setIsLoadingPage(false);
        setDisplayTitle("Site Not Found");
        // Error message should have been set above
        return;
      }
      console.log("[Page] Site data fetched for page:", fetchedSiteData.siteId);
      setSiteDataForPage(fetchedSiteData);

      const pageFilePath = `content/${slugArray && slugArray.length > 0 ? slugArray.join('/') : 'index'}.md`;
      console.log("[Page] Looking for page file path:", pageFilePath);
      const foundContentFile = fetchedSiteData.contentFiles.find(file => file.path === pageFilePath);

      if (!foundContentFile) {
        console.log("[Page] Specific content file not found:", pageFilePath);
        setContentFile(null);
        setPageSpecificErrorMessage(`Page "${slugArray ? slugArray.join('/') : 'index'}" not found within this site.`);
        setDisplayTitle("Page Not Found");
      } else {
        console.log("[Page] Content file found:", foundContentFile.path);
        setContentFile(foundContentFile);
        setDisplayTitle(foundContentFile.frontmatter.title || "Untitled Page");
      }
      setIsLoadingPage(false);
    }

    fetchDataForPage();

    return () => {
      mounted = false;
    };
  }, [paramsHook]);

  // ... (useEffect for document.title and render logic remains unchanged) ...
  useEffect(() => { if (!isLoadingPage && displayTitle && siteDataForPage?.config.title) { document.title = `${displayTitle} | ${siteDataForPage.config.title}`; } else if (!isLoadingPage && displayTitle) { document.title = displayTitle; } else if (!isLoadingPage && siteDataForPage?.config.title) { document.title = siteDataForPage.config.title; } else if (!isLoadingPage && !siteDataForPage) { document.title = "Site Not Found | Signum"; } else { document.title = "Signum"; } }, [isLoadingPage, displayTitle, siteDataForPage]);
  if (isLoadingPage) { return ( <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 flex justify-center items-center min-h-[300px]"> <p>Loading page content...</p> </div> ); }
  if (!siteDataForPage || !contentFile) { return ( <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center"> <div className="flex flex-col items-center"> <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" /> <h1 className="text-2xl font-bold mb-2">{displayTitle}</h1> <p className="text-muted-foreground max-w-md"> {pageSpecificErrorMessage || "The page you are looking for could not be loaded."} </p> <Button onClick={() => router.push(siteDataForPage ? `/${siteDataForPage.siteId}` : '/')} variant="outline" className="mt-6"> {siteDataForPage ? 'Go to Site Home' : 'Go to Dashboard'} </Button> </div> </div> ); }
  return ( <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8"> <article className="prose dark:prose-invert lg:prose-xl max-w-none"> <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white lg:text-5xl"> {contentFile.frontmatter.title || "Untitled Page"} </h1> {contentFile.frontmatter.date && ( <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-6"> Published on: {new Date(contentFile.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} </p> )} <MarkdownRenderer markdown={contentFile.content} /> </article> </div> );
}