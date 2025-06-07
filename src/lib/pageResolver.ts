// src/lib/pageResolver.ts
import { LocalSiteData, ParsedMarkdownFile, StructureNode } from '@/types';
import { marked } from 'marked';
import { renderArticleContent } from '@/themes/default/partials/article';
import { renderCollectionListContent, type CollectionItemForTemplate } from '@/themes/default/partials/collection';

export enum PageType {
  SinglePage,
  CollectionListing,
  NotFound,
}

export interface PageResolutionResult {
  type: PageType;
  mainContentHtml?: string;
  pageTitle?: string;
  errorMessage?: string;
}

/**
 * Recursively finds a node in the structure tree that matches the slug path.
 * @param nodes The structure nodes to search.
 * @param slugSegments The remaining URL slug parts.
 * @returns The matched StructureNode or null.
 */
function findNodeBySlugPath(nodes: StructureNode[], slugSegments: string[]): StructureNode | null {
  if (!slugSegments || slugSegments.length === 0) {
    // We are at the root, looking for the index page.
    return nodes.find(node => node.slug === 'index') || null;
  }

  const currentSlug = slugSegments[0];
  const remainingSlugs = slugSegments.slice(1);

  const foundNode = nodes.find(node => node.slug === currentSlug);

  if (!foundNode) {
    return null;
  }
  
  if (remainingSlugs.length === 0) {
    return foundNode; // Found the target node.
  }

  if (foundNode.children) {
    // Continue searching in the children.
    return findNodeBySlugPath(foundNode.children, remainingSlugs);
  }

  return null; // Path continues but no children to search.
}


/**
 * Resolves a given URL slug path to its corresponding page type and rendered content.
 * This is the single source of truth for what content appears at a specific URL.
 * It now traverses the hierarchical manifest.structure.
 *
 * @param siteData The full LocalSiteData object.
 * @param slugArray The URL path segments (e.g., ['blog', 'my-first-post']).
 * @returns A PageResolutionResult object.
 */
export function resolvePageContent(
  siteData: LocalSiteData,
  slugArray: string[]
): PageResolutionResult {
  
  const targetNode = findNodeBySlugPath(siteData.manifest.structure, slugArray);

  if (!targetNode) {
    return {
      type: PageType.NotFound,
      errorMessage: `Content not found at path: "${slugArray.join('/') || 'homepage'}"`,
    };
  }

  if (targetNode.type === 'page') {
    const pageFile = siteData.contentFiles.find(f => f.path === targetNode.path);
    if (!pageFile) {
        return { type: PageType.NotFound, errorMessage: `Manifest references "${targetNode.path}" but file is missing.` };
    }
    return {
      type: PageType.SinglePage,
      mainContentHtml: renderArticleContent(pageFile),
      pageTitle: targetNode.title,
    };
  }

  if (targetNode.type === 'collection') {
    const itemsInCollection = (targetNode.children || []).map(childNode => {
      return siteData.contentFiles.find(f => f.path === childNode.path);
    }).filter((file): file is ParsedMarkdownFile => !!file);
    
    // Sort items based on the collection's config (now on the node itself).
    itemsInCollection.sort((a, b) => {
        const sortBy = targetNode.sortBy || 'date';
        const sortOrder = targetNode.sortOrder === 'asc' ? 1 : -1;
        if (sortBy === 'title') {
            return (a.frontmatter.title.localeCompare(b.frontmatter.title)) * sortOrder;
        }
        const dateA = new Date(a.frontmatter.date || 0).getTime();
        const dateB = new Date(b.frontmatter.date || 0).getTime();
        return (dateB - dateA) * sortOrder; // Note: Defaulting to date descending.
    });

    const mappedItems: CollectionItemForTemplate[] = itemsInCollection.map(file => ({
      ...file,
      itemLink: `./${file.slug}.html`,
      summaryOrContentTeaser: file.frontmatter.summary || (marked.parse((file.content || '').substring(0, 180) + '...') as string),
    }));

    const collectionDescriptionHtml = targetNode.description ? marked.parse(targetNode.description) as string : undefined;

    return {
      type: PageType.CollectionListing,
      mainContentHtml: renderCollectionListContent(targetNode.title, mappedItems, collectionDescriptionHtml),
      pageTitle: targetNode.title,
    };
  }

  // Fallback for an unknown node type.
  return {
    type: PageType.NotFound,
    errorMessage: `Unknown content type for path: "${slugArray.join('/')}"`,
  };
}