// src/app/(browsing)/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react'; 
import * as localSiteFs from '@/lib/localSiteFs';
import { fetchRemoteSiteData } from '@/lib/remoteSiteFetcher';
import { LocalSiteData } from '@/types';
import { Home, ArrowLeft, Leaf, Settings, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REMOTE_SITE_ID_PREFIX = "remote@";

function cleanAndGetSiteId(rawParamValue: string | string[] | undefined): string {
    let idCandidate = '';
    if (Array.isArray(rawParamValue)) {
        idCandidate = rawParamValue[0] || ''; 
    } else if (typeof rawParamValue === 'string') {
        idCandidate = rawParamValue;
    }

    console.log(`[Layout] cleanAndGetSiteId - initial rawParamValue: "${idCandidate}"`);

    // Attempt to URL decode first, in case it's double-encoded or params hook didn't fully decode
    try {
        let decodedOnce = decodeURIComponent(idCandidate);
        console.log(`[Layout] cleanAndGetSiteId - after first decodeURIComponent: "${decodedOnce}"`);
        // If it still looks like it has quotes AND percent encoding, try decoding again
        // This is unusual, but let's try to be robust if quotes themselves were encoded
        if ((decodedOnce.startsWith('"') || decodedOnce.startsWith('%22')) && 
            (decodedOnce.endsWith('"') || decodedOnce.endsWith('%22')) &&
            decodedOnce.includes('%')) {
            
            let tempId = decodedOnce;
            if (tempId.startsWith('%22')) tempId = tempId.substring(3);
            if (tempId.endsWith('%22')) tempId = tempId.substring(0, tempId.length - 3);
            
            // Or simply, if it starts with " and ends with " after one decode, remove them
            if (tempId.startsWith('"') && tempId.endsWith('"')) {
                 tempId = tempId.substring(1, tempId.length - 1);
            }
            // Then decode again
            decodedOnce = decodeURIComponent(tempId);
            console.log(`[Layout] cleanAndGetSiteId - after second decodeURIComponent (if applicable): "${decodedOnce}"`);
        }
        idCandidate = decodedOnce;
    } catch (e) {
        console.warn(`[Layout] cleanAndGetSiteId - decodeURIComponent failed for "${idCandidate}", using as is. Error:`, e);
        // If decoding fails, use the idCandidate as is, it might already be decoded.
    }
    
    // Now, definitively remove leading/trailing quotes from the (potentially) decoded string
    if (typeof idCandidate === 'string' && idCandidate.startsWith('"') && idCandidate.endsWith('"')) {
        idCandidate = idCandidate.substring(1, idCandidate.length - 1);
        console.log(`[Layout] cleanAndGetSiteId - successfully removed quotes: "${idCandidate}"`);
    } else {
        console.log(`[Layout] cleanAndGetSiteId - no quotes to remove or not a string: "${idCandidate}"`);
    }
    
    return idCandidate;
}


function checkIsRemote(id: string): boolean {
  // This function now expects an ID that has had quotes and URL encoding dealt with
  console.log(`[Layout] checkIsRemote called with ID: "${id}", prefix: "${REMOTE_SITE_ID_PREFIX}"`);
  const result = id && id.startsWith(REMOTE_SITE_ID_PREFIX); 
  console.log(`[Layout] checkIsRemote result: ${result}`);
  return !!result; 
}

function decodeRemoteUrlFromCleanedSiteId(cleanedSiteId: string): string | null {
  // This function expects cleanedSiteId to be like "remote@http://127.0.0.1:8080"
  // The "http://..." part should NOT be URL encoded anymore.
  if (checkIsRemote(cleanedSiteId)) { // checkIsRemote needs the "remote@" prefix
    try {
      // The part after "remote@" is the actual URL, which should already be decoded.
      const actualUrl = cleanedSiteId.substring(REMOTE_SITE_ID_PREFIX.length);
      console.log(`[Layout] Extracted actual URL for remote site: "${actualUrl}"`);
      // Validate if it's a proper URL structure
      new URL(actualUrl); // This will throw if actualUrl is not a valid URL
      return actualUrl;
    } catch (e) {
      console.error("[Layout] Failed to parse or validate decoded remote URL:", cleanedSiteId, e);
      return null;
    }
  }
  console.log(`[Layout] decodeRemoteUrlFromCleanedSiteId: Cleaned ID "${cleanedSiteId}" is not a remote pattern.`);
  return null;
}

export default function SiteBrowsingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams(); // params.siteId might be "remote%40http%253A%252F%252F127.0.0.1%253A8080"
                              // or "\"remote@http%3A%2F%2F127.0.0.1%3A8080\""

  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isActuallyRemote, setIsActuallyRemote] = useState(false);
  const [actualRemoteBaseUrl, setActualRemoteBaseUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const siteIdFromParamsRaw = params.siteId as string; // Keep the raw one for display in errors/links
  const cleanedSiteId = useMemo(() => cleanAndGetSiteId(siteIdFromParamsRaw), [siteIdFromParamsRaw]);


  useEffect(() => {
    if (!cleanedSiteId) {
      // ... (same as before)
      console.log("[Layout] useEffect: No cleanedSiteId, setting not found.");
      setIsLoading(false);
      setSiteData(null);
      setErrorMessage("Site identifier is missing or invalid in the URL.");
      return;
    }
    
    console.log("[Layout] useEffect triggered. CLEANED siteId to process:", `"${cleanedSiteId}"`);

    let mounted = true;
    setIsLoading(true);
    setSiteData(undefined); 
    setErrorMessage(null);

    async function fetchLayoutData() {
      let fetchedSiteData: LocalSiteData | null = null;
      const isRemoteCheckResult = checkIsRemote(cleanedSiteId);
      console.log(`[Layout] Based on cleaned ID, isRemoteCheckResult for "${cleanedSiteId}": ${isRemoteCheckResult}`);

      if (isRemoteCheckResult) {
        console.log("[Layout] fetchLayoutData: Path taken for REMOTE site.");
        setIsActuallyRemote(true);
        // decodeRemoteUrlFromCleanedSiteId now expects a cleanedId like "remote@http://127.0.0.1:8080"
        const decodedAndValidatedUrl = decodeRemoteUrlFromCleanedSiteId(cleanedSiteId); 
        console.log("[Layout] fetchLayoutData: Decoded & Validated URL for remote fetch:", `"${decodedAndValidatedUrl}"`);
        setActualRemoteBaseUrl(decodedAndValidatedUrl); 
        
        if (decodedAndValidatedUrl) {
          fetchedSiteData = await fetchRemoteSiteData(decodedAndValidatedUrl);
          if (!fetchedSiteData) {
            setErrorMessage(`Failed to fetch remote site data from ${decodedAndValidatedUrl}. Check [RFS] logs.`);
          }
        } else {
          fetchedSiteData = null; 
          setErrorMessage(`Invalid remote site URL structure after cleaning ID: ${cleanedSiteId}`);
        }
      } else {
        // ... (local site logic remains the same, using cleanedSiteId)
        console.log("[Layout] fetchLayoutData: Path taken for LOCAL site.");
        setIsActuallyRemote(false);
        setActualRemoteBaseUrl(null);
        fetchedSiteData = await localSiteFs.getSiteById(cleanedSiteId);
        if (!fetchedSiteData) {
            setErrorMessage(`Local site with ID "${cleanedSiteId}" not found.`);
        }
      }

      if (!mounted) return;

      setSiteData(fetchedSiteData);
      setIsLoading(false);
      console.log("[Layout] fetchLayoutData finished. isLoading:", false, "siteData:", fetchedSiteData ? `Loaded (${fetchedSiteData.siteId})` : "Null");
    }

    fetchLayoutData();

    return () => {
      mounted = false;
    };
  }, [cleanedSiteId]); 


  // --- Render blocks (isLoading, !siteData, main layout) ---
  // The JSX for these blocks can remain the same, using `siteIdFromParamsRaw` for user-facing display of the ID
  // and `cleanedSiteId` or `siteConfig.title` for other internal display logic.
  // Example for error message:
  // {errorMessage || `The site (ID/URL: ${siteIdFromParamsRaw}) could not be loaded...`}

  if (isLoading) {
    return ( <div className="flex flex-col min-h-screen"> <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur"> <div className="container flex h-16 items-center justify-between"> <div className="flex items-center space-x-2"> <Leaf className="h-6 w-6 text-primary animate-pulse" /> <span className="text-xl font-semibold text-muted-foreground">Loading Site...</span> </div> <Button variant="outline" size="sm" asChild> <Link href="/" title="Back to Signum Dashboard"> <span className="flex items-center"> <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard </span> </Link> </Button> </div> </header> <main className="flex-grow w-full flex justify-center items-center"> <p>Loading layout...</p> </main> <footer className="border-t bg-muted/50 text-center py-4"> <p className="text-xs text-muted-foreground">Signum</p> </footer> </div> );
  }

  if (!siteData) { 
    return ( <div className="flex flex-col min-h-screen"> <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur"> <div className="container flex h-16 items-center justify-between"> <Link href="/" className="flex items-center space-x-2"> <Leaf className="h-7 w-7 text-primary" /> <span className="text-2xl font-bold text-foreground">Signum</span> </Link> <Button variant="outline" size="sm" asChild> <Link href="/"> <span className="flex items-center"> <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard </span> </Link> </Button> </div> </header> <main className="flex-grow container mx-auto px-4 py-8 text-center"> <div className="flex flex-col items-center"> <AlertTriangle className="h-12 w-12 text-destructive mb-4" /> <h1 className="text-2xl font-bold mb-2">Site Not Found</h1> <p className="text-muted-foreground max-w-md"> {errorMessage || `The site (ID/URL: ${siteIdFromParamsRaw /* Use raw param for display */}) could not be loaded. Please check the URL or try again later.`} </p> <Button variant="default" asChild className="mt-6"> <Link href="/">Go to Dashboard</Link> </Button> </div> </main> <footer className="border-t bg-muted/50 text-center py-4"> <p className="text-xs text-muted-foreground">Signum</p> </footer> </div> );
  }

  const siteConfig = siteData.config;
  const currentDisplaySiteId = siteIdFromParamsRaw || cleanedSiteId; 

  const navLinks = siteData.contentFiles
    .filter(file => file.path !== 'content/index.md')
    .map(file => {
      const slug = file.path.startsWith('content/') 
                   ? file.path.substring('content/'.length).replace(/\.md$/, '')
                   : file.path.replace(/\.md$/, '');
      return {
        href: `/${currentDisplaySiteId}/${slug}`,
        label: file.frontmatter.title || file.slug,
      };
    })
    .sort((a,b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="container flex h-16 items-center justify-between">
          <Link href={`/${currentDisplaySiteId}`} className="flex items-center space-x-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-foreground">
              {siteConfig?.title || cleanedSiteId}
            </span>
            {isActuallyRemote && actualRemoteBaseUrl && (
                <a href={actualRemoteBaseUrl} target="_blank" rel="noopener noreferrer" title={`Open original remote site: ${actualRemoteBaseUrl}`} className="ml-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </a>
            )}
          </Link>
          
          <nav className="hidden md:flex items-center space-x-1">
            <Button variant="ghost" size="sm" asChild>
                <Link href={`/${currentDisplaySiteId}`} title="Site Home">
                    <span className="flex items-center">
                        <Home className="h-4 w-4 mr-1" /> Home
                    </span>
                </Link>
            </Button>
            {navLinks.map(link => (
              <Button variant="ghost" size="sm" asChild key={link.href}>
                <Link href={link.href} title={link.label}>
                  {link.label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center">
            <Button variant="outline" size="sm" asChild className="ml-2">
                <Link href="/" title="Back to Signum Dashboard">
                    <span className="flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
                    </span>
                </Link>
            </Button>
            <div className="md:hidden ml-2"> 
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-grow w-full">
        {children}
      </main>
      
      <footer className="border-t bg-muted/50 text-center py-4">
        <p className="text-xs text-muted-foreground">
          Viewing site: {siteConfig?.title || cleanedSiteId} ({isActuallyRemote ? "Remote" : "Local"})
        </p>
      </footer>
    </div>
  );
}