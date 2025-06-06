// src/lib/pageResolver.ts
import { LocalSiteData } from '@/types';
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
 * Resolves a given path to its corresponding page type and rendered content.
 * This is the single source of truth for what content appears at a specific URL.
 *
 * @param siteData The full LocalSiteData object.
 * @param slugArray The URL path segments (e.g., ['blog', 'my-first-post']).
 * @returns A PageResolutionResult object containing the page type and its rendered HTML content.
 */
export function resolvePageContent(
  siteData: LocalSiteData,
  slugArray: string[]
): PageResolutionResult {
  const publicContentFiles = siteData.contentFiles.filter(
    (f) => !f.frontmatter.draft && f.frontmatter.status !== 'draft'
  );

  const currentSlugPath = slugArray.join('/');
  
  // 1. Check for a direct single page match (e.g., /about -> content/about.md)
  const singlePagePath = `content/${currentSlugPath || 'index'}.md`.toLowerCase();
  const directFileMatch = publicContentFiles.find(f => f.path.toLowerCase() === singlePagePath);
  if (directFileMatch) {
    return {
      type: PageType.SinglePage,
      mainContentHtml: renderArticleContent(directFileMatch),
      pageTitle: directFileMatch.frontmatter.title || directFileMatch.slug,
    };
  }

  // 2. If not a single page, check if the path corresponds to a configured collection
  const navItem = siteData.config.nav_items?.find(item => item.path === currentSlugPath);
  if (navItem && navItem.type === 'collection') {
    const collectionConfig = siteData.config.collections?.find(c => c.path === currentSlugPath);
    const collectionTitle = collectionConfig?.nav_label || currentSlugPath.charAt(0).toUpperCase() + currentSlugPath.slice(1);
    const collectionDescription = collectionConfig?.description ? marked.parse(collectionConfig.description) as string : undefined;

    const itemsInThisFolder = publicContentFiles.filter(
      f => f.path.toLowerCase().startsWith(`content/${currentSlugPath}/`.toLowerCase()) &&
           !f.path.toLowerCase().endsWith('/index.md')
    );

    // Sort items based on collection config
    itemsInThisFolder.sort((a, b) => {
        const sortBy = collectionConfig?.sort_by || 'date';
        const sortOrder = collectionConfig?.sort_order === 'asc' ? 1 : -1;
        
        if (sortBy === 'title') {
            return (a.frontmatter.title.localeCompare(b.frontmatter.title)) * sortOrder;
        }
        // Default to date sorting
        const dateA = new Date(a.frontmatter.date || 0).getTime();
        const dateB = new Date(b.frontmatter.date || 0).getTime();
        return (dateA - dateB) * sortOrder;
    });

    const mappedItems: CollectionItemForTemplate[] = itemsInThisFolder
      .map(file => {
          const itemPathSegment = file.path.replace(/^content\//i, '').replace(/\.md$/i, '');
          const summary = file.frontmatter.summary || (marked.parse((file.content || '').substring(0, 180) + '...') as string);
          return {
              ...file,
              itemLink: `./${itemPathSegment.split('/').pop()}.html`,
              summaryOrContentTeaser: summary,
          };
      });

    return {
      type: PageType.CollectionListing,
      // Pass the description from the config to the renderer
      mainContentHtml: renderCollectionListContent(collectionTitle, mappedItems, collectionDescription),
      pageTitle: collectionTitle,
    };
  }

  // 3. If no match, return NotFound
  return {
    type: PageType.NotFound,
    errorMessage: `Content not found at path: "${currentSlugPath || 'homepage'}"`,
  };
}