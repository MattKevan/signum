// src/lib/theme-helpers/renderLayoutForItem.helper.ts
import Handlebars from 'handlebars';
import { SignumHelper } from './types'; 
import { ParsedMarkdownFile } from '@/types'; 
import { HelperOptions } from 'handlebars';

export const renderLayoutForItemHelper: SignumHelper = (siteData) => ({
  /**
   * Renders a specific layout for a single content item.
   * This is used inside a view template's `each` loop.
   * @example {{{render_layout_for_item this layout=config.item_layout}}}
   */
  render_layout_for_item: function(
    this: any, 
    item: ParsedMarkdownFile, 
    options: HelperOptions 
  ) {
    const layoutId = options.hash.layout;
    if (!item || !layoutId) {
        return '';
    }

    // The themeEngine has pre-cached the required layout as a partial
    // under its ID (e.g., 'post-card').
    const layoutTemplate = Handlebars.partials[layoutId];
    
    if (layoutTemplate) {
        // The context for the layout partial is the item itself.
        return new Handlebars.SafeString(layoutTemplate(item));
    }

    console.warn(`[render_layout_for_item] Item layout template "${layoutId}" not found.`);
    return `<!-- Item layout "${layoutId}" not found -->`;
  }
});