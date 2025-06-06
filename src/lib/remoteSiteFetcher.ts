// src/lib/remoteSiteFetcher.ts
import { LocalSiteData, ParsedMarkdownFile, SiteConfigFile, Manifest } from '@/types';
import { parseMarkdownString } from './markdownParser';

/**
 * Fetches the text content of a single file from a remote server.
 * This is a low-level helper for fetching manifest, content, etc.
 * @param baseUrl The base URL of the remote site (e.g., "http://example.com").
 * @param filePath The path to the file relative to the base URL (e.g., "_signum/manifest.json").
 * @returns A Promise that resolves to the text content of the file.
 * @throws An error if the network request fails or the server returns a non-2xx status.
 */
async function fetchRemoteFile(baseUrl: string, filePath: string): Promise<string> {
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanFilePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const url = `${cleanBaseUrl}/${cleanFilePath}`;
  
  console.log(`[RFS] Attempting: GET ${url}`);
  try {
    const response = await fetch(url, { cache: 'no-store', mode: 'cors' });
    console.log(`[RFS] Status for ${url}: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Could not read error response body");
      console.error(`[RFS] FAILED fetch ${url}. Status: ${response.status}. Body: ${errorText.substring(0, 200)}...`);
      throw new Error(`Fetch failed for ${url}: ${response.statusText} (${response.status})`);
    }
    const textContent = await response.text();
    console.log(`[RFS] SUCCESS fetch ${url}. Length: ${textContent.length}`);
    return textContent;
  } catch (networkError) {
    console.error(`[RFS] NETWORK ERROR fetching ${url}:`, networkError);
    throw networkError;
  }
}

/**
 * Fetches and reconstructs an entire remote Signum site into the LocalSiteData format.
 * It starts by fetching the manifest, then fetches all content files listed within it.
 * This is the primary function for viewing a remote site within the Signum client.
 * @param remoteSiteUrl The base URL of the remote Signum site.
 * @returns A Promise that resolves to a complete LocalSiteData object, or null if fetching fails.
 */
export async function fetchRemoteSiteData(remoteSiteUrl: string): Promise<LocalSiteData | null> {
  console.log(`[RFS] >>> Starting fetchRemoteSiteData for URL: ${remoteSiteUrl}`);
  if (!remoteSiteUrl || !remoteSiteUrl.startsWith('http')) {
    console.error(`[RFS] Invalid remoteSiteUrl provided: ${remoteSiteUrl}`);
    return null;
  }

  try {
    // 1. Fetch manifest.json. This is now the single entry point for site metadata.
    console.log(`[RFS] Fetching manifest.json...`);
    const manifestString = await fetchRemoteFile(remoteSiteUrl, '_signum/manifest.json');
    let manifest: Manifest;
    try {
      manifest = JSON.parse(manifestString);
      console.log(`[RFS] Parsed manifest:`, JSON.stringify(manifest, null, 2).substring(0, 500) + "...");
    } catch (e) {
      console.error(`[RFS] FAILED to parse manifest.json. Content: ${manifestString.substring(0,200)}...`, e);
      return null;
    }

    if (!manifest || !manifest.config || !manifest.entries || !Array.isArray(manifest.entries) || !manifest.siteId) {
        console.error("[RFS] Invalid manifest structure: 'config', 'entries' array, or 'siteId' is missing or invalid.", manifest);
        return null;
    }

    // 2. Get site config directly from the manifest. No need to fetch site.yaml anymore.
    const siteConfig: SiteConfigFile = manifest.config;
    // Fallback for title if it's missing in the config from the manifest.
    if (!siteConfig.title) {
      siteConfig.title = new URL(remoteSiteUrl).hostname || 'Remote Site';
    }
    console.log(`[RFS] Loaded siteConfig from manifest:`, siteConfig);
    
    // 3. Fetch all content files listed in the manifest's 'entries' array.
    const contentFilesPromises: Promise<ParsedMarkdownFile | null>[] = manifest.entries
      .filter(entry => entry.sourcePath && entry.sourcePath.startsWith('_signum/content/') && entry.sourcePath.endsWith('.md'))
      .map(async (entry) => {
        // The sourcePath is like `_signum/content/about.md`.
        // The file to fetch on the server is at the root, e.g., `http://site.com/content/about.md`.
        const filePathToFetch = entry.sourcePath.replace(/^_signum\//, '');
        console.log(`[RFS] Processing MD file from manifest entry: ${filePathToFetch}`);
        try {
          const rawMarkdown = await fetchRemoteFile(remoteSiteUrl, filePathToFetch);
          const { frontmatter, content } = parseMarkdownString(rawMarkdown);
          // The path for LocalSiteData should be the path relative to the content root, e.g., 'content/about.md'.
          return { slug: entry.slug, path: filePathToFetch, frontmatter, content };
        } catch (mdError) {
          console.warn(`[RFS] FAILED to fetch or parse MD file ${filePathToFetch}:`, mdError);
          return null;
        }
      });
    
    const resolvedContentFiles = await Promise.all(contentFilesPromises);
    const validContentFiles = resolvedContentFiles.filter(file => file !== null) as ParsedMarkdownFile[];
    console.log(`[RFS] Fetched and parsed ${validContentFiles.length} content files.`);

    if (!validContentFiles.some(f => f.path === 'content/index.md')) {
        console.warn(`[RFS] No 'content/index.md' found in remote site bundle. Site might be incomplete.`);
    }
    
    const appSpecificSiteId = `remote-${manifest.siteId}`; // Use siteId from manifest for app's internal tracking.

    const finalSiteData: LocalSiteData = {
      siteId: appSpecificSiteId,
      config: siteConfig,
      contentFiles: validContentFiles,
    };
    console.log(`[RFS] <<< Successfully constructed remote site data for ${appSpecificSiteId}`);
    return finalSiteData;

  } catch (error) {
    console.error(`[RFS] <<< CRITICAL ERROR in fetchRemoteSiteData for ${remoteSiteUrl}:`, error);
    return null;
  }
}