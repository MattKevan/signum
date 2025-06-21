// src/core/services/theme-engine/helpers/renderLayoutForItem.helper.ts
import Handlebars from 'handlebars';
import { SignumHelper } from './types';
import type { ParsedMarkdownFile } from '@/types';
import type { HelperOptions } from 'handlebars';

export const renderLayoutForItemHelper: SignumHelper = () => ({
  /**
   * Renders a specific layout for a single content item.
   * This is used inside a view template's `each` loop to render item cards, etc.
   * @example {{{render_layout_for_item this layout=../contentFile.frontmatter.collection.item_layout}}}
   */
  // --- FIX: The function signature now correctly matches SignumHelperFunction ---
  render_layout_for_item: function(this: unknown, ...args: unknown[]): string | Handlebars.SafeString {
    // The options object from Handlebars is always the last argument.
    const options = args.pop() as HelperOptions;
    // The content item object is the first argument passed from the template.
    const item = args[0] as ParsedMarkdownFile;

    // Extract the desired layout ID from the helper's hash arguments.
    const layoutId = options.hash.layout;

    // Type guards to ensure we have valid data before proceeding.
    if (!item || typeof item !== 'object') {
        console.warn('[render_layout_for_item] Helper called without a valid item object.');
        return '';
    }
    if (!layoutId || typeof layoutId !== 'string') {
        console.warn('[render_layout_for_item] Helper called without a valid layout ID.');
        return '';
    }

    // Retrieve the pre-compiled template from Handlebars' partials cache.
    const layoutTemplateSource = Handlebars.partials[layoutId];

    if (layoutTemplateSource) {
        // If the template exists, compile it and render with the item's data.
        const layoutTemplate = Handlebars.compile(layoutTemplateSource);
        return new Handlebars.SafeString(layoutTemplate(item));
    }

    // If the template is not found, return a helpful HTML comment for debugging.
    console.warn(`[render_layout_for_item] Item layout template "${layoutId}" not found.`);
    return `<!-- Item layout "${layoutId}" not found -->`;
  }
});