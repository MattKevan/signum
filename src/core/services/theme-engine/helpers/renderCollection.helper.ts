// src/core/services/theme-engine/helpers/renderCollection.helper.ts
import Handlebars from 'handlebars';
import { SignumHelper } from './types';
import { CollectionConfig, ParsedMarkdownFile } from '@/types';

export const renderCollectionHelper: SignumHelper = () => ({
  /**
   * Renders a list of collection items using a specified list and item layout.
   * This is the primary helper for displaying collections on a Collection Page.
   *
   * @param {CollectionConfig} collectionConfig - The collection config from the page's frontmatter.
   * @param {ParsedMarkdownFile[]} items - The array of child items to render.
   * @returns {Handlebars.SafeString} The full HTML for the rendered list.
   *
   * @example
   * {{{render_collection contentFile.frontmatter.collection collectionItems}}}
   */
  render_collection: function(
      collectionConfig: CollectionConfig | undefined,
      items: ParsedMarkdownFile[] | undefined
  ): Handlebars.SafeString {
    if (!collectionConfig || !items) {
      return new Handlebars.SafeString('');
    }

    const { list_layout, item_layout } = collectionConfig;

    // 1. Find the List Layout template (e.g., 'listing.hbs').
    const listLayoutTemplateSource = Handlebars.partials[list_layout];
    if (!listLayoutTemplateSource) {
      console.warn(`[render_collection] List layout template "${list_layout}" not found.`);
      return new Handlebars.SafeString(`<!-- List layout "${list_layout}" not found -->`);
    }

    // 2. Compile the List Layout template.
    const listLayoutTemplate = Handlebars.compile(listLayoutTemplateSource);

    // 3. The context passed to the list layout is simple: the items and the item layout ID.
    const context = {
      items: items,
      itemLayoutId: item_layout, // Pass the ID for the item layout.
      config: collectionConfig,
    };

    // 4. Render the list layout and return it as safe HTML.
    return new Handlebars.SafeString(listLayoutTemplate(context));
  },
});