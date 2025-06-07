// src/app/(browsing)/[siteId]/[[...slug]]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import { fetchRemoteSiteData } from '@/lib/remoteSiteFetcher';
import type { LocalSiteData } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { parseSiteIdentifier, type ParsedSiteIdentifier } from '@/lib/browsingUtils';
import Link from 'next/link';
import { generateNavLinks } from '@/lib/navigationUtils';
import { resolvePageContent, PageType } from '@/lib/pageResolver';
import { renderPageLayout } from '@/themes/default/layout';

enum PageRenderState { Loading, Display, NotFound, Error }

export default function CatchAllSitePage() {
  const paramsHook = useParams();
  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined);
  const [renderState, setRenderState] = useState<PageRenderState>(PageRenderState.Loading);
  const [pageHtmlContent, setPageHtmlContent] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageMetaTitle, setPageMetaTitle] = useState<string>("Loading...");
  const [parsedPageIdentifier, setParsedPageIdentifier] = useState<ParsedSiteIdentifier | null>(null);

  const siteIdParamValue = useMemo(() => paramsHook.siteId as string, [paramsHook.siteId]);
  const slugArray = useMemo(() => (paramsHook.slug as string[] | undefined) || [], [paramsHook.slug]);

  useEffect(() => {
    setRenderState(PageRenderState.Loading);
    const localParsedResult = parseSiteIdentifier(siteIdParamValue);
    if (!localParsedResult) {
        setErrorMessage("Invalid site identifier in URL.");
        setRenderState(PageRenderState.Error);
        return;
    }
    setParsedPageIdentifier(localParsedResult);

    async function processAndRenderSiteContent(validParsedResult: ParsedSiteIdentifier) {
      let fetchedSiteData: LocalSiteData | null = null;
      if (validParsedResult.isRemote && validParsedResult.remoteBaseUrl) {
        fetchedSiteData = await fetchRemoteSiteData(validParsedResult.remoteBaseUrl);
        if (!fetchedSiteData) setErrorMessage(`Failed to fetch remote site: ${validParsedResult.remoteBaseUrl}.`);
      } else if (!validParsedResult.isRemote) {
        fetchedSiteData = await localSiteFs.getSiteById(validParsedResult.effectiveSiteId);
        if (!fetchedSiteData) setErrorMessage(`Local site "${validParsedResult.effectiveSiteId}" not found.`);
      }

      if (!fetchedSiteData) {
        setSiteData(null); 
        setRenderState(PageRenderState.Error); 
        return;
      }
      setSiteData(fetchedSiteData);

      const resolution = resolvePageContent(fetchedSiteData, slugArray);
      const siteRootPathForLinks = `/${validParsedResult.rawParam}`;
      const navLinks = generateNavLinks(fetchedSiteData, {isStaticExport: false, siteRootPath: siteRootPathForLinks});
      
      switch (resolution.type) {
        case PageType.SinglePage:
        case PageType.CollectionListing:
          // THIS IS THE CORRECTED CALL
          const fullPageHtml = renderPageLayout(
            fetchedSiteData.manifest,
            fetchedSiteData.manifest.theme.config,
            resolution.pageTitle || 'Untitled',
            navLinks,
            resolution.mainContentHtml || ''
          );
          setPageHtmlContent(fullPageHtml);
          setPageMetaTitle(resolution.pageTitle || 'Untitled');
          setRenderState(PageRenderState.Display);
          break;
        
        case PageType.NotFound:
          setRenderState(PageRenderState.NotFound);
          setErrorMessage(resolution.errorMessage || "Page not found.");
          setPageMetaTitle("Page Not Found");
          break;
      }
    }
    processAndRenderSiteContent(localParsedResult);
  }, [siteIdParamValue, slugArray]);

  useEffect(() => {
    if (renderState === PageRenderState.Loading) {
        document.title = "Loading... | Signum";
    } else {
        let title = pageMetaTitle;
        if (siteData?.manifest?.title) title += ` | ${siteData.manifest.title}`;
        document.title = title;
    }
  }, [renderState, pageMetaTitle, siteData]);

  if (renderState === PageRenderState.Loading) {
    return <div className="container mx-auto p-8"><p>Loading content...</p></div>;
  }

  const siteHomeLinkForError = parsedPageIdentifier?.rawParam ? `/${parsedPageIdentifier.rawParam}` : '/';
  if (renderState === PageRenderState.Error || renderState === PageRenderState.NotFound) {
      return (
        <div className="container mx-auto p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{pageMetaTitle}</h1>
          <p className="text-muted-foreground">{errorMessage || "The requested content could not be loaded."}</p>
          <Button asChild variant="outline" className="mt-6">
              <Link href={siteData ? siteHomeLinkForError : '/'}>
                  {siteData ? 'Go to Site Home' : 'Go to Dashboard'}
              </Link>
          </Button>
        </div>
      );
  }

  return <div dangerouslySetInnerHTML={{ __html: pageHtmlContent }} />;
}