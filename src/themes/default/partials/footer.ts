// src/themes/default/partials/footer.ts
import { SiteConfigFile } from '@/types';
import { escapeHtml } from '../utils';

export function renderFooter(siteConfig: SiteConfigFile): string {
  const year = new Date().getFullYear();
  // CORRECTED: Changed 'site.author' to 'siteConfig.author'
  const author = siteConfig.author ? `<p class="site-author">By ${escapeHtml(siteConfig.author)}</p>` : '';
  return `
<footer class="site-footer">
  <div class="container"> <!-- .container class defined in theme.css -->
    ${author}
    <p>© ${year} ${escapeHtml(siteConfig.title || 'Signum Site')}. Powered by Signum.</p>
  </div>
</footer>
  `;
}