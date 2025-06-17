// src/core/services/pageResolver.service.ts

// FIX: Removed 'StructureNode' import, added 'PageResolutionResult' and 'PageType'.
import { LocalSiteData, ParsedMarkdownFile, ViewConfig, PaginationData, PageResolutionResult, PageType } from '@/types';
import { findNodeByPath } from './fileTree.service';
import { getUrlForNode } from './urlUtils.service';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

/**
 * Executes a declarative query from a view's configuration.
 * This pure function takes the config and site data, finds the source collection,
 * and returns a fully sorted array of ALL matching content items.
 * Pagination/limiting is handled by the main resolver.
 * 
 * @param {ViewConfig} viewConfig - The configuration object from the page's frontmatter.
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @returns {ParsedMarkdownFile[]} A sorted array of all content files that match the query.
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
  
  // FIX: 'items' is never reassigned, so it can be 'const'.
  const items = siteData.contentFiles.filter(file => childPaths.has(file.path));

  // --- Sorting Logic ---
  const sortBy = viewConfig.sort_by || 'date';
  const sortOrder = viewConfig.sort_order || 'desc';
  const orderModifier = sortOrder === 'desc' ? -1 : 1;

  // Note: We use sort() which mutates the array in place. To be safer with const, we can create a copy.
  return [...items].sort((a, b) => {
    const valA = a.frontmatter[sortBy];
    const valB = b.frontmatter[sortBy];

    if (sortBy === 'date') {
        const dateA = valA ? new Date(valA as string).getTime() : 0;
        const dateB = valB ? new Date(valB as string).getTime() : 0;
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return (dateA - dateB) * orderModifier;
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * orderModifier;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * orderModifier;
    }
    return 0;
  });
}


/**
 * Finds the correct page to render based on a URL slug path.
 * If the page is a View Page, this function executes the query, handles pagination,
 * and attaches the results to the final resolution object.
 *
 * @param {LocalSiteData} siteData - The complete data for the site.
 * @param {string[]} slugArray - The URL segments used for path matching.
 * @param {number} [pageNumber=1] - The current page number for pagination, typically from a URL query param.
 * @returns {PageResolutionResult} An object containing all data needed to render the page or a not-found error.
 */
export function resolvePageContent(
    siteData: LocalSiteData, 
    slugArray: string[],
    pageNumber: number = 1
): PageResolutionResult {
    const pathSuffix = slugArray.length > 0 ? slugArray.join('/') : 'index';
    const potentialPagePath = `content/${pathSuffix}.md`;

    const targetNode = findNodeByPath(siteData.manifest.structure, potentialPagePath);

    if (!targetNode || targetNode.type !== 'page') {
        return { 
            type: PageType.NotFound, 
            errorMessage: `No page found at the path /${slugArray.join('/')}. Collections themselves are not directly viewable.` 
        };
    }
    
    const contentFile = siteData.contentFiles?.find(f => f.path === targetNode.path);
    if (!contentFile) {
        return { 
            type: PageType.NotFound, 
            errorMessage: `Manifest references "${targetNode.path}" but its content file is missing.` 
        };
    }

    let viewItems: ParsedMarkdownFile[] | undefined = undefined;
    let pagination: PaginationData | undefined = undefined;

    if (contentFile.frontmatter.view) {
        const viewConfig = contentFile.frontmatter.view;
        const allItems = executeQuery(viewConfig, siteData);

        if (viewConfig.show_pager && viewConfig.items_per_page && viewConfig.items_per_page > 0) {
            const totalItems = allItems.length;
            const itemsPerPage = viewConfig.items_per_page;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const currentPage = Math.max(1, Math.min(pageNumber, totalPages));

            const startIndex = (currentPage - 1) * itemsPerPage;
            viewItems = allItems.slice(startIndex, startIndex + itemsPerPage);

            const pageUrlSegment = getUrlForNode({ ...targetNode, type: 'page' }, false);
            const baseUrl = `/${pageUrlSegment}`;

            pagination = {
                currentPage,
                totalPages,
                totalItems,
                hasPrevPage: currentPage > 1,
                hasNextPage: currentPage < totalPages,
                prevPageUrl: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : undefined,
                nextPageUrl: currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : undefined,
            };
        } else {
            viewItems = allItems;
        }
    }
  
    return {
        type: PageType.SinglePage,
        pageTitle: contentFile.frontmatter.title,
        contentFile: contentFile,
        layoutPath: contentFile.frontmatter.layout || DEFAULT_PAGE_LAYOUT_PATH,
        viewItems: viewItems,
        pagination: pagination,
    };
}