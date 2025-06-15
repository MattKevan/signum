// src/components/browsing/MarkdownRenderer.tsx
'use client'; // It uses `dangerouslySetInnerHTML`, making it client-side for this pattern.
              // Alternatively, HTML parsing can be done on the server and HTML passed as prop.

import { marked } from 'marked';
import { useEffect, useMemo } from 'react'; // useMemo for parsing, useEffect if parsing were async
// Optional: Add DOMPurify for sanitization if markdown source is not 100% trusted
// import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  markdown: string;
}

export default function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  // Parse the markdown string to HTML.
  // useMemo will re-calculate only if the 'markdown' prop changes.
  const html = useMemo(() => {
    if (typeof window === 'undefined') {
        // If running in an SSR context where marked might be called without DOMPurify (if used),
        // or if you want to ensure it's only parsed once.
        // However, for this component marked as 'use client', this check is less critical
        // as it primarily renders client-side.
    }
    const rawHtml = marked.parse(markdown) as string;
    // Example of sanitization if you were to use DOMPurify:
    // if (typeof window !== 'undefined') { // DOMPurify only runs in browser
    //   return DOMPurify.sanitize(rawHtml);
    // }
    return rawHtml;
  }, [markdown]);

  // Using dangerouslySetInnerHTML because 'marked' produces an HTML string.
  // Ensure that the 'markdown' content is from a trusted source or sanitized.
  // Since in Signum, users are creating their own local content first,
  // the trust level is higher for this local-only phase.
  // For remote content later, sanitization will be critical.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}