// src/config/editorConfig.ts

/**
 * The version of the Signum generator client.
 * This is written to the manifest.json on site creation and can be used
 * by the theme engine or other tools to check for compatibility.
 */
export const GENERATOR_VERSION = 'SignumClient/1.2.0';

/**
 * The constant used in the URL to identify a new, unsaved content file.
 * e.g., /edit/site-id/content/blog/_new
 */
export const NEW_FILE_SLUG_MARKER = '_new';

/**
 * The delay in milliseconds for the autosave functionality in the content editor.
 */
export const AUTOSAVE_DELAY = 2500;