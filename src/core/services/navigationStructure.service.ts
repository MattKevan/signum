// src/core/services/navigationStructure.service.ts
import { LocalSiteData, NavLinkItem, StructureNode } from '@/core/types';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import { RenderOptions } from '@/core/services/renderer/render.service';

/**
 * Recursively builds a navigation link structure with context-aware paths.
 * @param siteData - The full site data, needed for URL generation.
 * @param nodes - The site structure nodes to build links from.
 * @param currentPagePath - The path of the page being currently rendered.
 * @param options - The render options, containing isExport and siteRootPath.
 * @returns An array of navigation link objects.
 */
function buildNavLinks(
    siteData: LocalSiteData, 
    nodes: StructureNode[], 
    currentPagePath: string, 
    options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>
): NavLinkItem[] {
  return nodes
    .filter(node => node.type === 'page' && node.navOrder !== undefined)
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      let href: string;

      const urlSegment = getUrlForNode(node, siteData.manifest, options.isExport);

      if (options.isExport) {
        href = getRelativePath(currentPagePath, urlSegment);
      } else {
        const path = `/${urlSegment}`.replace(/\/$/, '') || '/';
        href = `${options.siteRootPath}${path === '/' ? '' : path}`;
      }

      // Filter out collection items from navigation
      const nodeFile = siteData.contentFiles?.find(f => f.path === node.path);
      const isCollectionPage = !!nodeFile?.frontmatter.collection;
      
      const children = (node.children && node.children.length > 0 && !isCollectionPage)
        ? buildNavLinks(siteData, node.children, currentPagePath, options)
        : [];

      return {
        href: href,
        label: node.menuTitle || node.title,
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
  return buildNavLinks(siteData, structure, currentPagePath, options);
}