// src/lib/navigationUtils.ts
import { LocalSiteData, NavLinkItem, StructureNode } from '@/types';
import { getUrlForNode } from './urlUtils';
import { getRelativePath } from './pathUtils';
import { RenderOptions } from './themeEngine'; // <-- IMPORT RENDER OPTIONS

/**
 * Recursively builds a navigation link structure with context-aware paths.
 * @param nodes - The site structure nodes to build links from.
 * @param currentPagePath - The path of the page being currently rendered.
 * @param options - The render options, containing isExport and siteRootPath.
 * @returns An array of navigation link objects.
 */
function buildNavLinks(nodes: StructureNode[], currentPagePath: string, options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>): NavLinkItem[] {
  return nodes
    .filter(node => node.navOrder !== undefined)
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      let href: string;
      const urlSegment = getUrlForNode(node, options.isExport);

      if (options.isExport) {
        // EXPORT MODE: Calculate a portable, document-relative path.
        href = getRelativePath(currentPagePath, urlSegment);
      } else {
        // PREVIEW MODE: Construct a full, absolute-style path for the SPA viewer.
        // e.g., /sites/signum-e1bry/view + / + about -> /sites/signum-e1bry/view/about
        href = `${options.siteRootPath}${urlSegment ? `/${urlSegment}` : ''}`;
      }
      
      return {
        href: href,
        label: node.title,
        children: node.children ? buildNavLinks(node.children, currentPagePath, options) : [],
      };
    });
}

/**
 * Generates the complete navigation structure for a given page.
 * @param siteData - The complete site data.
 * @param currentPagePath - The path of the HTML page being rendered (for relative calculations).
 * @param options - The full render options object.
 * @returns The final array of navigation links.
 */
export function generateNavLinks(
  siteData: LocalSiteData,
  currentPagePath: string,
  options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>
): NavLinkItem[] {
  const { structure } = siteData.manifest;
  return buildNavLinks(structure, currentPagePath, options);
}