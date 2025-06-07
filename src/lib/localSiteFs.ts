// src/lib/localSiteFs.ts

import { LocalSiteData, Manifest, ParsedMarkdownFile } from '@/types';
import { parseMarkdownString } from './markdownParser';

const LOCAL_STORAGE_KEY = 'signum-sites-data';

function _isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function _readAllSitesFromStorage(): LocalSiteData[] {
  if (!_isBrowser()) return [];
  try {
    const jsonData = localStorage.getItem(LOCAL_STORAGE_KEY);
    return jsonData ? JSON.parse(jsonData) : [];
  } catch (error) {
    console.error("Error reading sites from localStorage:", error);
    return [];
  }
}

function _writeAllSitesToStorage(sites: LocalSiteData[]): void {
  if (!_isBrowser()) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sites));
  } catch (error) {
    console.error("Error writing sites to localStorage:", error);
  }
}

export async function loadAllSites(): Promise<LocalSiteData[]> {
  return Promise.resolve(_readAllSitesFromStorage());
}

export async function getSiteById(siteId: string): Promise<LocalSiteData | null> {
  const sites = _readAllSitesFromStorage();
  const site = sites.find(s => s.siteId === siteId);
  return Promise.resolve(site || null);
}

export async function saveSite(siteData: LocalSiteData): Promise<void> {
  const sites = _readAllSitesFromStorage();
  const existingSiteIndex = sites.findIndex(s => s.siteId === siteData.siteId);
  if (existingSiteIndex > -1) {
    sites[existingSiteIndex] = siteData;
  } else {
    sites.push(siteData);
  }
  _writeAllSitesToStorage(sites);
  return Promise.resolve();
}

export async function deleteSite(siteId: string): Promise<void> {
  let sites = _readAllSitesFromStorage();
  sites = sites.filter(s => s.siteId !== siteId);
  _writeAllSitesToStorage(sites);
  return Promise.resolve();
}

// REPLACES saveSiteConfig
export async function saveManifest(siteId: string, manifest: Manifest): Promise<void> {
  const sites = _readAllSitesFromStorage();
  const siteIndex = sites.findIndex(s => s.siteId === siteId);
  if (siteIndex > -1) {
    sites[siteIndex].manifest = manifest;
    _writeAllSitesToStorage(sites);
  } else {
    throw new Error(`Site with ID ${siteId} not found for saving manifest.`);
  }
  return Promise.resolve();
}

export async function saveContentFile(siteId: string, path: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile | undefined> {
  const sites = _readAllSitesFromStorage();
  const siteIndex = sites.findIndex(s => s.siteId === siteId);
  if (siteIndex > -1) {
    try {
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
    } catch (parseError) {
      console.error(`Error parsing markdown for ${path} in site ${siteId}:`, parseError);
      return Promise.resolve(undefined);
    }
  } else {
    console.warn(`Site with ID ${siteId} not found for saving content file.`);
    return Promise.resolve(undefined);
  }
}

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