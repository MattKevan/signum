// src/lib/theme-helpers/strUtil.helper.ts
import { SignumHelper } from './types';
import { HelperOptions } from 'handlebars';

export const strUtilHelper: SignumHelper = () => ({
  /**
   * A generic string utility helper for common text manipulations.
   * @example {{str-util some.text op="truncate" len=100}}
   * @example {{str-util some.text op="uppercase"}}
   */
  'str-util': function(input: string, options: HelperOptions): string {
    if (!input || typeof input !== 'string') return '';
  
    const op = options.hash.op;
  
    switch (op) {
      case 'truncate':
        const len = options.hash.len || 140;
        if (input.length <= len) return input;
        return input.substring(0, len) + '…';
      case 'uppercase':
        return input.toUpperCase();
      case 'lowercase':
        return input.toLowerCase();
      default:
        return input;
    }
  }
});