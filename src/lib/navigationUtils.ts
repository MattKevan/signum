// src/lib/navigationUtils.ts
import { LocalSiteData, NavLinkItem, SiteConfigFile } from '@/types';

/**
 * Represents a user-configured navigation item in the site config.
 * It defines the type of link (page or collection), its path, and its display order.
 */
export interface NavConfigItem {
  type: 'page' | 'collection';
  path: string; // e.g., 'about' or 'posts'
  order: number;
}

/**
 * A new SiteConfigFile type that includes the user-configurable navigation items.
 * This will replace the old SiteConfigFile definition.
 */
export interface SiteConfigFileWithNav extends SiteConfigFile {
    nav_items?: NavConfigItem[];
}


/**
 * Generates the definitive navigation structure for a site based on its configuration.
 * This function is the single source of truth for both the live preview and the static site exporter.
 * It uses the 'nav_items' array in the site config to determine the order and content of the navigation.
 *
 * @param siteData The full LocalSiteData object for the site, using the updated config with nav_items.
 * @param options An object containing options for link generation.
 *                - isStaticExport: Determines if links should end in '.html'.
 *                - siteRootPath: The base path for all generated hrefs (e.g., '/').
 * @returns An array of NavLinkItem objects representing the final navigation.
 */
export function generateNavLinks(
  siteData: LocalSiteData,
  options: { isStaticExport: boolean; siteRootPath: string }
): NavLinkItem[] {
  const { isStaticExport, siteRootPath } = options;
  const config = siteData.config as SiteConfigFileWithNav;
  const navItemsConfig = config.nav_items || [];
  
  // Sort items based on the user-defined order
  const sortedNavItems = [...navItemsConfig].sort((a, b) => a.order - b.order);

  const navLinks: NavLinkItem[] = [];

  // Always add the Home link first. It is not part of the configurable nav_items.
  const homeHref = isStaticExport ? `${siteRootPath}index.html`.replace(/\/\//g, '/') : siteRootPath;
  navLinks.push({ href: homeHref, label: "Home", iconName: "home" });

  for (const item of sortedNavItems) {
    if (item.type === 'collection') {
      const collectionConfig = config.collections?.find(c => c.path === item.path);
      const href = isStaticExport 
        ? `${siteRootPath}${item.path}/index.html`.replace(/\/\//g, '/')
        : `${siteRootPath}${item.path}`.replace(/\/\//g, '/');
      
      navLinks.push({
        href,
        label: collectionConfig?.nav_label || item.path,
        iconName: "folder"
      });
    } else if (item.type === 'page') {
      const pageFile = siteData.contentFiles.find(
        f => f.path === `content/${item.path}.md`
      );
      // Only add the page to nav if the corresponding file actually exists
      if (pageFile) {
        const href = isStaticExport
          ? `${siteRootPath}${item.path}.html`.replace(/\/\//g, '/')
          : `${siteRootPath}${item.path}`.replace(/\/\//g, '/');
        
        navLinks.push({
          href,
          label: pageFile.frontmatter.title || item.path,
          iconName: "file-text"
        });
      }
    }
  }

  // Ensure no duplicate links (though with the new model this is less likely)
  return navLinks.filter((link, index, self) => 
    index === self.findIndex((l) => (l.href === link.href))
  );
}