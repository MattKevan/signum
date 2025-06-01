// src/app/(browsing)/[siteId]/layout.tsx
'use client'; // <<< MAKE IT A CLIENT COMPONENT

import Link from 'next/link';
import { useParams, notFound, useRouter } from 'next/navigation'; // Import useParams, useRouter
import { useEffect, useState } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import { SiteConfigFile, ParsedMarkdownFile, LocalSiteData } from '@/types';
import { Home, ArrowLeft, Leaf, Settings } from 'lucide-react'; // Added Settings for mobile menu placeholder
import { Button } from '@/components/ui/button';

// No SiteBrowsingLayoutProps needed as params are fetched via hook

export default function SiteBrowsingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();

  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined); // undefined: loading, null: not found
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const siteId = params.siteId as string;
    
    // Log params when they are available client-side
    console.log("Client-side SiteBrowsingLayout received params:", params);

    if (!siteId || typeof siteId !== 'string') {
      console.error("Client-side SiteBrowsingLayout: Invalid or missing siteId", params);
      setSiteData(null); // Mark as not found
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    async function fetchLayoutData() {
      try {
        const fetchedSiteData = await localSiteFs.getSiteById(siteId);
        if (!mounted) return;

        if (!fetchedSiteData) {
          setSiteData(null); // Site not found
        } else {
          setSiteData(fetchedSiteData);
        }
      } catch (error) {
        console.error("Error fetching site data for layout client-side:", error);
        setSiteData(null); // Indicate error/not found
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchLayoutData();

    return () => {
      mounted = false; // Cleanup
    };
  }, [params]); // Re-fetch if params (siteId) change

  // --- Conditional Rendering based on state ---

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Basic Header Shell during loading */}
        <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Leaf className="h-6 w-6 text-primary animate-pulse" />
              <span className="text-xl font-semibold text-muted-foreground">Loading Site...</span>
            </div>
            <Button variant="outline" size="sm" asChild className="ml-2">
                <Link href="/" title="Back to Signum Dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
                </Link>
            </Button>
          </div>
        </header>
        <main className="flex-grow w-full flex justify-center items-center">
          <p>Loading layout...</p> {/* Replace with a spinner */}
        </main>
        <footer className="border-t bg-muted/50 text-center py-4">
            <p className="text-xs text-muted-foreground">Signum</p>
        </footer>
      </div>
    );
  }

  if (!siteData) {
    // If site not found after loading, show a "Not Found" specific to the layout
    // The page component might also show its own "Not Found" if its specific content isn't there.
    // This could lead to a Next.js 404 page if this layout calls notFound(),
    // but client components typically render custom UI or redirect.
    // We'll redirect to a generic app 404 or show an inline message.
    // For now, let the children (page.tsx) handle its own notFound state,
    // but this layout itself can't form if there's no siteData.
    // A robust solution might involve a global App 404 page.
    // Let's try to render a basic error and let the page's notFound take precedence if it also fails.
    // Ideally, if layout data fails, we should show a more global error.
    // router.replace('/404'); // If you have a custom 404 page at app level
    return (
        <div className="flex flex-col min-h-screen">
             <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center space-x-2">
                        <Leaf className="h-7 w-7 text-primary" />
                        <span className="text-2xl font-bold text-foreground">Signum</span>
                    </Link>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
                    </Button>
                </div>
            </header>
            <main className="flex-grow container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold mb-4">Site Not Found</h1>
                <p className="text-muted-foreground">The site you are looking for (ID: {params.siteId as string}) could not be loaded.</p>
            </main>
             <footer className="border-t bg-muted/50 text-center py-4">
                <p className="text-xs text-muted-foreground">Signum</p>
            </footer>
        </div>
    );
  }

  // --- Render actual layout with fetched siteData ---
  const siteConfig = siteData.config;
  const navLinks = siteData.contentFiles
    .filter(file => file.path !== 'content/index.md')
    .map(file => {
      const slug = file.path.startsWith('content/') 
                   ? file.path.substring('content/'.length).replace(/\.md$/, '')
                   : file.path.replace(/\.md$/, '');
      return {
        href: `/${params.siteId as string}/${slug}`, // Cast params.siteId as string
        label: file.frontmatter.title || file.slug,
      };
    })
    .sort((a,b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="container flex h-16 items-center justify-between">
          <Link href={`/${params.siteId as string}`} className="flex items-center space-x-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-foreground">
              {siteConfig?.title || params.siteId as string}
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-1">
             <Button variant="ghost" size="sm" asChild>
                <Link href={`/${params.siteId as string}`} title="Site Home">
                <Home className="h-4 w-4 mr-1" /> Home
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
                <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
                </Link>
            </Button>
            <div className="md:hidden ml-2">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" /> {/* Placeholder for actual menu icon */}
                <span className="sr-only">Toggle menu</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-grow w-full">
        {children} {/* The SitePage (client component) will render here */}
      </main>
      
      <footer className="border-t bg-muted/50 text-center py-4">
        <p className="text-xs text-muted-foreground">
          Viewing site: {siteConfig?.title || params.siteId as string} (Locally Rendered by Signum)
        </p>
      </footer>
    </div>
  );
}