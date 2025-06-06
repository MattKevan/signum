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
import { cn } from '@/lib/utils';
import { generateNavLinks } from '@/lib/navigationUtils';
import { resolvePageContent, PageType } from '@/lib/pageResolver';
import { renderHeader as renderThemeHeaderString } from '@/themes/default/partials/header';
import { renderFooter as renderThemeFooterString } from '@/themes/default/partials/footer';

enum PageRenderState { Loading, Display, NotFound, Error }

const THEME_WRAPPER_CLASS = "signum-theme-default-wrapper"; // Consistent wrapper class

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
    setPageHtmlContent(""); 
    setErrorMessage(null); 
    setPageMetaTitle("Loading...");

    const localParsedResult = parseSiteIdentifier(siteIdParamValue);
    if (!localParsedResult) {
        setErrorMessage("Invalid site identifier in URL.");
        setRenderState(PageRenderState.Error);
        setPageMetaTitle("Error");
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
        setPageMetaTitle("Site Not Found"); 
        return;
      }
      setSiteData(fetchedSiteData);

      // --- Use shared resolvers for content and navigation ---
      const resolution = resolvePageContent(fetchedSiteData, slugArray);
      const siteRootPathForLinks = `/${validParsedResult.rawParam}/`.replace(/\/\//g, '/');
      const navLinks = generateNavLinks(fetchedSiteData, {isStaticExport: false, siteRootPath: siteRootPathForLinks});
      
      const themeHeaderHtml = renderThemeHeaderString(fetchedSiteData.config, navLinks, siteRootPathForLinks);
      const themeFooterHtml = renderThemeFooterString(fetchedSiteData.config);

      switch (resolution.type) {
        case PageType.SinglePage:
        case PageType.CollectionListing:
          setPageHtmlContent(`${themeHeaderHtml}<main class="site-content">${resolution.mainContentHtml}</main>${themeFooterHtml}`);
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
        if (siteData?.config?.title) title += ` | ${siteData.config.title}`;
        document.title = title;
    }
  }, [renderState, pageMetaTitle, siteData]);

  const wrapperClasses = [THEME_WRAPPER_CLASS];
  const wrapperStyles: React.CSSProperties = {};

  if (siteData?.config) {
    if (siteData.config.theme === 'dark') wrapperClasses.push('theme-dark');
    else if (siteData.config.theme === 'auto') wrapperClasses.push('theme-auto');
    else wrapperClasses.push('theme-light');

    if (siteData.config.font_family === 'serif') {
      wrapperClasses.push('font-serif');
    } else if (siteData.config.font_family === 'monospace') {
      wrapperClasses.push('font-mono');
    } else {
      wrapperClasses.push('font-sans');
    }
    if (siteData.config.primary_color) {
      wrapperStyles['--primary-color'] = siteData.config.primary_color;
    }
  }
  
  // --- Render logic ---
  if (renderState === PageRenderState.Loading) {
    return <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[300px]"><p>Loading content...</p></div>;
  }

  const siteHomeLinkForError = parsedPageIdentifier?.rawParam ? `/${parsedPageIdentifier.rawParam}` : '/';
  if (renderState === PageRenderState.Error || renderState === PageRenderState.NotFound) {
      return (
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center">
            <div className="flex flex-col items-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <h1 className="text-2xl font-bold mb-2">{pageMetaTitle}</h1>
                <p className="text-muted-foreground max-w-md">
                    {errorMessage || "The requested content could not be loaded or found."}
                </p>
                <Button asChild variant="outline" className="mt-6">
                    <Link href={siteData ? siteHomeLinkForError : '/'}>
                        {siteData ? 'Go to Site Home' : 'Go to Dashboard'}
                    </Link>
                </Button>
            </div>
        </div>
      );
  }

  return (
    <div 
      className={cn(wrapperClasses)} 
      style={wrapperStyles}
      dangerouslySetInnerHTML={{ __html: pageHtmlContent }}
    />
  );
}