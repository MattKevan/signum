// src/types/index.ts

export interface NavItem {
  type: 'page' | 'collection' | 'folder';
  path: string;
  order: number;
  children?: NavItem[];
}

export interface SiteConfigFile {
  title: string;
  description: string;
  author?: string;
  font_family?: 'serif' | 'sans-serif' | 'monospace';
  theme?: 'light' | 'dark' | 'auto';
  primary_color?: string;

  collections?: Array<{
    path: string;
    nav_label?: string;
    description?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }>;
  nav_items?: NavItem[];
}

export interface MarkdownFrontmatter {
  title: string;
  date?: string;
  summary?: string;
  tags?: string[];
  status?: 'draft' | 'published';
  // CORRECTED: Replaced 'any' with 'unknown' for better type safety.
  // This allows for arbitrary custom fields while encouraging type-checking.
  [key: string]: unknown;
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
  updateSiteStructure: (siteId: string, navItems: NavItem[]) => Promise<void>;
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string, isNewFile?: boolean) => Promise<boolean>;
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
  children?: NavLinkItem[];
}

export interface ManifestEntry {
  type: 'page' | 'collection_index';
  status: 'draft' | 'published';
  sourcePath: string;
  htmlPath: string;
  url: string;
  title?: string;
  date?: string;
  slug: string;
}

export interface Manifest {
  siteId: string;
  generatorVersion: string;
  config: SiteConfigFile;
  entries: ManifestEntry[];
}