// src/components/view/SiteViewer.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { resolvePageContent, PageType } from '@/lib/pageResolver';
import { render as renderWithTheme } from '@/lib/themeEngine';
import { AlertTriangle, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SiteViewer() {
  const params = useParams();
  //const router = useRouter();

  const siteId = params.siteId as string;
  // This state now tracks the relative path within the site (e.g., '/', '/about')
  const [currentRelativePath, setCurrentRelativePath] = useState('/');
  const [htmlContent, setHtmlContent] = useState<string>('<p>Loading Preview...</p>');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const site = useAppStore((state) => state.getSiteById(siteId));

  const updateIframeContent = useCallback(async () => {
    if (!site) return;

    const slugArray = currentRelativePath.split('/').filter(Boolean);
    const resolution = resolvePageContent(site, slugArray);
    
    if (resolution.type === PageType.NotFound) {
      setErrorMessage(resolution.errorMessage);
      return;
    }

    try {
      // 1. Render the PURE HTML from the theme engine.
      const pureHtml = await renderWithTheme(site, resolution, {
        siteRootPath: `/sites/${siteId}`,
        isExport: false,
      });

      // 2. Define the communication script that will be injected.
      const communicationScript = `
        <script>
          // Intercept clicks on internal links within the iframe
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href && link.origin === window.location.origin) {
              e.preventDefault();
              const newPath = new URL(link.href).pathname;
              // Send a message to the parent window (our React app)
              window.parent.postMessage({ type: 'SIGNUM_NAVIGATE', path: newPath }, '*');
            }
          });
        <\/script>
      `;

      // 3. Inject the script into the HTML string just before the closing </body> tag.
      const finalHtml = pureHtml.replace('</body>', `${communicationScript}</body>`);

      setHtmlContent(finalHtml);
      setErrorMessage(null);
    } catch (e) {
      setErrorMessage(`Theme Error: ${(e as Error).message}`);
    }
  }, [site, siteId, currentRelativePath]);

  useEffect(() => {
    updateIframeContent();
  }, [updateIframeContent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // In production, you should validate event.origin for security
      const { type, path } = event.data;

      if (type === 'SIGNUM_NAVIGATE') {
        // When the iframe tells us a link was clicked, update the parent URL
        history.pushState(null, '', path);
        // And update our internal state to trigger a re-render of the iframe's content
        const relativePath = path.replace(`/sites/${siteId}`, '') || '/';
        setCurrentRelativePath(relativePath);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [siteId]);

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
      sandbox="allow-scripts allow-same-origin"
    />
  );
}