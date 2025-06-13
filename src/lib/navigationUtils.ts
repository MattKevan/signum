// src/lib/navigationUtils.ts
import { LocalSiteData, NavLinkItem, StructureNode } from '@/types';
import { getUrlForNode } from './urlUtils';
import { getRelativePath } from './pathUtils'; // <-- IMPORT THE NEW HELPER

/**
 * Recursively builds a navigation link structure with correct relative paths.
 * @param {StructureNode[]} nodes - The site structure nodes to build links from.
 * @param {string} currentPagePath - The path of the page being currently rendered.
 * @returns {NavLinkItem[]} An array of navigation link objects.
 */
function buildNavLinks(nodes: StructureNode[], currentPagePath: string): NavLinkItem[] {
  return nodes
    .filter(node => node.navOrder !== undefined)
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      // First, get the final, absolute-style path for the target node.
      const targetPath = getUrlForNode(node, true);

      // Now, calculate the relative path from the current page to the target.
      const relativeHref = getRelativePath(currentPagePath, targetPath);

      return {
        href: relativeHref, // <-- USE THE CALCULATED RELATIVE PATH
        label: node.title,
        children: node.children ? buildNavLinks(node.children, currentPagePath) : [],
      };
    });
}

/**
 * Generates the complete navigation structure for a given page.
 * @param {LocalSiteData} siteData - The complete site data.
 * @param {string} currentPagePath - The path of the HTML page being rendered.
 * @returns {NavLinkItem[]} The final array of navigation links.
 */
export function generateNavLinks(
  siteData: LocalSiteData,
  currentPagePath: string
): NavLinkItem[] {
  const { structure } = siteData.manifest;
  return buildNavLinks(structure, currentPagePath);
}