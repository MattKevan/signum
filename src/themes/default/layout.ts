// src/themes/default/layout.ts
import { Manifest, NavLinkItem, ThemeConfig } from '@/types';
import { renderHead } from './partials/head';
import { renderHeader } from './partials/header';
import { renderFooter } from './partials/footer';

// This is the correct signature the other components will use.
export function renderPageLayout(
  manifest: Manifest,
  themeConfig: ThemeConfig['config'],
  pageTitle: string,
  navLinks: NavLinkItem[],
  mainContentHtml: string,
): string {
  
  const headerHtml = renderHeader(manifest, navLinks, '/');
  const footerHtml = renderFooter(manifest);
  const headContent = renderHead(manifest, themeConfig, pageTitle);

  return `<!DOCTYPE html>
<html lang="en">
${headContent}
<body>
  <div class="site-container">
    ${headerHtml}
    <main class="site-content">
      ${mainContentHtml}
    </main>
    ${footerHtml}
  </div>
  <script src="/js/scripts.js"></script>
</body>
</html>
  `;
}