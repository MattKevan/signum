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
  // For now, no lastUpdated or content_timestamps as we are local-only
}

export interface MarkdownFrontmatter {
  title: string;
  date?: string; // ISO 8601
  [key: string]: any; // Allow other custom frontmatter fields
}

export interface ParsedMarkdownFile {
  slug: string; // e.g., "my-first-post" or "about"
  path: string; // e.g., "content/posts/my-first-post.md"
  frontmatter: MarkdownFrontmatter;
  content: string; // Raw Markdown content body
  htmlContent?: string; // Rendered HTML (optional, can be done on-the-fly)
}

// Represents a site structure as stored/managed locally
export interface LocalSiteData {
  siteId: string; // For local dev, could be a simple slug or UUID
  config: SiteConfigFile;
  contentFiles: ParsedMarkdownFile[]; // Array of parsed markdown files
  // Later: follows.yaml, blocks.yaml etc. as structured objects
}

// For state management
export interface AppState {
  sites: LocalSiteData[]; // List of locally managed sites
  addSite: (site: LocalSiteData) => void;
  updateSiteConfig: (siteId: string, config: SiteConfigFile) => void;
  addContentFile: (siteId: string, file: ParsedMarkdownFile) => void;
  updateContentFile: (siteId: string, filePath: string, newContent: string, newFrontmatter: MarkdownFrontmatter) => void;
  getSiteById: (siteId: string) => LocalSiteData | undefined;
  // Later, methods for active editing site, etc.
}