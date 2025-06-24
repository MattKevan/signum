// src/components/view/SiteViewer.tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { PageType } from '@/core/types';import { render as renderWithTheme } from '@/core/services/renderer/render.service';
import { AlertTriangle, Edit } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import Link from 'next/link';

/**
 * Renders a live, interactive preview of a Signum site within an iframe.
 * This component acts as a mini-SPA, controlling the browser's URL history
 * to allow for deep linking and back/forward button navigation within the preview.
 */
export default function SiteViewer() {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;
  const viewRootPath = `/sites/${siteId}/view`;

  const [currentRelativePath, setCurrentRelativePath] = useState(
    pathname.replace(viewRootPath, '') || '/'
  );
  const [htmlContent, setHtmlContent] = useState<string>('<p>Loading Preview...</p>');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const site = useAppStore((state) => state.getSiteById(siteId));

  const sandboxAttributes = 
    process.env.NODE_ENV === 'development'
      ? 'allow-scripts allow-forms allow-same-origin'
      : 'allow-scripts allow-forms';


  const updateIframeContent = useCallback(async () => {
    if (!site) return;

    // This ensures we don't try to render before the site's content is loaded.
    if (!site.contentFiles) {
        console.log("SiteViewer is waiting for content files to load...");
        return;
    }

    const slugArray = currentRelativePath.split('/').filter(Boolean);
    const resolution = resolvePageContent(site, slugArray);
    
    if (resolution.type === PageType.NotFound) {
      setErrorMessage(resolution.errorMessage);
      return;
    }

    try {
      const pureHtml = await renderWithTheme(site, resolution, {
        siteRootPath: viewRootPath,
        isExport: false,
      });

      // --- START: NEW ROBUST COMMUNICATION SCRIPT ---
      const parentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      const communicationScript = `
        <script>
          // The parent component injects its own origin here. This is the key.
          const PARENT_ORIGIN = '${parentOrigin}'; 

          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');

            // 1. If it's not a link, do nothing.
            if (!link || !link.href) return;
            
            // 2. If it's an in-page anchor link, let the browser handle it.
            if (link.hash && link.pathname === window.location.pathname) return;

            // 3. This is the crucial check: Does the link point to the same origin
            //    as the parent application? This works in ANY sandbox mode.
            if (link.origin === PARENT_ORIGIN) {
              e.preventDefault();
              const newPath = new URL(link.href).pathname;
              // Post the message back to the parent, specifying its own origin for security.
              window.parent.postMessage({ type: 'SIGNUM_NAVIGATE', path: newPath }, PARENT_ORIGIN);
            }
            // 4. If it's an external link (e.g., to google.com), the condition fails
            //    and the browser handles it normally (opening in a new tab if target="_blank").
          });
        <\/script>
      `;
      // --- END: NEW ROBUST COMMUNICATION SCRIPT ---

      const finalHtml = pureHtml.replace('</body>', `${communicationScript}</body>`);
      setHtmlContent(finalHtml);
      setErrorMessage(null);
    } catch (e) {
      const error = e as Error;
      console.error("Error during site rendering:", error);
      setErrorMessage(`Theme Error: ${error.message}`);
    }
  }, [site, viewRootPath, currentRelativePath]);

  // Re-render the iframe whenever the path or the site data itself changes.
  useEffect(() => {
    updateIframeContent();
  }, [updateIframeContent]);

  // This effect manages the browser history and remains unchanged.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from our own origin.
      if (event.origin !== window.location.origin) return;
      
      const { type, path } = event.data;
      if (type === 'SIGNUM_NAVIGATE' && path !== window.location.pathname) {
        history.pushState({ path }, '', path);
        setCurrentRelativePath(path.replace(viewRootPath, '') || '/');
      }
    };

    const handlePopState = (event: PopStateEvent) => {
        const newPath = event.state?.path || pathname;
        setCurrentRelativePath(newPath.replace(viewRootPath, '') || '/');
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [viewRootPath, pathname]);

  if (errorMessage) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Could Not Render Preview</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
        <Button asChild variant="default" className="mt-6">
          <Link href={`/sites/${siteId}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> Go to Editor
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={htmlContent}
      title={site?.manifest.title || 'Site Preview'}
      className="w-full h-full border-0"
      sandbox={sandboxAttributes}
    />
  );
}