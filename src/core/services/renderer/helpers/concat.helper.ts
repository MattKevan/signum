// src/core/services/theme-engine/helpers/concat.helper.ts

import { SignumHelper } from './types';

export const concatHelper: SignumHelper = () => ({
  /**
   * Concatenates multiple string arguments into a single string.
   *
   * @example
   * {{concat "Hello" " " "World"}} -> "Hello World"
   *
   * @example
   * <img alt=(concat @root.manifest.title " Logo")>
   */
  concat: function(...args: unknown[]): string {
    // The last argument provided by Handlebars is the 'options' object. 
    //const options = args.pop() as HelperOptions;

    // Join all other arguments with an empty string.
    return args.join('');
  },
});