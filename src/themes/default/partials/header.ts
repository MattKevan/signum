// src/themes/default/partials/header.ts
import { SiteConfigFile, NavLinkItem } from '@/types';
import { escapeHtml } from '../utils';

/**
 * Recursively renders navigation list items, creating nested <ul> for children.
 * @param navLinks An array of NavLinkItem objects.
 * @returns An HTML string of <li> elements.
 */
function renderNavList(navLinks: NavLinkItem[]): string {
  if (!navLinks || navLinks.length === 0) return '';
  
  return navLinks.map(link => `
    <li class="${link.isActive ? 'active' : ''} ${link.children && link.children.length > 0 ? 'has-dropdown' : ''}">
      <a href="${escapeHtml(link.href)}" title="${escapeHtml(link.label)}">
        <span>${escapeHtml(link.label)}</span>
      </a>
      ${link.children && link.children.length > 0 ? `
        <ul class="dropdown">
          ${renderNavList(link.children)}
        </ul>
      ` : ''}
    </li>
  `).join('');
}

export function renderHeader(siteConfig: SiteConfigFile, navLinks: NavLinkItem[], siteRootPath: string): string {
  const siteTitle = escapeHtml(siteConfig.title || 'Signum Site');
  
  const navItemsHtml = renderNavList(navLinks);

  return `
<header class="site-header">
  <div class="container">
    <a href="${escapeHtml(siteRootPath)}" class="site-title-link">
      <span class="site-title">${siteTitle}</span>
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