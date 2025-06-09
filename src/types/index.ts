// src/types/index.ts

// Represents a node in the hierarchical site structure.
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
  // Path is RELATIVE to the site's `_signum/layouts` directory
  path: string; 
  description?: string;
}

// A similar structure for custom themes
export interface ThemeInfo {
  id: string;
  name: string;
  // Path is RELATIVE to the site's `_signum/themes` directory
  path: string; 
}

export interface Manifest {
  siteId: string;
  generatorVersion: string;
  title: string;
  description: string;
  author?: string;
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

// Represents the fields within a content file's frontmatter.
export interface MarkdownFrontmatter {
  title: string;
  // This allows any other string key, accommodating custom frontmatter.
  [key: string]: unknown; // 'unknown' is safer than 'any'. It forces type checks.
}

export interface RawFile {
  path: string;    // e.g., "layouts/custom/my-grid/layout.json" or "themes/custom/my-theme/theme.css"
  content: string; // The raw text content of the file
}

// The complete data for a site held in the app's state.
export interface LocalSiteData {
  siteId: string;
  manifest: Manifest;
  contentFiles: ParsedMarkdownFile[];
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