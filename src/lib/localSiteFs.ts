// src/lib/localSiteFs.ts
import { LocalSiteData, Manifest, ParsedMarkdownFile, RawFile } from '@/types';
import localforage from 'localforage';
import { parseMarkdownString, stringifyToMarkdown } from './markdownParser';

/**
 * This module provides a file system-like abstraction for storing and retrieving
 * Signum site data in the browser's storage. It uses LocalForage, which provides
 * a simple, Promise-based API over IndexedDB for robust, asynchronous, and
 * large-capacity storage.
 */

// --- Configuration ---
const DB_NAME = 'SignumDB';

const siteManifestsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteManifests', // Stores Manifest objects, keyed by siteId
});

const siteContentFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteContentFiles', // Stores ParsedMarkdownFile[], keyed by siteId
});

const siteLayoutFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteLayoutFiles', // Stores RawFile[], keyed by siteId
});

const siteThemeFilesStore = localforage.createInstance({
    name: DB_NAME,
    storeName: 'siteThemeFiles', // Stores RawFile[], keyed by siteId
});


// --- Public API ---

/**
 * Loads all sites from storage by iterating over the manifests and then
 * fetching the associated data for each one.
 * @returns A Promise that resolves to an array of all LocalSiteData objects.
 */
export async function loadAllSites(): Promise<LocalSiteData[]> {
  const manifests: Manifest[] = [];
  await siteManifestsStore.iterate((value: Manifest) => {
    manifests.push(value);
  });

  const sites = await Promise.all(manifests.map(async (manifest) => {
    const [contentFiles, layoutFiles, themeFiles] = await Promise.all([
      siteContentFilesStore.getItem<ParsedMarkdownFile[]>(manifest.siteId),
      siteLayoutFilesStore.getItem<RawFile[]>(manifest.siteId),
      siteThemeFilesStore.getItem<RawFile[]>(manifest.siteId),
    ]);
    
    return {
      siteId: manifest.siteId,
      manifest,
      contentFiles: contentFiles ?? [],
      layoutFiles: layoutFiles ?? [],
      themeFiles: themeFiles ?? [],
    };
  }));

  return sites;
}

/**
 * Retrieves a single, complete site object by its ID.
 * @param siteId The ID of the site to retrieve.
 * @returns A Promise resolving to the LocalSiteData object, or null if not found.
 */
export async function getSiteById(siteId: string): Promise<LocalSiteData | null> {
    const manifest = await siteManifestsStore.getItem<Manifest>(siteId);
    if (!manifest) return null;

    const [contentFiles, layoutFiles, themeFiles] = await Promise.all([
        siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId),
        siteLayoutFilesStore.getItem<RawFile[]>(siteId),
        siteThemeFilesStore.getItem<RawFile[]>(siteId),
    ]);
    
    return {
      siteId,
      manifest,
      contentFiles: contentFiles ?? [],
      layoutFiles: layoutFiles ?? [],
      themeFiles: themeFiles ?? []
    };
}

/**
 * Saves an entire site data object. This is useful for creating new sites
 * or for large-scale migrations. It overwrites all parts of an existing site.
 * @param siteData The complete site data object to save.
 */
export async function saveSite(siteData: LocalSiteData): Promise<void> {
  await Promise.all([
    siteManifestsStore.setItem(siteData.siteId, siteData.manifest),
    siteContentFilesStore.setItem(siteData.siteId, siteData.contentFiles),
    siteLayoutFilesStore.setItem(siteData.siteId, siteData.layoutFiles ?? []),
    siteThemeFilesStore.setItem(siteData.siteId, siteData.themeFiles ?? []),
  ]);
}

/**
 * Deletes a site and all its associated data from storage.
 * @param siteId The ID of the site to delete.
 */
export async function deleteSite(siteId: string): Promise<void> {
  await Promise.all([
    siteManifestsStore.removeItem(siteId),
    siteContentFilesStore.removeItem(siteId),
    siteLayoutFilesStore.removeItem(siteId),
    siteThemeFilesStore.removeItem(siteId),
  ]);
}

/**
 * Saves just the manifest for a given site.
 * @param siteId The ID of the site whose manifest is being saved.
 * @param manifest The new Manifest object.
 */
export async function saveManifest(siteId: string, manifest: Manifest): Promise<void> {
    await siteManifestsStore.setItem(siteId, manifest);
}

/**
 * Saves a single content file (.md) for a site. It reads the existing file
 * list, adds or updates the specified file, and writes the entire list back.
 * @param siteId The ID of the site.
 * @param filePath The path of the file within the site (e.g., "content/posts/my-post.md").
 * @param rawMarkdownContent The full string content of the markdown file.
 * @returns The parsed file object that was saved.
 */
export async function saveContentFile(siteId: string, filePath: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    
    const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
    const fileSlug = filePath.substring(filePath.lastIndexOf('/') + 1).replace('.md', '');
    const savedFile: ParsedMarkdownFile = { slug: fileSlug, path: filePath, frontmatter, content };

    const fileIndex = contentFiles.findIndex(f => f.path === filePath);
    if (fileIndex > -1) {
      contentFiles[fileIndex] = savedFile; // Update existing
    } else {
      contentFiles.push(savedFile); // Add new
    }
    
    await siteContentFilesStore.setItem(siteId, contentFiles);
    return savedFile;
}

/**
 * Deletes a single content file from a site's data.
 * @param siteId The ID of the site.
 * @param filePath The path of the file to delete.
 */
export async function deleteContentFile(siteId: string, filePath: string): Promise<void> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const updatedContentFiles = contentFiles.filter(f => f.path !== filePath);
    await siteContentFilesStore.setItem(siteId, updatedContentFiles);
}

/**
 * Retrieves the raw string content of a single file by reconstructing it
 * from the stored parsed data. This is useful for loading the freshest version
_ * of a file without relying on the main app state.
_ * @param siteId The ID of the site.
_ * @param filePath The path of the file to retrieve.
_ * @returns A Promise resolving to the raw markdown string, or null if not found.
 */
export async function getContentFileRaw(siteId: string, filePath: string): Promise<string | null> {
    const allFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const fileData = allFiles.find(f => f.path === filePath);
    if (!fileData) return null;
    
    // Reconstruct the full markdown string from its parts
    return stringifyToMarkdown(fileData.frontmatter, fileData.content);
}