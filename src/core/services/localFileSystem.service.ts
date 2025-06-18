// src/lib/localSiteFs.ts
import { LocalSiteData, Manifest, ParsedMarkdownFile, RawFile } from '@/types'; // Ensure RawFile is imported
import localforage from 'localforage';
import { stringifyToMarkdown, parseMarkdownString } from '@/lib/markdownParser';

const DB_NAME = 'SignumDB';

const siteManifestsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteManifests',
});

const siteContentFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteContentFiles',
});

const siteLayoutFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteLayoutFiles',
});

const siteThemeFilesStore = localforage.createInstance({
    name: DB_NAME,
    storeName: 'siteThemeFiles',
});

const siteImageAssetsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteImageAssets',
});

// --- Function to load only manifests for a fast initial load ---
export async function loadAllSiteManifests(): Promise<Manifest[]> {
  const manifests: Manifest[] = [];
  await siteManifestsStore.iterate((value: Manifest) => {
    manifests.push(value);
  });
  return manifests;
}

/**
 * Fetches the manifest for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<Manifest | null>} A Promise that resolves to the Manifest object, or null if not found.
 */
export async function getManifestById(siteId: string): Promise<Manifest | null> {
  const manifest = await siteManifestsStore.getItem<Manifest>(siteId);
  return manifest ?? null;
}

/**
 * Fetches the content files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<ParsedMarkdownFile[]>} A Promise that resolves to an array of parsed markdown files.
 */
export async function getSiteContentFiles(siteId: string): Promise<ParsedMarkdownFile[]> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId);
    return contentFiles ?? [];
}

/**
 * Fetches the custom layout files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<RawFile[]>} A Promise that resolves to an array of raw layout files.
 */
export async function getSiteLayoutFiles(siteId: string): Promise<RawFile[]> {
    const layoutFiles = await siteLayoutFilesStore.getItem<RawFile[]>(siteId);
    return layoutFiles ?? [];
}

/**
 * Fetches the custom theme files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<RawFile[]>} A Promise that resolves to an array of raw theme files.
 */
export async function getSiteThemeFiles(siteId: string): Promise<RawFile[]> {
    const themeFiles = await siteThemeFilesStore.getItem<RawFile[]>(siteId);
    return themeFiles ?? [];
}

export async function saveSite(siteData: LocalSiteData): Promise<void> {
  await Promise.all([
    siteManifestsStore.setItem(siteData.siteId, siteData.manifest),
    siteContentFilesStore.setItem(siteData.siteId, siteData.contentFiles ?? []),
    siteLayoutFilesStore.setItem(siteData.siteId, siteData.layoutFiles ?? []),
    siteThemeFilesStore.setItem(siteData.siteId, siteData.themeFiles ?? []),
  ]);
}

export async function deleteSite(siteId: string): Promise<void> {
  await Promise.all([
    siteManifestsStore.removeItem(siteId),
    siteContentFilesStore.removeItem(siteId),
    siteLayoutFilesStore.removeItem(siteId),
    siteThemeFilesStore.removeItem(siteId),
  ]);
}

export async function saveManifest(siteId: string, manifest: Manifest): Promise<void> {
    await siteManifestsStore.setItem(siteId, manifest);
}

export async function saveContentFile(siteId: string, filePath: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];

    const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
    const fileSlug = filePath.replace(/^content\//, '').replace(/\.md$/, '');
    const savedFile: ParsedMarkdownFile = { slug: fileSlug, path: filePath, frontmatter, content };

    const fileIndex = contentFiles.findIndex(f => f.path === filePath);
    if (fileIndex > -1) {
      contentFiles[fileIndex] = savedFile;
    } else {
      contentFiles.push(savedFile);
    }

    await siteContentFilesStore.setItem(siteId, contentFiles);
    return savedFile;
}

export async function deleteContentFile(siteId: string, filePath: string): Promise<void> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const updatedContentFiles = contentFiles.filter(f => f.path !== filePath);
    await siteContentFilesStore.setItem(siteId, updatedContentFiles);
}

export async function getContentFileRaw(siteId: string, filePath: string): Promise<string | null> {
    const allFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const fileData = allFiles.find(f => f.path === filePath);
    if (!fileData) return null;
    
    return stringifyToMarkdown(fileData.frontmatter, fileData.content);
}

/**
 * Moves a set of content files from old paths to new paths in a single transaction.
 * @param {string} siteId - The ID of the site.
 * @param {{oldPath: string, newPath: string}[]} pathsToMove - An array of path mapping objects.
 * @returns {Promise<void>}
 */
export async function moveContentFiles(siteId: string, pathsToMove: { oldPath: string, newPath: string }[]): Promise<void> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    
    const updatedFiles = contentFiles.map(file => {
        const moveInstruction = pathsToMove.find(p => p.oldPath === file.path);
        if (moveInstruction) {
            const newSlug = moveInstruction.newPath.split('/').pop()?.replace('.md', '') || '';
            return { ...file, path: moveInstruction.newPath, slug: newSlug };
        }
        return file;
    });
    
    await siteContentFilesStore.setItem(siteId, updatedFiles);
}

/**
 * Saves a binary image asset (as a Blob) to storage for a specific site.
 * @param siteId The ID of the site.
 * @param imagePath The relative path to the image (e.g., 'assets/images/foo.jpg').
 * @param imageData The image data as a Blob.
 */
export async function saveImageAsset(siteId: string, imagePath: string, imageData: Blob): Promise<void> {
  const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob>>(siteId) || {};
  imageMap[imagePath] = imageData;
  await siteImageAssetsStore.setItem(siteId, imageMap);
}

/**
 * Retrieves a binary image asset (as a Blob) from storage for a specific site.
 * @param siteId The ID of the site to look within.
 * @param imagePath The relative path of the image to retrieve.
 * @returns A Promise that resolves to the image Blob, or null if not found.
 */
export async function getImageAsset(siteId: string, imagePath: string): Promise<Blob | null> {
  // <-- FIX: This is now much more efficient and correct.
  // 1. Get the image map for the specific site.
  const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob>>(siteId);
  if (!imageMap) {
    return null; // The site has no images.
  }
  // 2. Return the image from the map, or null if it doesn't exist.
  return imageMap[imagePath] || null;
}
