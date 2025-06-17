// src/lib/theme-helpers/types.ts
import { LocalSiteData } from '@/types'; // Use the correct path alias to the main types
import Handlebars from 'handlebars'; 

/**
 * Defines the function signature for a Handlebars helper function within Signum.
 * `this` refers to the current template context.
 * `args` are the arguments passed to the helper in the template.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SignumHelperFunction = (this: any, ...args: any[]) => string | Handlebars.SafeString | boolean;
/**
 * Defines a "Helper Factory". It's a function that receives the full site data
 * and returns an object mapping helper names to their implementation functions.
 * This allows helpers to be data-aware if needed.
 */
export type SignumHelper = (siteData: LocalSiteData) => Record<string, SignumHelperFunction>;