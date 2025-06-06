// src/themes/default/templates.ts
import type { SiteConfigFile, ParsedMarkdownFile, NavLinkItem } from '@/types';

/**
 * A type-safe function to escape HTML special characters.
 * It now correctly handles the 'unknown' type by first checking if the
 * input is a string before attempting to use string methods.
 * @param unsafe The input value, which can be of any type.
 * @returns A string with HTML special characters replaced by their entities.
 */
function escapeHtml(unsafe: unknown): string {
  if (typeof unsafe === 'string') {
    return unsafe
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, '"')
      .replace(/'/g, "'");
  }
  if (unsafe === null || unsafe === undefined) {
      return '';
  }
  // If it's not a string but is some other type (like a number), convert it to a string and then escape.
  return String(unsafe)
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
        <span>${escapeHtml(link.label)}</span>
      </a>
    </li>
  `).join('');

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
  fullBodyContentHtml: string, 
  pageTitle: string,
): string {
  const siteTitle = escapeHtml(siteConfig?.title || 'Signum Site');
  const effectivePageTitle = pageTitle ? `${escapeHtml(pageTitle)} | ${siteTitle}` : siteTitle;

  let htmlClass = '';
  if (siteConfig.theme === 'dark') htmlClass = 'theme-dark';
  if (siteConfig.theme === 'auto') htmlClass = 'theme-auto';

  let htmlStyle = '';
  if (siteConfig.font_family) {
    htmlStyle += `font-family: "${siteConfig.font_family.replace(/"/g, '\\"')}";`;
  }
  if (siteConfig.primary_color) {
    htmlStyle += `--primary-color: ${escapeHtml(siteConfig.primary_color)};`;
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
    ${fullBodyContentHtml}
  </div>
  <script src="/js/scripts.js"></script>
</body>
</html>
  `;
}

export function renderArticle(fileData: ParsedMarkdownFile): string {
  const title = escapeHtml(fileData.frontmatter.title || 'Untitled Page');
  const date = fileData.frontmatter.date 
    ? new Date(fileData.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : '';
  const bodyHtmlPlaceholder = `<!-- SSG will render markdown body here -->`;

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

export function renderCollectionItem(item: CollectionListItemForTemplate): string {
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
  items: CollectionListItemForTemplate[]
): string {
  const itemsHtml = items.map(item => renderCollectionItem(item)).join('');

  return `
    <section class="collection">
      <header class="collection-header">
        <h1>${escapeHtml(collectionTitle)}</h1>
      </header>
      ${items.length > 0 ? `<ul class="collection-list">${itemsHtml}</ul>` : '<p>No items in this collection.</p>'}
    </section>
  `;
}