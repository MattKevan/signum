// src/core/services/theme-engine/helpers/getUrl.helper.ts
import { SignumHelper } from './types';
import { getUrlForNode as getUrlUtil } from '@/core/services/urlUtils.service';
import type { StructureNode } from '@/types';
import { HelperOptions } from 'handlebars';

// The helper factory receives the full siteData object.
export const getUrlHelper: SignumHelper = (siteData) => ({
  /**
   * A Handlebars helper to expose the getUrlForNode utility to templates.
   * This allows templates to generate correct, context-aware links for pages.
   *
   * @example
   * <a href="{{getUrlForNode this isExport=../options.isExport}}">Link</a>
   */
  // --- FIX: Corrected the function signature to match SignumHelperFunction ---
  getUrlForNode: function(this: unknown, ...args: unknown[]): string {
    // The options object from Handlebars is always the last argument.
    const options = args.pop() as HelperOptions;
    
    // The node object is the first argument passed from the template.
    const node = args[0] as StructureNode;
    
    // Extract the 'isExport' flag from the helper's hash arguments.
    const isExport = options.hash.isExport === true;
    
    // Type guard to ensure the node is valid before proceeding.
    if (!node || typeof node !== 'object' || !('path' in node) || !('slug' in node)) {
        console.warn('Handlebars "getUrlForNode" helper was called with an invalid node object.');
        return '#error-invalid-node';
    }

    // --- FIX: Pass the required `manifest` object from the factory's scope ---
    // The utility function needs the full manifest to determine if the node is the homepage.
    return getUrlUtil(node, siteData.manifest, isExport);
  }
});