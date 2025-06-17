// src/types/index.ts

/**
 * Represents a node in the site's hierarchical structure, as defined in `manifest.json`.
 * Every node is a page, which can have child pages nested under it.
 * Whether a page acts as a "Collection Page" is determined by its frontmatter,
 * not by a property on this node.
 */
export interface StructureNode {
  type: 'page'; // The 'type' is now always 'page'.
  title: string;
  path: string; // The full path to the .md file (e.g., 'content/blog.md').
  slug: string; // The URL-friendly version of the path (e.g., 'blog').
  navOrder?: number;
  children?: StructureNode[];
  [key: string]: unknown;
}

/**
 * Represents the theme configuration saved in the manifest, including
 * the theme's name and any user-defined overrides.
 */
export interface ThemeConfig {
  name: string;
  config: {
    [key: string]: string | boolean | number;
  };
}

/**
 * Represents metadata for a layout asset, used for populating UI selectors.
 */
export interface LayoutInfo {
  id: string;
  name: string;
  type: 'page' | 'list' | 'item';
  path: string;
  description?: string;
}

/**
 * Represents metadata for a theme asset, used for populating UI selectors.
 */
export interface ThemeInfo {
  id: string;
  name: string;
  path: string;
}

/**
 * Defines the structure for a remote data source query (future feature).
 */
export interface DataSourceConfig {
  url: string;
  format: 'json' | 'csv';
  array_path?: string; // e.g., "results.items" for nested JSON
}



export interface CollectionConfig {
  item_layout: string;
  item_page_layout: string; 
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  items_per_page?: number;
  // Future: filter config
}


/**
 * Represents the fields within a content file's YAML frontmatter.
 */
export interface MarkdownFrontmatter {
  title: string;
  layout: string; // The layout for this specific page's content.
  collection?: CollectionConfig;
  [key: string]: unknown;
}

/**
 * Represents a raw markdown file that has been parsed from storage into its constituent parts.
 */
export interface ParsedMarkdownFile {
  slug: string;
  path: string;
  frontmatter: MarkdownFrontmatter;
  content: string;
}

/**
 * Represents a generic raw file (e.g., theme CSS, layout JSON) read from storage.
 */
export interface RawFile {
  path: string;
  content: string;
}

/**
 * Represents the data required for rendering pager controls.
 */
export interface PaginationData {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPageUrl?: string;
    nextPageUrl?: string;
}

/**
 * Represents the main `manifest.json` file for a single site. This is the
 * top-level configuration and site map.
 */
export interface Manifest {
  siteId: string;
  generatorVersion: string;
  title: string;
  description: string;
  author?: string;
  baseUrl?: string;
  theme: ThemeConfig;
  structure: StructureNode[];
  layouts?: LayoutInfo[];
  themes?: ThemeInfo[];
}

/**
 * Represents the complete data for a single site when held in the application's memory.
 */
export interface LocalSiteData {
  siteId: string;
  manifest: Manifest;
  contentFiles?: ParsedMarkdownFile[];
  layoutFiles?: RawFile[];
  themeFiles?: RawFile[];
  // Future: viewFiles?: RawFile[]
}

/**
 * Represents a link used for rendering navigation menus.
 * This is a derived type, not part of the core manifest data.
 */
export interface NavLinkItem {
  href: string;
  label: string;
  isActive?: boolean;
  children?: NavLinkItem[];
}

/**
 * An enum to clearly distinguish the outcome of a page resolution attempt.
 */
export enum PageType {
  SinglePage,
  NotFound,
}

/**
 * Represents the complete, resolved data package for a single page render.
 * This object is the output of the pageResolver and the input for the themeEngine.
 */
export type PageResolutionResult = {
  type: PageType.SinglePage;
  pageTitle: string;
  contentFile: ParsedMarkdownFile;
  layoutPath: string;
  collectionItems?: ParsedMarkdownFile[]; 
  pagination?: PaginationData;
} | {
  type: PageType.NotFound;
  errorMessage: string;
};