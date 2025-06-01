// src/app/(browsing)/[siteId]/[[...slug]]/page.tsx
'use client'; // <<< MAKE IT A CLIENT COMPONENT

import { useParams, notFound, useRouter } from 'next/navigation'; // Import useParams and useRouter
import { useEffect, useState } from 'react';
import * as localSiteFs from '@/lib/localSiteFs';
import MarkdownRenderer from '@/components/browsing/MarkdownRenderer';
import { ParsedMarkdownFile, LocalSiteData } from '@/types'; // LocalSiteData needed for siteData state
import { Button } from '@/components/ui/button';
// Metadata function is removed as it runs on server; page is now client.
// If you need dynamic metadata with a client page, you'd update document <head> via useEffect or a library.

// No SitePageProps interface needed as params are fetched via hook

export default function SitePage() {
  const params = useParams(); // Use client-side hook
  const router = useRouter(); // For potential programmatic navigation if needed

  const [siteData, setSiteData] = useState<LocalSiteData | null | undefined>(undefined); // undefined: loading, null: not found
  const [contentFile, setContentFile] = useState<ParsedMarkdownFile | null | undefined>(undefined); // undefined: loading, null: not found
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Log params when they are available client-side
    console.log("Client-side SitePage received params:", params);

    const siteId = params.siteId as string;
    const slugArray = params.slug as string[] | undefined; // slug can be undefined if not present

    if (!siteId || typeof siteId !== 'string') {
      console.error("Client-side SitePage: Invalid or missing siteId in params", params);
      setContentFile(null); // Mark as not found
      setSiteData(null);
      setIsLoading(false);
      // notFound() from next/navigation doesn't work directly in client components to render the Next.js 404 page.
      // You might need to redirect or show a custom "Not Found" UI.
      // For now, we'll let the conditional rendering handle it.
      return;
    }

    let mounted = true;
    setIsLoading(true);

    async function fetchData() {
      try {
        const fetchedSiteData = await localSiteFs.getSiteById(siteId);
        if (!mounted) return;

        if (!fetchedSiteData) {
          setSiteData(null);
          setContentFile(null);
          return;
        }
        setSiteData(fetchedSiteData);

        const pageFilePath = `content/${slugArray && slugArray.length > 0 ? slugArray.join('/') : 'index'}.md`;
        const fetchedContentFile = fetchedSiteData.contentFiles.find(file => file.path === pageFilePath);

        if (!fetchedContentFile) {
          setContentFile(null);
        } else {
          setContentFile(fetchedContentFile);
        }
      } catch (error) {
        console.error("Error fetching site data client-side:", error);
        setSiteData(null); // Indicate error/not found
        setContentFile(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false; // Cleanup to prevent state updates on unmounted component
    };
  }, [params]); // Re-fetch if params change

  // --- Conditional Rendering based on state ---

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 flex justify-center items-center min-h-[300px]">
        <p>Loading content...</p> {/* Replace with a spinner */}
      </div>
    );
  }

  if (!siteData || !contentFile) {
    // This will render if siteData or contentFile is explicitly null (not found)
    // You could redirect to a custom /404 page here using router.replace('/404')
    // or show an inline "Not Found" message.
    // For now, showing an inline message:
    return (
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <p className="text-muted-foreground">
          The content you are looking for does not exist or could not be loaded.
        </p>
        {/* Optionally, a button to go back or to the homepage */}
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
            Go to Dashboard
        </Button>
      </div>
    );
  }

  // --- Render actual content ---
  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <article className="prose dark:prose-invert lg:prose-xl max-w-none">
        <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white lg:text-5xl">
          {contentFile.frontmatter.title || "Untitled Page"}
        </h1>
        
        {contentFile.frontmatter.date && (
          <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-6">
            Published on: {new Date(contentFile.frontmatter.date).toLocaleDateString('en-US', { 
              year: 'numeric', month: 'long', day: 'numeric' 
            })}
          </p>
        )}
        
        <MarkdownRenderer markdown={contentFile.content} />
      </article>
    </div>
  );
}