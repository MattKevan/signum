// src/themes/default/partials/header.ts
import { SiteConfigFile, NavLinkItem } from '@/types';
import { escapeHtml } from '../utils';

export function renderHeader(siteConfig: SiteConfigFile, navLinks: NavLinkItem[], siteRootPath: string): string {
  const siteTitle = escapeHtml(siteConfig.title || 'Signum Site');
  
  const navItemsHtml = navLinks.map(link => `
    <li class="${link.isActive ? 'active' : ''}"> {/* .active class can be styled in theme.css */}
      <a href="${escapeHtml(link.href)}" title="${escapeHtml(link.label)}">
        ${link.iconName ? `<!-- Icon: ${escapeHtml(link.iconName)} -->` : ''}
        <span>${escapeHtml(link.label)}</span>
      </a>
    </li>
  `).join('');

  return `
<header class="site-header">
  <div class="container"> {/* .container class defined in theme.css */}
    <a href="${escapeHtml(siteRootPath)}" class="site-title-link">
      <span class="site-title">${siteTitle}</span>
    </a>
    <nav class="site-nav">
      <ul>
        ${navItemsHtml}
      </ul>
    </nav>
    ${/* <button class="mobile-menu-toggle">Menu</button> <-- Structure for JS if needed */''}
  </div>
</header>
  `;
}