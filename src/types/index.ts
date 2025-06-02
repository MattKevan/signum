// src/types/index.ts

export interface SiteConfigFile {
  title: string;
  description: string;
  author?: string;
  style_hints?: {
    font_family?: 'serif' | 'sans-serif' | 'monospace';
    theme?: 'light' | 'dark' | 'auto';
    primary_color?: string;
  };
}

export interface MarkdownFrontmatter {
  title: string;
  date?: string; // ISO 8601
  summary?: string; // Added for consistency with metadata
  // Allow other custom frontmatter fields
  // Example: ogImage?: string;
  // Example: tags?: string[];
  [key: string]: any; 
}

export interface ParsedMarkdownFile {
  slug: string; 
  path: string; 
  frontmatter: MarkdownFrontmatter;
  content: string; // Raw Markdown content body
  // htmlContent?: string; // Optional, rendered HTML (not currently used for primary rendering)
}

export interface LocalSiteData {
  siteId: string; 
  config: SiteConfigFile;
  contentFiles: ParsedMarkdownFile[];
  // Future:
  // follows?: any[]; // Define type for follows
  // blocks?: any[];  // Define type for blocks
  // curations?: any[]; // Define type for curations
  // likes?: any[]; // Define type for likes
}

// This is the interface for the Zustand store's state and actions
export interface AppState {
  sites: LocalSiteData[];
  addSite: (site: LocalSiteData) => Promise<void>; // Keep as Promise if it involves async FS operations
  updateSiteConfig: (siteId: string, config: SiteConfigFile) => Promise<void>;
  
  // REMOVE old methods:
  // addContentFile: (siteId: string, file: ParsedMarkdownFile) => void; 
  // updateContentFile: (siteId: string, filePath: string, newContent: string, newFrontmatter: MarkdownFrontmatter) => void;
  
  // ADD the new combined method signature that store will implement
  // The store itself might have an implementation for addOrUpdateContentFile,
  // but this AppState interface is what components would expect if they directly
  // consumed a more generic "app state" object.
  // For now, let's keep AppState lean and AppStore (in useAppStore.ts) will define its specific extended methods.
  // OR, we make AppState match what AppStore provides:

  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteSiteAndState: (siteId: string) => Promise<void>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;

  getSiteById: (siteId: string) => LocalSiteData | undefined;
}