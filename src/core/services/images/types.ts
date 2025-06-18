// src/core/services/theme-engine/helpers/types.ts
import { LocalSiteData } from '@/types';
import Handlebars from 'handlebars';

/**
 * Defines the function signature for a Handlebars helper function within Signum.
 * `this` refers to the current template context.
 * `args` are the arguments passed to the helper in the template.
 */
export type SignumHelperFunction = (
  this: any, ...args: any[]
// <-- FIX: The return type now includes a Promise, allowing for async helpers.
) => string | Handlebars.SafeString | boolean | Promise<string | Handlebars.SafeString>;

/**
 * Defines a "Helper Factory". It's a function that receives the full site data
 * and returns an object mapping helper names to their implementation functions.
 */
export type SignumHelper = (siteData: LocalSiteData) => Record<string, SignumHelperFunction>;