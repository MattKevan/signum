// src/lib/theme-helpers/renderView.helper.ts
import Handlebars from 'handlebars';
import { SignumHelper } from './types'; // <-- FIX: Correct import path
import { ViewConfig, ParsedMarkdownFile } from '@/types'; // <-- FIX: Correct import path

export const renderViewHelper: SignumHelper = (siteData) => ({
  /**
   * Renders a view template with a given set of items.
   * This is called from a page layout to render the view section.
   * @example {{{render_view contentFile.frontmatter.view viewItems}}}
   */
  render_view: function(viewConfig: ViewConfig, viewItems: ParsedMarkdownFile[]) {
    if (!viewConfig || !viewConfig.template || !viewItems) {
      return '';
    }
    
    // The themeEngine has pre-cached and registered the view template as a partial
    // under its ID (e.g., 'list'). We can now look it up synchronously.
    const viewTemplate = Handlebars.partials[viewConfig.template];

    if (viewTemplate) {
      // The context passed to the view template includes the items and the config.
      const context = {
        items: viewItems,
        config: viewConfig
      };
      return new Handlebars.SafeString(viewTemplate(context));
    }
    
    console.warn(`[render_view] View template "${viewConfig.template}" not found.`);
    return `<!-- View template "${viewConfig.template}" not found -->`;
  }
});