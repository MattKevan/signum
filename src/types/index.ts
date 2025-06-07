// src/types/index.ts

// Represents a node in the hierarchical site structure.
// This is the primary building block for the manifest's structure.
export interface StructureNode {
  type: 'page' | 'collection';
  title: string;          // The display title (from frontmatter for pages).
  path: string;           // The FULL path from root, e.g., "content/blog/first-post.md".
  slug: string;           // The URL-friendly slug, e.g., "first-post".
  navOrder?: number;      // Optional: If present, item is in main nav. Used for sorting.
  children?: StructureNode[];

  // Collection-specific properties are now directly on the node.
  description?: string;
  sortBy?: 'date' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// Represents the theme configuration, now nested.
export interface ThemeConfig {
  name: 'default'; // For now, only 'default' is supported.
  config: {
    font_family: 'serif' | 'sans-serif' | 'monospace';
    color_scheme: 'light' | 'dark' | 'auto';
    primary_color: string;
  };
}

// The new, authoritative Manifest.
export interface Manifest {
  siteId: string;
  generatorVersion: string;

  // Site metadata is now top-level.
  title: string;
  description: string;
  author?: string;

  // Nested theme configuration.
  theme: ThemeConfig;

  // The single, hierarchical source of truth for all content.
  structure: StructureNode[];
}

// A raw markdown file parsed from storage.
export interface ParsedMarkdownFile {
  slug: string;
  path: string;
  frontmatter: MarkdownFrontmatter;
  content: string;
}

// The complete data for a site held in the app's state.
export interface LocalSiteData {
  siteId: string;
  manifest: Manifest;
  contentFiles: ParsedMarkdownFile[];
}

// Unchanged from before.
export interface MarkdownFrontmatter {
  title: string;
  date?: string;
  summary?: string;
  tags?: string[];
  status?: 'draft' | 'published';
  [key: string]: unknown;
}

// The state and actions for the Zustand store.
export interface AppState {
  sites: LocalSiteData[];
  addSite: (site: LocalSiteData) => Promise<void>;
  updateManifest: (siteId: string, manifest: Manifest) => Promise<void>;
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteSiteAndState: (siteId: string) => Promise<void>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  getSiteById: (siteId: string) => LocalSiteData | undefined;
  addNewCollection: (siteId: string, name: string, slug: string) => Promise<void>; // <-- THIS LINE IS ADDED
}

// A navigation link item for rendering menus (used by browsing/exporter).
export interface NavLinkItem {
  href: string;
  label: string;
  iconName?: string;
  isActive?: boolean;
  iconComponent?: React.ElementType;
  children?: NavLinkItem[];
}