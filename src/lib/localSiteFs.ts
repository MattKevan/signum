// src/lib/localSiteFs.ts

import { LocalSiteData, Manifest, ParsedMarkdownFile } from '@/types';
import { parseMarkdownString } from './markdownParser';

const LOCAL_STORAGE_KEY = 'signum-sites-data';

// --- Private Helper Functions ---

function _isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * A central function to handle reading, mutating, and writing the entire sites array.
 * This reduces code duplication and centralizes error handling for storage operations.
 * @param mutation A function that receives the sites array and returns the mutated version.
 * @throws If there is an error reading or writing to localStorage.
 */
function _updateStorage(mutation: (sites: LocalSiteData[]) => LocalSiteData[]): void {
  if (!_isBrowser()) return;
  try {
    const jsonData = localStorage.getItem(LOCAL_STORAGE_KEY);
    const currentSites = jsonData ? JSON.parse(jsonData) : [];
    const newSites = mutation(currentSites);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSites));
  } catch (error) {
    console.error("Critical error accessing localStorage:", error);
    // Re-throw as a more generic error for the UI to catch
    throw new Error("Could not access browser storage. Your changes might not be saved.");
  }
}

// --- Public API ---

export async function loadAllSites(): Promise<LocalSiteData[]> {
  if (!_isBrowser()) return Promise.resolve([]);
  return Promise.resolve(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]'));
}

export async function getSiteById(siteId: string): Promise<LocalSiteData | null> {
    const sites = await loadAllSites();
    return Promise.resolve(sites.find(s => s.siteId === siteId) || null);
}

export async function saveSite(siteData: LocalSiteData): Promise<void> {
  _updateStorage(sites => {
    const existingSiteIndex = sites.findIndex(s => s.siteId === siteData.siteId);
    if (existingSiteIndex > -1) {
      sites[existingSiteIndex] = siteData;
    } else {
      sites.push(siteData);
    }
    return sites;
  });
  return Promise.resolve();
}

export async function deleteSite(siteId: string): Promise<void> {
  _updateStorage(sites => sites.filter(s => s.siteId !== siteId));
  return Promise.resolve();
}

export async function saveManifest(siteId: string, manifest: Manifest): Promise<void> {
  _updateStorage(sites => {
    const siteIndex = sites.findIndex(s => s.siteId === siteId);
    if (siteIndex === -1) {
      throw new Error(`Site with ID ${siteId} not found.`);
    }
    sites[siteIndex].manifest = manifest;
    return sites;
  });
  return Promise.resolve();
}

export async function saveContentFile(siteId: string, path: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile> {
  let savedFile: ParsedMarkdownFile | null = null;
  _updateStorage(sites => {
    const siteIndex = sites.findIndex(s => s.siteId === siteId);
    if (siteIndex === -1) {
      throw new Error(`Site with ID ${siteId} not found.`);
    }
    try {
      const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
      const fileSlug = path.substring(path.lastIndexOf('/') + 1).replace('.md', '');
      const newOrUpdatedFile: ParsedMarkdownFile = { slug: fileSlug, path, frontmatter, content };
      
      const contentFileIndex = sites[siteIndex].contentFiles.findIndex(f => f.path === path);
      if (contentFileIndex > -1) {
        sites[siteIndex].contentFiles[contentFileIndex] = newOrUpdatedFile;
      } else {
        sites[siteIndex].contentFiles.push(newOrUpdatedFile);
      }
      savedFile = newOrUpdatedFile;
      return sites;
    } catch (parseError) {
      // Re-throw the specific parsing error so the UI can display it
      throw parseError;
    }
  });

  if (!savedFile) {
    // This case should theoretically not be reached if no errors were thrown
    throw new Error("An unknown error occurred while saving the file.");
  }
  return Promise.resolve(savedFile);
}


export async function deleteContentFile(siteId: string, filePath: string): Promise<void> {
    _updateStorage(sites => {
        const siteIndex = sites.findIndex(s => s.siteId === siteId);
        if (siteIndex > -1) {
            sites[siteIndex].contentFiles = sites[siteIndex].contentFiles.filter(f => f.path !== filePath);
        }
        // No error thrown if site not found, as the goal is to ensure the file is gone.
        return sites;
    });
    return Promise.resolve();
}