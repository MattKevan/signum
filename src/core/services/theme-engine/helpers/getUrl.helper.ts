import { SignumHelper } from './types';
import { getUrlForNode as getUrlUtil } from '@/core/services/urlUtils.service';
import { StructureNode } from '@/types';

export const getUrlHelper: SignumHelper = () => ({
  /**
   * A Handlebars helper to expose the getUrlForNode utility to templates.
   */
  getUrlForNode: function(node: StructureNode, isExport: boolean): string {
    return getUrlUtil(node, isExport);
  }
});