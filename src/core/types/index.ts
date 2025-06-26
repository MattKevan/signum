// src/core/types/index.ts

// ============================================================================
// NEW & REFACTORED TYPES FOR THE LAYOUT-DRIVEN ARCHITECTURE
// ============================================================================

/**
 * Represents a single choice within a `DisplayOption` variant group.
 * e.g., A "Grid View" option within a "Listing Style" variant.
 */
export interface DisplayOptionChoice {
  name: string;
  description?: string;
  template: string;
}

/**
 * Defines a group of user-selectable display variants in a layout manifest.
 * e.g., The "Listing Style" variant, which contains "List" and "Grid" options.
 */
export interface DisplayOption {
  name: string;
  description?: string;
  default: string;
  options: Record<string, DisplayOptionChoice>;
}

/**
 * Represents the configuration stored in the frontmatter of a "Collection Page".
 * It stores the user's selected keys from the `display_options` defined in the layout.
 */
export interface CollectionConfig {
  [key: string]: string | number | undefined;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  items_per_page?: number;
}

/**
 * Represents metadata for a layout asset in the file system.
 */
export interface LayoutInfo {
  id: string;
  name: string;
  type: 'page' | 'collection';
  path: string;
  description?: string;
}

// ============================================================================
// CORE DATA STRUCTURES
// ============================================================================

/**
 * Represents a node in the site's hierarchical structure, as defined in `manifest.json`.
 */
export interface StructureNode {
  type: 'page';
  title: string;
  menuTitle?: string;
  path: string;
  slug: string;
  navOrder?: number;
  children?: StructureNode[];
  [key: string]: unknown;
}

/**
 * Represents the theme-specific appearance configuration saved in the manifest.
 */
export interface ThemeConfig {
  name: string;
  config: Record<string, string | boolean | number>;
  themeData?: Record<string, unknown>;
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
 * Represents the fields within a content file's YAML frontmatter.
 */
export interface MarkdownFrontmatter {
  title: string;
  layout: string; 
  collection?: CollectionConfig;
  homepage?: boolean;
  [key: string]: unknown;
}

/**
 * Represents a raw markdown file that has been parsed from storage.
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
 * Represents the main `manifest.json` file for a single site.
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
  logo?: ImageRef;
  favicon?: ImageRef;
  settings?: {
    imageService?: 'local' | 'cloudinary';
    cloudinary?: {
      cloudName?: string;
    },
    [key: string]: unknown; 
  };
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
  dataFiles?: Record<string, string>; // Added for storing data like categories.json
  secrets?: SiteSecrets;
}

// ============================================================================
// DERIVED & HELPER TYPES FOR RENDERING
// ============================================================================

/**
 * Represents a link used for rendering navigation menus.
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
  DynamicPage, // Added for dynamically generated pages like category archives
  NotFound,
}

/**
 * Represents a single term from a taxonomy data file (e.g., a single category).
 */
export interface TaxonomyTerm {
  slug: string;
  name: string;
  description?: string;
  [key: string]: unknown; // Allows for other properties
}

/**
 * The base structure for a page resolution result, containing common properties.
 */
interface BasePageResolution {
  pageTitle: string;
  layoutPath: string;
  collectionItems?: ParsedMarkdownFile[]; 
  pagination?: PaginationData;
}

/**
 * Represents the resolved data for a standard, static page from the `structure.json`.
 */
interface SinglePageResolution extends BasePageResolution {
  type: PageType.SinglePage;
  contentFile: ParsedMarkdownFile;
}

/**
 * --- NEW ---
 * Represents the resolved data for a dynamically generated page, like a category archive.
 * It includes the `term` (e.g., the specific category object) that this page represents.
 */
interface DynamicPageResolution extends BasePageResolution {
  type: PageType.DynamicPage;
  /** The content file of the parent collection (e.g., the main 'blog' page). */
  contentFile: ParsedMarkdownFile;
  /** The specific taxonomy term object (e.g., the category) this page is for. */
  term: TaxonomyTerm;
}

/**
 * Represents the complete, resolved data package for any page render.
 * This is the primary object passed to the theme engine.
 */
export type PageResolutionResult = 
  | SinglePageResolution
  | DynamicPageResolution
  | {
      type: PageType.NotFound;
      errorMessage: string;
    };


// ============================================================================
// IMAGE & SERVICE TYPES
// ============================================================================

/** The storable reference to an uploaded image. This goes in frontmatter. */
export interface ImageRef {
  serviceId: 'local' | 'cloudinary';
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

/** Transformation options requested by the theme engine. */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale';
  gravity?: 'center' | 'north' | 'south' | 'east' | 'west' | 'auto';
  format?: 'webp' | 'avif' | 'jpeg';
}

/** The interface/contract that all image services must implement. */
export interface ImageService {
  id: string;
  name: string;
  upload(file: File, siteId: string): Promise<ImageRef>;
  getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, isExport: boolean): Promise<string>;
  getExportableAssets(siteId: string, allImageRefs: ImageRef[]): Promise<{ path: string; data: Blob; }[]>;
}

/** Defines the shape of the sensitive, non-public data for a site. */
export interface SiteSecrets {
  cloudinary?: {
    uploadPreset?: string;
  };
}

/**
 * Represents the in-memory site bundle generated by the builder services.
 * It's a map of file paths to their content, which can be a string or a binary Blob.
 */
export interface SiteBundle {
  [filePath: string]: string | Blob;
}