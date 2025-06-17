// src/core/services/theme-engine/helpers/renderLayoutForItem.helper.ts
import Handlebars from 'handlebars';
import { SignumHelper } from './types';
// Import the specific types we need
import { ParsedMarkdownFile, PageResolutionResult } from '@/types';
import { HelperOptions } from 'handlebars';

export const renderLayoutForItemHelper: SignumHelper = () => ({
  /**
   * Renders a specific layout for a single content item.
   * This is used inside a view template's `each` loop.
   * @example {{{render_layout_for_item this layout=../contentFile.frontmatter.collection.item_layout}}}
   */
  render_layout_for_item: function(
    // The 'this' context for a helper is typically the top-level data object
    // passed to the template that contains the helper call. PageResolutionResult is a good, safe type.
    this: PageResolutionResult,
    item: ParsedMarkdownFile,
    options: HelperOptions
  ) {
    const layoutId = options.hash.layout;
    if (!item || !layoutId) {
        return '';
    }

    const layoutTemplateSource = Handlebars.partials[layoutId];

    if (layoutTemplateSource) {
        const layoutTemplate = Handlebars.compile(layoutTemplateSource);
        return new Handlebars.SafeString(layoutTemplate(item));
    }

    console.warn(`[render_layout_for_item] Item layout template "${layoutId}" not found.`);
    return `<!-- Item layout "${layoutId}" not found -->`;
  }
});