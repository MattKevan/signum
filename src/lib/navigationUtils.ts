// src/lib/navigationUtils.ts
import { LocalSiteData, NavLinkItem, StructureNode } from '@/types';

function buildNavLinks(nodes: StructureNode[], basePath: string, isStaticExport: boolean): NavLinkItem[] {
  return nodes
    .filter(node => node.navOrder !== undefined) // Only include items marked for navigation
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      let href = '';
      if (isStaticExport) {
        href = node.type === 'page' && node.slug !== 'index'
          ? `${basePath}/${node.slug}.html`
          : `${basePath}/${node.slug}/index.html`;
      } else {
        href = `${basePath}/${node.slug}`;
      }
      
      return {
        href: href.replace(/\/index$/, '').replace(/\/\//g, '/') || '/',
        label: node.title,
        children: node.children ? buildNavLinks(node.children, `${basePath}/${node.slug}`, isStaticExport) : [],
      };
    });
}

export function generateNavLinks(
  siteData: LocalSiteData,
  options: { isStaticExport: boolean; siteRootPath: string }
): NavLinkItem[] {
  const { structure } = siteData.manifest;
  return buildNavLinks(structure, options.siteRootPath, options.isStaticExport);
}