// src/core/services/theme-engine/helpers/renderView.helper.ts
import Handlebars from 'handlebars';
import { SignumHelper } from './types';
import { ViewConfig, ParsedMarkdownFile } from '@/types';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

export const renderViewHelper: SignumHelper = (siteData) => ({
  /**
   * Renders a view template with a given set of items.
   * This is called from a page layout to render the view section.
   * The pagination is handled by the parent layout, not this helper.
   */
  render_view: function(viewConfig: ViewConfig, viewItems: ParsedMarkdownFile[]) {
    if (!viewConfig || !viewConfig.template || !viewItems) {
      return new Handlebars.SafeString('');
    }
    
    // Find the view template (e.g., 'list.hbs') which is pre-cached as a partial.
    const viewTemplate = Handlebars.partials[viewConfig.template];

    if (viewTemplate) {
      const collectionSlug = viewConfig.source_collection;
      const collectionNode = collectionSlug 
        ? siteData.manifest.structure.find(n => n.type === 'collection' && n.slug === collectionSlug) 
        : undefined;

      // Get the authoritative layout for each item from the collection's settings.
      const itemLayoutId = collectionNode?.itemLayout || DEFAULT_PAGE_LAYOUT_PATH;

      // The context passed to the view template is now simpler.
      const context = {
        items: viewItems,
        config: viewConfig,
        itemLayoutId: itemLayoutId,
      };
      return new Handlebars.SafeString(viewTemplate(context));
    }
    
    console.warn(`[render_view] View template "${viewConfig.template}" not found.`);
    return new Handlebars.SafeString(`<!-- View template "${viewConfig.template}" not found -->`);
  }
});