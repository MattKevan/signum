// src/lib/remoteSiteFetcher.ts
import { LocalSiteData, ParsedMarkdownFile, SiteConfigFile, MarkdownFrontmatter } from '@/types';
import { parseMarkdownString } from './markdownParser';
import yaml from 'js-yaml';

interface RemoteManifestFileEntry {
  path: string;
  lastUpdated?: string;
}

export interface RemoteManifest {
  siteId: string; // Should be present in a well-formed manifest
  title?: string;
  description?: string;
  lastUpdated?: string;
  files: RemoteManifestFileEntry[]; // Must be present
  rssFeedUrl?: string;
}

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
  } catch (networkError) { // Catches fetch() itself failing (e.g., DNS, network down, CORS not properly resolved by browser)
    console.error(`[RFS] NETWORK ERROR fetching ${url}:`, networkError);
    throw networkError; // Re-throw to be caught by fetchRemoteSiteData
  }
}

export async function fetchRemoteSiteData(remoteSiteUrl: string): Promise<LocalSiteData | null> {
  console.log(`[RFS] >>> Starting fetchRemoteSiteData for URL: ${remoteSiteUrl}`);
  if (!remoteSiteUrl || !remoteSiteUrl.startsWith('http')) {
    console.error(`[RFS] Invalid remoteSiteUrl provided: ${remoteSiteUrl}`);
    return null;
  }

  try {
    // 1. Fetch manifest.json
    console.log(`[RFS] Fetching manifest.json...`);
    const manifestString = await fetchRemoteFile(remoteSiteUrl, 'manifest.json');
    let manifest: RemoteManifest;
    try {
      manifest = JSON.parse(manifestString);
      console.log(`[RFS] Parsed manifest:`, JSON.stringify(manifest, null, 2).substring(0, 500) + "...");
    } catch (e) {
      console.error(`[RFS] FAILED to parse manifest.json. Content: ${manifestString.substring(0,200)}...`, e);
      return null;
    }

    if (!manifest || !manifest.files || !Array.isArray(manifest.files) || !manifest.siteId) {
        console.error("[RFS] Invalid manifest structure: 'files' array or 'siteId' is missing or invalid.", manifest);
        return null;
    }

    let siteConfig: SiteConfigFile = {
      title: manifest.title || new URL(remoteSiteUrl).hostname || 'Remote Site',
      description: manifest.description || '',
      author: '', 
      style_hints: {}, 
    };
    console.log(`[RFS] Initial siteConfig from manifest title/desc.`);

    // 2. Attempt to fetch site.yaml
    const siteYamlEntry = manifest.files.find(f => f.path === 'site.yaml' || f.path === '/site.yaml');
    if (siteYamlEntry) {
      console.log(`[RFS] Found site.yaml in manifest. Fetching: ${siteYamlEntry.path}`);
      try {
        const siteYamlString = await fetchRemoteFile(remoteSiteUrl, siteYamlEntry.path);
        const parsedConfig = yaml.load(siteYamlString) as SiteConfigFile;
        siteConfig = { ...siteConfig, ...parsedConfig, title: parsedConfig.title || siteConfig.title }; // Prioritize site.yaml title
        console.log(`[RFS] Merged siteConfig with site.yaml:`, siteConfig);
      } catch (yamlError) {
        console.warn(`[RFS] Could not fetch or parse remote site.yaml:`, yamlError);
      }
    } else {
        console.log(`[RFS] site.yaml not found in manifest files.`);
    }
    
    // 3. Fetch all content files listed in the manifest
    const contentFilesPromises: Promise<ParsedMarkdownFile | null>[] = manifest.files
      .filter(fileEntry => fileEntry.path && fileEntry.path.startsWith('content/') && fileEntry.path.endsWith('.md'))
      .map(async (fileEntry) => {
        console.log(`[RFS] Processing MD file from manifest: ${fileEntry.path}`);
        try {
          const rawMarkdown = await fetchRemoteFile(remoteSiteUrl, fileEntry.path);
          const { frontmatter, content } = parseMarkdownString(rawMarkdown);
          const slug = fileEntry.path.substring(fileEntry.path.lastIndexOf('/') + 1).replace('.md', '');
          return { slug, path: fileEntry.path, frontmatter, content };
        } catch (mdError) {
          console.warn(`[RFS] FAILED to fetch or parse MD file ${fileEntry.path}:`, mdError);
          return null;
        }
      });
    
    const resolvedContentFiles = await Promise.all(contentFilesPromises);
    const validContentFiles = resolvedContentFiles.filter(file => file !== null) as ParsedMarkdownFile[];
    console.log(`[RFS] Fetched and parsed ${validContentFiles.length} content files.`);

    // If no index.md, this site is essentially unloadable for browsing
    if (!validContentFiles.some(f => f.path === 'content/index.md')) {
        console.warn(`[RFS] No 'content/index.md' found in remote site bundle. Site might be incomplete.`);
        // Depending on requirements, you might return null here or an empty site.
        // For now, we proceed, but the page component will likely 404 on index.
    }
    
    const appSpecificSiteId = `remote-${manifest.siteId}`; // Use siteId from manifest for app's internal tracking

    const finalSiteData: LocalSiteData = {
      siteId: appSpecificSiteId,
      config: siteConfig,
      contentFiles: validContentFiles,
    };
    console.log(`[RFS] <<< Successfully constructed remote site data for ${appSpecificSiteId}`);
    return finalSiteData;

  } catch (error) { // This catches errors from fetchRemoteFile or JSON.parse(manifestString)
    console.error(`[RFS] <<< CRITICAL ERROR in fetchRemoteSiteData for ${remoteSiteUrl}:`, error);
    return null;
  }
}