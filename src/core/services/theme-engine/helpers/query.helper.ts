// src/lib/theme-helpers/query.helper.ts
import Handlebars from 'handlebars';
import { SignumHelper } from './types';
import { PageResolutionResult } from '@/types';

export const queryHelper: SignumHelper = (siteData) => ({
  /**
   * Fetches, filters, and sorts a list of content items from a collection.
   * The resulting array is made available to the inner block of the helper.
   * @param {HelperOptions} options - The Handlebars options object.
   * @returns The rendered block content.
   *
   * @example
   * {{#query source_collection="blog" limit=5 as |posts|}}
   *   {{#each posts}} ... {{/each}}
   * {{/query}}
   */
  query: function(this: PageResolutionResult, options: Handlebars.HelperOptions) {
    const config = options.hash;

    // 1. Validate that a source collection was provided.
    const sourceCollectionSlug = config.source_collection;
    if (!sourceCollectionSlug) {
      console.warn("Query helper called without a 'source_collection'.");
      return options.inverse(this); // Render the {{else}} block if it exists.
    }

    // 2. Find the source collection node in the site's structure.
    const collectionNode = siteData.manifest.structure.find(
        n => n.slug === sourceCollectionSlug
    );
    if (!collectionNode || !collectionNode.children) {
      console.warn(`Query could not find collection with slug: "${sourceCollectionSlug}"`);
      return options.inverse(this);
    }
    
    // 3. Get all content files associated with that collection.
    const childPaths = new Set(collectionNode.children.map(c => c.path));
    let items = (siteData.contentFiles ?? []).filter(f => childPaths.has(f.path));

    // 4. (Future) Apply any filters here.
    // e.g., if (config.filter_by_tag) { ... }

    // 5. Sort the resulting items.
    const sortBy = config.sort_by || 'date';
    const sortOrder = config.sort_order || 'desc';
    const orderModifier = sortOrder === 'desc' ? -1 : 1;

    items.sort((a, b) => {
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

    // 6. Limit the number of results.
    if (config.limit) {
      const limit = parseInt(config.limit, 10);
      if (!isNaN(limit)) {
        items = items.slice(0, limit);
      }
    }

    // 7. Render the inner block, passing the queried items as a block parameter.
    // This makes the `as |posts|` syntax work.
    if (options.data && options.fn) {
        const data = Handlebars.createFrame(options.data);
        const blockParamName = options.data.blockParams?.[0];
        if (blockParamName) {
            data[blockParamName] = items;
        }
        return options.fn(items, { data });
    }
    
    // Fallback if no block parameter is used.
    return options.fn(items);
  }
});