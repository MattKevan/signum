// src/themes/default/templates.ts
import type { SiteConfigFile, ParsedMarkdownFile, NavLinkItem } from '@/types'; // Correct import for NavLinkItem

// Helper to escape HTML
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function escapeHtml(unsafe: any): string {
  if (typeof unsafe !== 'string') {
    if (unsafe === null || unsafe === undefined) return '';
    unsafe = String(unsafe);
  }
  return unsafe
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

export function renderHeader(siteConfig: SiteConfigFile, navLinks: NavLinkItem[], siteRootPath: string): string {
  const siteTitle = escapeHtml(siteConfig?.title || 'Signum Site');
  
  const navItemsHtml = navLinks.map(link => `
    <li class="${link.isActive ? 'active' : ''}">
      <a href="${escapeHtml(link.href)}" title="${escapeHtml(link.label)}">
        ${link.iconName ? `<!-- Icon: ${escapeHtml(link.iconName)} -->` : ''}
        <span>${escapeHtml(link.label)}</span>
      </a>
    </li>
  `).join(''); // Corrected line ending

  return `
    <header class="site-header">
      <div class="container">
        <a href="${escapeHtml(siteRootPath)}" class="site-title-link">
          <h1 class="site-title">${siteTitle}</h1>
        </a>
        <nav class="site-nav">
          <ul>
            ${navItemsHtml}
          </ul>
        </nav>
      </div>
    </header>
  `;
}

export function renderFooter(siteConfig: SiteConfigFile): string {
  const year = new Date().getFullYear();
  const author = siteConfig.author ? `<p>By ${escapeHtml(siteConfig.author)}</p>` : '';
  return `
    <footer class="site-footer">
      <div class="container">
        ${author}
        <p>© ${year} ${escapeHtml(siteConfig.title || 'Signum Site')}. Powered by Signum.</p>
      </div>
    </footer>
  `;
}

export function renderPageLayout(
  siteConfig: SiteConfigFile,
  contentHtml: string,
  pageTitle: string,
  // For SSG, navLinks and siteRootPath would be passed if header is embedded here.
  // For now, keeping it simpler: SSG will call renderHeader/renderFooter separately.
): string {
  const siteTitle = escapeHtml(siteConfig?.title || 'Signum Site');
  const effectivePageTitle = pageTitle ? `${escapeHtml(pageTitle)} | ${siteTitle}` : siteTitle;

  // Applying style hints via inline styles or classes for the exported HTML
  let htmlClass = '';
  if (siteConfig.style_hints?.theme === 'dark') htmlClass = 'theme-dark'; // Example class
  if (siteConfig.style_hints?.theme === 'auto') htmlClass = 'theme-auto';

  let htmlStyle = '';
  if (siteConfig.style_hints?.font_family) {
    htmlStyle += `font-family: ${siteConfig.style_hints.font_family};`;
  }
  if (siteConfig.style_hints?.primary_color) {
    // This sets a CSS variable that style.css can use
    htmlStyle += `--primary-color: ${escapeHtml(siteConfig.style_hints.primary_color)};`;
  }


  return `
    <!DOCTYPE html>
    <html lang="en"${htmlClass ? ` class="${htmlClass}"` : ''}${htmlStyle ? ` style="${htmlStyle}"` : ''}>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${effectivePageTitle}</title>
      <meta name="description" content="${escapeHtml(siteConfig.description || '')}">
      ${siteConfig.author ? `<meta name="author" content="${escapeHtml(siteConfig.author)}">` : ''}
      <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
      <div class="site-container">
        {/* In SSG, call renderHeader and renderFooter here with appropriate data */}
        <main class="site-content">
          ${contentHtml}
        </main>
      </div>
      <script src="/js/scripts.js"></script>
    </body>
    </html>
  `;
}
// ... (renderArticle, renderCollectionItem, renderCollectionList remain the same as previous correct version)
export function renderArticle(fileData: ParsedMarkdownFile, siteConfig: SiteConfigFile): string {
  const title = escapeHtml(fileData.frontmatter.title || 'Untitled Page');
  const date = fileData.frontmatter.date 
    ? new Date(fileData.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : '';
  const bodyHtmlPlaceholder = `<!-- SSG would render markdown body here: ${escapeHtml(fileData.content.substring(0,50))}... -->`;


  return `
    <article class="post">
      <header class="post-header">
        <h1>${title}</h1>
        ${date ? `<p class="post-date">Published on: ${date}</p>` : ''}
        ${fileData.frontmatter.summary ? `<p class="post-summary">${escapeHtml(fileData.frontmatter.summary)}</p>` : ''}
      </header>
      <div class="post-content">
        ${bodyHtmlPlaceholder}
      </div>
    </article>
  `;
}

interface CollectionListItemForTemplate extends Omit<ParsedMarkdownFile, 'frontmatter'> {
  frontmatter: ParsedMarkdownFile['frontmatter'] & {
    date?: string;
    title: string;
  };
  itemLink: string;
}

export function renderCollectionItem(item: CollectionListItemForTemplate, siteConfig: SiteConfigFile): string {
  const title = escapeHtml(item.frontmatter.title || 'Untitled Item');
  const date = item.frontmatter.date 
    ? new Date(item.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const summary = escapeHtml(item.frontmatter.summary || item.content.substring(0, 150).replace(/#.*$/gm, '').replace(/[\*\`\[\]]/g, '').trim() + '...');

  return `
    <li class="collection-item">
      <article>
        <h2 class="collection-item-title"><a href="${escapeHtml(item.itemLink)}">${title}</a></h2>
        ${date ? `<p class="collection-item-date">${date}</p>` : ''}
        ${summary ? `<p class="collection-item-summary">${summary}</p>` : ''}
        <a href="${escapeHtml(item.itemLink)}" class="collection-item-readmore">Read More</a>
      </article>
    </li>
  `;
}

export function renderCollectionList(
  collectionTitle: string, 
  items: CollectionListItemForTemplate[], 
  siteConfig: SiteConfigFile
): string {
  const itemsHtml = items.map(item => renderCollectionItem(item, siteConfig)).join('');

  return `
    <section class="collection">
      <header class="collection-header">
        <h1>${escapeHtml(collectionTitle)}</h1>
      </header>
      ${items.length > 0 ? `<ul class="collection-list">${itemsHtml}</ul>` : '<p>No items in this collection.</p>'}
    </section>
  `;
}