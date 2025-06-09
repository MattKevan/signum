// src/types/index.ts
//import { RJSFSchema } from '@rjsf/utils'; // Import RJSFSchema

// Represents a node in the hierarchical site structure.
export interface StructureNode {
  type: 'page' | 'collection';
  title: string;
  path: string;
  slug: string;
  navOrder?: number;
  children?: StructureNode[];
  layout: string;
  // This property is specific to collection nodes, so it's optional.
  itemLayout?: string;
  // CORRECTED: Add an index signature to allow for arbitrary properties
  // from the theme's schema, making the node a flexible data container.
  [key: string]: unknown;
}

// Represents the theme configuration.
export interface ThemeConfig {
  name: string; // This is the theme's ID, e.g., "default"
  type: 'core' | 'contrib'; // The new type property
  config: {
    [key: string]: string | boolean | number;
  };
}

// The new, authoritative Manifest.
export interface Manifest {
  siteId: string;
  generatorVersion: string;
  title: string;
  description: string;
  author?: string;
  theme: ThemeConfig;
  structure: StructureNode[];
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

// The complete data for a site held in the app's state.
export interface LocalSiteData {
  siteId: string;
  manifest: Manifest;
  contentFiles: ParsedMarkdownFile[];
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