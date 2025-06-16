// src/types/index.ts

/**
 * Represents a node in the site's hierarchical structure, as defined in `manifest.json`.
 * Can represent a standard page or a page that also acts as a collection container.
 */
export interface StructureNode {
  type: 'page' | 'collection'; // A page is a file, a collection is a virtual folder.
  title: string;
  path: string; // For pages, this is a file path. For collections, a directory path.
  slug: string;
  navOrder?: number;
  children?: StructureNode[];
  layout: string; // Layout for the page itself, or 'none' for a collection.
  itemLayout?: string; // Default layout for children within this collection.
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
  // 'page' is for standard content pages.
  // 'view' is for pages that list content.
  // 'item' is for rendering a single item within a view list.
  type: 'page' | 'view' | 'item';
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

/**
 * Defines the configuration for a View, stored in a page's frontmatter.
 * It specifies the view template and the data source for the content list.
 */
export interface ViewConfig {
  template: string; // The ID of the /views/ asset to use (e.g., "list")
  source_collection?: string; // The slug of an internal collection
  data_source?: DataSourceConfig;
  item_layout: string; // The layout for items in the list (e.g., "teaser")
  item_page_layout: string; // The layout for the full page of an item (e.g., "page")

  // Standard query parameters
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  show_pager?: boolean;
  items_per_page?: number;
  
  // Future extensibility for filtering
  filter?: {
    field: string;
    operator: 'eq' | 'neq' | 'contains';
    value: string | number | boolean;
  }[];
}

/**
 * Represents metadata for a view asset, used for populating UI selectors.
 */
export interface ViewInfo {
  id: string;      // The directory name, e.g., "list"
  name: string;    // The user-friendly name from its manifest, e.g., "Simple List"
  path: string;    // The directory name, same as id
}

/**
 * Represents the fields within a content file's YAML frontmatter.
 */
export interface MarkdownFrontmatter {
  title: string;
  layout: string; // The layout for this specific page's content.
  view?: ViewConfig; // Optional view configuration block.
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
  viewItems?: ParsedMarkdownFile[];
  pagination?: PaginationData;
} | {
  type: PageType.NotFound;
  errorMessage: string;
};