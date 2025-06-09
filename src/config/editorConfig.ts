// src/config/editorConfig.ts
import type { ThemeInfo, LayoutInfo } from '@/types';

/**
 * The official version of the Signum generator client.
 * This is written to the manifest.json on site creation and can be used
 * by the theme engine or other tools to check for compatibility.
 */
export const GENERATOR_VERSION = 'SignumClient/1.3.0';

/**
 * The URL segment used to identify a new, unsaved content file.
 * This allows the editor to distinguish between editing an existing file
 * and creating a new one.
 * e.g., /edit/site-id/content/blog/_new
 */
export const NEW_FILE_SLUG_MARKER = '_new';

/**
 * The delay in milliseconds for the autosave functionality in the content editor.
 * A longer delay reduces server/storage load but increases risk of data loss on close.
 * A shorter delay saves more often but can be more "chatty".
 */
export const AUTOSAVE_DELAY = 2500;

/**
 * The default layout path used for any new single page.
 * The system will fall back to this if a more specific layout isn't defined.
 * The path is relative to '/public/layouts/'.
 * e.g., 'core/page'
 */
export const DEFAULT_PAGE_LAYOUT_PATH = 'core/page';

/**
 * The default layout path used for any new collection.
 * This ensures that when a user creates a new collection, it has a sensible
 * default appearance without requiring an immediate decision.
 * The path is relative to '/public/layouts/'.
 * e.g., 'core/listing'
 */
export const DEFAULT_COLLECTION_LAYOUT_PATH = 'core/listing';

export const CORE_LAYOUTS: LayoutInfo[] = [
  { id: 'page', name: 'Standard Page', type: 'page', path: 'page' },
  { id: 'listing', name: 'Standard Listing', type: 'collection', path: 'listing' },
];

export const CORE_THEMES: ThemeInfo[] = [
  { id: 'default', name: 'Default Theme', path: 'default' },
];