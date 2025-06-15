// src/types/index.ts

export interface StructureNode {
  type: 'page' | 'collection'; 
  title: string;
  path: string;
  slug: string;
  navOrder?: number;
  children?: StructureNode[];
  layout: string; 
  itemLayout?: string; 
  [key: string]: unknown;
}

// Represents the theme configuration saved in the manifest.
export interface ThemeConfig {
  name: string; 
  config: {
    [key: string]: string | boolean | number;
  };
}

// Represents metadata for a layout, used in UI selectors.
export interface LayoutInfo {
  id: string;
  name: string;
  type: 'page' | 'collection'; 
  path: string; 
  description?: string;
}

// Represents metadata for a theme, used in UI selectors.
export interface ThemeInfo {
  id: string;
  name: string;
  path: string; 
}

// --- NEW: Defines the structure for a remote data source query ---
export interface DataSourceConfig {
  url: string;
  format: 'json' | 'csv';
  array_path?: string; // e.g., "results.items" for nested JSON
}

export interface ViewConfig {
  template: string; // The ID of the /views/ asset to use (e.g., "list")
  item_layout: string; // The ID of the /layouts/ asset for each item
  
  // Data can come from an internal collection OR an external source
  source_collection?: string; // The slug of an internal collection
  data_source?: DataSourceConfig; // The config for a remote data source

  // Standard query parameters
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  limit?: number;
  
  // Future extensibility for filtering
  filter?: {
    field: string;
    operator: 'eq' | 'neq' | 'contains';
    value: string | number | boolean;
  }[];
}

/**
 * Represents metadata for a view, used in UI selectors.
 */
export interface ViewInfo {
  id: string;      // The directory name, e.g., "list"
  name: string;    // The user-friendly name from its manifest, e.g., "Simple List"
  path: string;    // The directory name, same as id
}

// Represents the fields within a content file's frontmatter.
export interface MarkdownFrontmatter {
  title: string;
  layout: string; // The layout for this specific page's content
  view?: ViewConfig; // <-- The new, optional view configuration block
  [key: string]: unknown; 
}

// A raw markdown file parsed from storage.
export interface ParsedMarkdownFile {
  slug: string;
  path: string;
  frontmatter: MarkdownFrontmatter;
  content: string;
}

// Represents a raw file (e.g., theme CSS) from storage.
export interface RawFile {
  path: string;
  content: string;
}

// Represents the complete data for a single site held in memory.
export interface LocalSiteData {
  siteId: string;
  manifest: Manifest;
  contentFiles?: ParsedMarkdownFile[]; 
  layoutFiles?: RawFile[];
  themeFiles?: RawFile[];
  // Future: Add viewFiles?: RawFile[]
}

// Represents the main site manifest.
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

// Represents the theme configuration.
export interface ThemeConfig {
  name: string;
  config: {
    [key: string]: string | boolean | number;
  };
}

export interface LayoutInfo {
  id: string;
  name: string;
  type: 'page' | 'collection';
  path: string; 
  description?: string;
}

// A similar structure for custom themes
export interface ThemeInfo {
  id: string;
  name: string;
  path: string; 
}

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

// A raw markdown file parsed from storage.
export interface ParsedMarkdownFile {
  slug: string;
  path: string;
  frontmatter: MarkdownFrontmatter;
  content: string;
}

// Represents a link used for rendering navigation menus.
// This is a derived type, not part of the core manifest data.
export interface NavLinkItem {
  href: string;
  label: string;
  isActive?: boolean;
  children?: NavLinkItem[];
}

export interface RawFile {
  path: string;    // e.g., "layouts/custom/my-grid/layout.json" or "themes/custom/my-theme/theme.css"
  content: string; // The raw text content of the file
}


export interface LocalSiteData {
  siteId: string;
  manifest: Manifest;
  contentFiles?: ParsedMarkdownFile[];
  layoutFiles?: RawFile[];
  themeFiles?: RawFile[];
}

// The state and actions for the Zustand store.
export interface AppState {
  sites: LocalSiteData[];
  addSite: (site: LocalSiteData) => Promise<void>;
  updateManifest: (siteId: string, manifest: Manifest) => Promise<void>;
  addNewCollection: (siteId: string, name: string, slug: string, layout: string) => Promise<void>;
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string, layoutId: string) => Promise<boolean>;
  deleteSiteAndState: (siteId:string) => Promise<void>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  getSiteById: (siteId: string) => LocalSiteData | undefined;
}