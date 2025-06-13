// src/components/view/SiteViewer.tsx
'use client';

import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { resolvePageContent, PageType } from '@/lib/pageResolver';
import { render as renderWithTheme } from '@/lib/themeEngine';
import { AlertTriangle, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      ? 'allow-scripts allow-forms allow-same-origin' // More permissive for DevTools
      : 'allow-scripts allow-forms';                  // Hardened for production


  const updateIframeContent = useCallback(async () => {
    if (!site) return;

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

      const communicationScript = `
        <script>
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href && link.origin === window.location.origin) {
              e.preventDefault();
              const newPath = new URL(link.href).pathname;
              window.parent.postMessage({ type: 'SIGNUM_NAVIGATE', path: newPath }, window.location.origin);
            }
          });
        <\/script>
      `;

      const finalHtml = pureHtml.replace('</body>', `${communicationScript}</body>`);
      setHtmlContent(finalHtml);
      setErrorMessage(null);
    } catch (e) {
      const error = e as Error;
      console.error("Error during site rendering:", error);
      setErrorMessage(`Theme Error: ${error.message}`);
    }
  }, [site, viewRootPath, currentRelativePath]);

  useEffect(() => {
    updateIframeContent();
  }, [updateIframeContent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
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
      // Use the environment-specific sandbox attributes
      sandbox={sandboxAttributes}
    />
  );
}