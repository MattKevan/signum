// src/core/services/navigationStructureService.ts

import { LocalSiteData, NavLinkItem, StructureNode } from '@/types';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import { RenderOptions } from '@/core/services/theme-engine/themeEngine.service';

/**
 * Recursively builds a navigation link structure with context-aware paths.
 * @param nodes - The site structure nodes to build links from.
 * @param currentPagePath - The path of the page being currently rendered.
 * @param options - The render options, containing isExport and siteRootPath.
 * @returns An array of navigation link objects.
 */
function buildNavLinks(nodes: StructureNode[], currentPagePath: string, options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>): NavLinkItem[] {
  return nodes
    .filter(node => node.type === 'page' && node.navOrder !== undefined)
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      let href: string;
      const urlSegment = getUrlForNode(node, options.isExport);

      if (options.isExport) {
        href = getRelativePath(currentPagePath, urlSegment);
      } else {
        href = `${options.siteRootPath}${urlSegment ? `/${urlSegment}` : ''}`.replace(/\/$/, '') || '/';
      }

      // --- NEW: Recursive call for children ---
      const children = (node.children && node.children.length > 0)
        ? buildNavLinks(node.children, currentPagePath, options)
        : [];

      return {
        href: href,
        label: node.title,
        children: children,
      };
    });
}

/**
 * Generates the complete navigation structure for a given page.
 */
export function generateNavLinks(
  siteData: LocalSiteData,
  currentPagePath: string,
  options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>
): NavLinkItem[] {
  const { structure } = siteData.manifest;
  return buildNavLinks(structure, currentPagePath, options);
}