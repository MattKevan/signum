// src/themes/default/layout.ts
import { SiteConfigFile } from '@/types';
import { renderHead } from './partials/head'; // Assuming head.ts is in the same directory or correct path
import { escapeHtml } from './utils';     // Assuming utils.ts is in ../

export function renderPageLayout(
  siteConfig: SiteConfigFile,
  pageTitle: string,
  headerHtml: string,
  mainContentHtml: string, // This will be the output of renderArticleContent or renderCollectionListContent
  footerHtml: string
): string {
  
  const htmlClassesArray: string[] = [];
  const htmlStylesArray: string[] = [];

  // Theme Class
  if (siteConfig.theme === 'dark') htmlClassesArray.push('theme-dark');
  else if (siteConfig.theme === 'auto') htmlClassesArray.push('theme-auto');
  else htmlClassesArray.push('theme-light'); // Default if not specified or invalid

  // Font Stack Class & CSS Variable
  if (siteConfig.font_family === 'serif') {
    htmlClassesArray.push('font-serif');
    // --font-stack-active is now primarily set via class in style.css, 
    // but can be overridden here if needed or for browsers not fully supporting complex :root var inheritance.
    // htmlStylesArray.push(`--font-stack-active: var(--font-stack-serif);`); 
  } else if (siteConfig.font_family === 'monospace') {
    htmlClassesArray.push('font-mono');
    // htmlStylesArray.push(`--font-stack-active: var(--font-stack-mono);`);
  } else { // Default to sans-serif
    htmlClassesArray.push('font-sans');
    // htmlStylesArray.push(`--font-stack-active: var(--font-stack-sans);`);
  }
  
  // Primary Color CSS Variable
  if (siteConfig.primary_color) {
    // This variable is defined on :root in style.css, this inline style overrides it.
    htmlStylesArray.push(`--primary-color: ${escapeHtml(siteConfig.primary_color)};`);
  }

  const htmlClassAttribute = htmlClassesArray.length > 0 ? ` class="${htmlClassesArray.join(' ')}"` : '';
  const htmlStyleAttribute = htmlStylesArray.length > 0 ? ` style="${htmlStylesArray.join(' ')}"` : '';

  const headContent = renderHead(siteConfig, pageTitle);

  return `<!DOCTYPE html>
<html lang="en"${htmlClassAttribute}${htmlStyleAttribute}>
${headContent}
<body>
  <div class="site-container"> {/* This class is styled by theme.css */}
    ${headerHtml}
    <main class="site-content"> {/* This class is styled by theme.css */}
      ${mainContentHtml} {/* This will already have .prose if it's article/collection */}
    </main>
    ${footerHtml}
  </div>
  <script src="/js/scripts.js"></script> {/* Path in exported bundle */}
</body>
</html>
  `;
}