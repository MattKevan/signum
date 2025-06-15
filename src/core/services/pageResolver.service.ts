// src/lib/pageResolver.ts
import { LocalSiteData, ParsedMarkdownFile, StructureNode, ViewConfig } from '@/types';

export enum PageType {
  SinglePage,
  NotFound,
}

export type PageResolutionResult = {
  type: PageType.SinglePage;
  pageTitle: string;
  contentFile: ParsedMarkdownFile;
  layoutPath: string;
  viewItems?: ParsedMarkdownFile[];
} | {
  type: PageType.NotFound;
  errorMessage: string;
};

/**
 * Executes a declarative query defined in a page's frontmatter.
 * This is a pure function that takes the config and the full site data,
 * and returns a processed array of content items.
 * @param {ViewConfig} viewConfig - The configuration object from the page's frontmatter.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @returns {ParsedMarkdownFile[]} An array of content files that match the query.
 */
function executeQuery(viewConfig: ViewConfig, siteData: LocalSiteData): ParsedMarkdownFile[] {
  if (!viewConfig.source_collection || !siteData.contentFiles) {
    return [];
  }

  const collectionNode = siteData.manifest.structure.find(
    node => node.type === 'collection' && node.slug === viewConfig.source_collection
  );

  if (!collectionNode || !collectionNode.children) {
    console.warn(`[Query Executor] Collection with slug "${viewConfig.source_collection}" not found or is empty.`);
    return [];
  }

  const childPaths = new Set(collectionNode.children.map(child => child.path));
  let items = siteData.contentFiles.filter(file => childPaths.has(file.path));

  const sortBy = viewConfig.sort_by || 'date';
  const sortOrder = viewConfig.sort_order || 'desc';
  const orderModifier = sortOrder === 'desc' ? -1 : 1;

  // --- START OF FIX: ROBUST SORTING LOGIC ---
  items.sort((a, b) => {
    const valA = a.frontmatter[sortBy];
    const valB = b.frontmatter[sortBy];

    // Handle sorting by date (most common case)
    if (sortBy === 'date') {
        const dateA = valA ? new Date(valA as string).getTime() : 0;
        const dateB = valB ? new Date(valB as string).getTime() : 0;
        if (isNaN(dateA) || isNaN(dateB)) return 0; // Don't sort invalid dates
        return (dateA - dateB) * orderModifier;
    }

    // Handle sorting by string (e.g., title)
    if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * orderModifier;
    }

    // Handle sorting by number
    if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * orderModifier;
    }

    // Fallback: if types are mixed or unknown, don't sort them relative to each other.
    return 0;
  });
  // --- END OF FIX ---

  if (viewConfig.limit) {
    items = items.slice(0, viewConfig.limit);
  }

  return items;
}


/**
 * Finds the correct page to render based on a URL slug path.
 * If the page has a 'view' block in its frontmatter, this function will also
 * execute the query and attach the results.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @param {string[]} slugArray - The URL segments.
 * @returns {PageResolutionResult} An object containing all data needed to render the page.
 */
export function resolvePageContent(siteData: LocalSiteData, slugArray: string[]): PageResolutionResult {
  // This helper should be implemented fully for recursive search
  const findNodeBySlugPath = (nodes: StructureNode[], slugs: string[]): StructureNode | null => {
    if (!slugs || slugs.length === 0) {
      // Find the root index page
      return nodes.find(node => node.slug === 'index' && node.type === 'page') || null;
    }
  
    let currentNodes = nodes;
    let foundNode: StructureNode | null = null;
  
    for (const slug of slugs) {
      foundNode = currentNodes.find(node => node.slug === slug) ?? null;
      if (!foundNode) return null; // Path segment not found
      currentNodes = foundNode.children || [];
    }
  
    return foundNode;
  };

  const targetNode = findNodeBySlugPath(siteData.manifest.structure, slugArray);

  if (!targetNode || targetNode.type !== 'page') {
    return { type: PageType.NotFound, errorMessage: `Content page not found for path: /${slugArray.join('/')}` };
  }

  const contentFile = siteData.contentFiles?.find(f => f.path === targetNode.path);
  if (!contentFile) {
    return { type: PageType.NotFound, errorMessage: `Manifest references "${targetNode.path}" but its content file is missing.` };
  }

  let viewItems: ParsedMarkdownFile[] | undefined = undefined;

  if (contentFile.frontmatter.view) {
    viewItems = executeQuery(contentFile.frontmatter.view, siteData);
  }

  return {
    type: PageType.SinglePage,
    pageTitle: contentFile.frontmatter.title,
    contentFile: contentFile,
    layoutPath: contentFile.frontmatter.layout,
    viewItems: viewItems,
  };
}