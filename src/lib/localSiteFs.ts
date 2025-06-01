// src/lib/localSiteFs.ts
import { LocalSiteData, SiteConfigFile, ParsedMarkdownFile } from '@/types';
import { parseMarkdownString, stringifyToMarkdown } from './markdownParser'; // Ensure these are robust

const LOCAL_STORAGE_KEY = 'signum-sites-data';

// --- Private Helper Functions ---
function _readAllSitesFromStorage(): LocalSiteData[] {
  if (typeof window === 'undefined') return []; // Guard for SSR or non-browser environments
  try {
    const jsonData = localStorage.getItem(LOCAL_STORAGE_KEY);
    return jsonData ? JSON.parse(jsonData) : [];
  } catch (error) {
    console.error("Error reading sites from localStorage:", error);
    return []; // Return empty array on error to prevent app crash
  }
}

function _writeAllSitesToStorage(sites: LocalSiteData[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sites));
  } catch (error) {
    console.error("Error writing sites to localStorage:", error);
  }
}

// --- Public API ---

/**
 * Loads all sites from local storage.
 */
export async function loadAllSites(): Promise<LocalSiteData[]> {
  return Promise.resolve(_readAllSitesFromStorage());
}

/**
 * Gets a specific site by its ID from local storage.
 */
export async function getSiteById(siteId: string): Promise<LocalSiteData | undefined> {
  const sites = _readAllSitesFromStorage();
  return Promise.resolve(sites.find(s => s.siteId === siteId));
}

/**
 * Saves a new site or updates an existing one in local storage.
 * This function is more generic now. Specific add/update logic can be in the store or calling components.
 */
export async function saveSite(siteData: LocalSiteData): Promise<void> {
  const sites = _readAllSitesFromStorage();
  const existingSiteIndex = sites.findIndex(s => s.siteId === siteData.siteId);

  if (existingSiteIndex > -1) {
    sites[existingSiteIndex] = siteData; // Update existing
  } else {
    sites.push(siteData); // Add new
  }
  _writeAllSitesToStorage(sites);
  return Promise.resolve();
}

/**
 * Deletes a site from local storage.
 */
export async function deleteSite(siteId: string): Promise<void> {
  let sites = _readAllSitesFromStorage();
  sites = sites.filter(s => s.siteId !== siteId);
  _writeAllSitesToStorage(sites);
  return Promise.resolve();
}

/**
 * Updates the configuration of a specific site.
 */
export async function saveSiteConfig(siteId: string, config: SiteConfigFile): Promise<void> {
  const sites = _readAllSitesFromStorage();
  const siteIndex = sites.findIndex(s => s.siteId === siteId);
  if (siteIndex > -1) {
    sites[siteIndex].config = config;
    _writeAllSitesToStorage(sites);
  } else {
    console.warn(`Site with ID ${siteId} not found for saving config.`);
  }
  return Promise.resolve();
}

/**
 * Adds or updates a content file within a specific site.
 * rawMarkdownContent includes frontmatter and body.
 */
export async function saveContentFile(siteId: string, path: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile | undefined> {
  const sites = _readAllSitesFromStorage();
  const siteIndex = sites.findIndex(s => s.siteId === siteId);

  if (siteIndex > -1) {
    const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
    const fileSlug = path.substring(path.lastIndexOf('/') + 1).replace('.md', '');
    
    const newOrUpdatedFile: ParsedMarkdownFile = {
      slug: fileSlug,
      path: path,
      frontmatter: frontmatter,
      content: content,
    };

    const contentFileIndex = sites[siteIndex].contentFiles.findIndex(f => f.path === path);
    if (contentFileIndex > -1) {
      sites[siteIndex].contentFiles[contentFileIndex] = newOrUpdatedFile;
    } else {
      sites[siteIndex].contentFiles.push(newOrUpdatedFile);
    }
    _writeAllSitesToStorage(sites);
    return Promise.resolve(newOrUpdatedFile);
  } else {
    console.warn(`Site with ID ${siteId} not found for saving content file.`);
    return Promise.resolve(undefined);
  }
}

/**
 * Deletes a content file from a specific site.
 */
export async function deleteContentFile(siteId: string, filePath: string): Promise<void> {
  const sites = _readAllSitesFromStorage();
  const siteIndex = sites.findIndex(s => s.siteId === siteId);

  if (siteIndex > -1) {
    sites[siteIndex].contentFiles = sites[siteIndex].contentFiles.filter(f => f.path !== filePath);
    _writeAllSitesToStorage(sites);
  } else {
    console.warn(`Site with ID ${siteId} not found for deleting content file.`);
  }
  return Promise.resolve();
}

/**
 * Lists all site IDs from local storage.
 */
export async function listSiteIds(): Promise<string[]> {
  const sites = _readAllSitesFromStorage();
  return Promise.resolve(sites.map(s => s.siteId));
}