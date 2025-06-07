// src/lib/pageResolver.ts
import { LocalSiteData, ParsedMarkdownFile, StructureNode } from '@/types';

export enum PageType {
  SinglePage,
  Collection,
  NotFound,
}

export type PageResolutionResult = {
  type: PageType.SinglePage;
  pageTitle: string;
  contentFile: ParsedMarkdownFile;
  layout: string;
} | {
  type: PageType.Collection;
  pageTitle: string;
  collectionNode: StructureNode;
  items: ParsedMarkdownFile[];
  layout: string;
} | {
  type: PageType.NotFound;
  errorMessage: string;
};

function findNodeBySlugPath(nodes: StructureNode[], slugSegments: string[]): StructureNode | null {
  if (!slugSegments || slugSegments.length === 0) {
    return nodes.find(node => node.slug === 'index' || node.path === 'content/index.md') || null;
  }

  const currentSlug = slugSegments[0];
  const remainingSlugs = slugSegments.slice(1);
  const foundNode = nodes.find(node => node.slug === currentSlug);

  if (!foundNode) return null;
  if (remainingSlugs.length === 0) return foundNode;
  if (foundNode.children) return findNodeBySlugPath(foundNode.children, remainingSlugs);

  return null;
}

export function resolvePageContent(siteData: LocalSiteData, slugArray: string[]): PageResolutionResult {
  const targetNode = findNodeBySlugPath(siteData.manifest.structure, slugArray);

  if (!targetNode) {
    return { type: PageType.NotFound, errorMessage: `Content not found for path: /${slugArray.join('/')}` };
  }

  if (targetNode.type === 'page') {
    const contentFile = siteData.contentFiles.find(f => f.path === targetNode.path);
    if (!contentFile) {
      return { type: PageType.NotFound, errorMessage: `Manifest references "${targetNode.path}" but its content file is missing.` };
    }
    return {
      type: PageType.SinglePage,
      pageTitle: targetNode.title,
      contentFile,
      layout: targetNode.layout,
    };
  }

  if (targetNode.type === 'collection') {
    const items = (targetNode.children || [])
      .map(childNode => siteData.contentFiles.find(f => f.path === childNode.path))
      .filter((file): file is ParsedMarkdownFile => !!file);
    
    // Future: Add sorting logic here based on collectionNode properties
    
    return {
      type: PageType.Collection,
      pageTitle: targetNode.title,
      collectionNode: targetNode,
      items,
      layout: targetNode.layout,
    };
  }

  return { type: PageType.NotFound, errorMessage: `Unknown node type encountered for path: /${slugArray.join('/')}` };
}