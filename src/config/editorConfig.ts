// src/config/editorConfig.ts
import type { ThemeInfo, LayoutInfo, ViewInfo } from '@/types';
import { RJSFSchema, UiSchema } from '@rjsf/utils'; 

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
 * e.g., 'page'
 */
export const DEFAULT_PAGE_LAYOUT_PATH = 'page';

/**
 * The default layout path used for any new collection.
 * This ensures that when a user creates a new collection, it has a sensible
 * default appearance without requiring an immediate decision.
 * The path is relative to '/public/layouts/'.
 * e.g., 'listing'
 */
export const DEFAULT_COLLECTION_LAYOUT_PATH = 'listing';

export const CORE_LAYOUTS: LayoutInfo[] = [
  { id: 'page', name: 'Page', type: 'page', path: 'page' },
  { id: 'listing', name: 'Listing', type: 'collection', path: 'listing' },
];

export const CORE_THEMES: ThemeInfo[] = [
  { id: 'default', name: 'Default Theme', path: 'default' },
];

/**
 * A list of the core, built-in views that ship with Signum.
 * The `id` and `path` must match the directory name in `/public/views/`.
 */
export const CORE_VIEWS: ViewInfo[] = [
    { id: 'list', name: 'Simple List View', path: 'list' },
    // Add other core views like 'grid' here as they are created.
];

/**
 * The universal base schema for all content frontmatter.
 * This object is imported directly, eliminating network requests.
 * Fields like 'title' and 'description' are not included here because they
 * are handled by dedicated UI components, not the generic form generator.
 */
export const BASE_SCHEMA: { schema: RJSFSchema; uiSchema: UiSchema } = {
  schema: {
    title: 'Base content fields',
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        title: 'Slug (URL Path)',
        description: 'The URL-friendly version of the title. Auto-generated, but can be edited.',
      },
      image: {
        type: 'string',
        title: 'Image',
        description: 'URL or path to a featured image for this content.',
      },
      date: {
        type: 'string',
        title: 'Publication date',
        format: 'date',
      },
      status: {
        type: 'string',
        title: 'Status',
        enum: ['published', 'draft'],
        default: 'draft',
      },
      author: {
        type: 'string',
        title: 'Author',
      },
      tags: {
        type: 'array',
        title: 'Tags',
        items: {
          type: 'string',
        },
      },
    },
  },
  uiSchema: {
    slug: {
      'ui:widget': 'hidden',
    },
    tags: {
      'ui:options': {
        addable: true,
        removable: true,
      },
    },
  },
};