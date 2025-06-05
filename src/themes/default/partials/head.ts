// src/themes/default/partials/head.ts
import { SiteConfigFile } from '@/types';
import { escapeHtml } from '../utils';

export function renderHead(siteConfig: SiteConfigFile, pageTitle: string): string {
  const siteTitle = escapeHtml(siteConfig.title || 'Signum Site');
  const effectivePageTitle = pageTitle ? `${escapeHtml(pageTitle)} | ${siteTitle}` : siteTitle;

  // Note: The actual classes (font-*, theme-*) and style variables (--primary-color, --font-stack-active)
  // are applied to the <html> tag by renderPageLayout in layout.ts.
  // This head template just includes meta tags and the CSS link.

  return `
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${effectivePageTitle}</title>
  <meta name="description" content="${escapeHtml(siteConfig.description || '')}">
  ${siteConfig.author ? `<meta name="author" content="${escapeHtml(siteConfig.author)}">` : ''}
  <link rel="stylesheet" href="/css/style.css"> {/* Path in exported bundle */}
</head>
  `;
}