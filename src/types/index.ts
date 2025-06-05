// src/types/index.ts

export interface SiteConfigFile {
  title: string;
  description: string;
  author?: string;
  // Style hints are now top-level optional properties
  font_family?: 'serif' | 'sans-serif' | 'monospace';
  theme?: 'light' | 'dark' | 'auto';
  primary_color?: string; // Hex color string e.g., #RRGGBB

  collections?: Array<{
    path: string;
    nav_label?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }>;
}

export interface MarkdownFrontmatter {
  title: string;
  date?: string; // ISO 8601 (YYYY-MM-DD)
  summary?: string;
  tags?: string[];
  status?: 'draft' | 'published';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // For custom fields
}

export interface ParsedMarkdownFile {
  slug: string;
  path: string;
  frontmatter: MarkdownFrontmatter;
  content: string;
}

export interface LocalSiteData {
  siteId: string;
  config: SiteConfigFile;
  contentFiles: ParsedMarkdownFile[];
}

export interface AppState {
  sites: LocalSiteData[];
  addSite: (site: LocalSiteData) => Promise<void>;
  updateSiteConfig: (siteId: string, config: SiteConfigFile) => Promise<void>;
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteSiteAndState: (siteId: string) => Promise<void>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  getSiteById: (siteId: string) => LocalSiteData | undefined;
}

export interface NavLinkItem {
  href: string;
  label: string;
  iconName?: string;
  isActive?: boolean;
  iconComponent?: React.ElementType;
}