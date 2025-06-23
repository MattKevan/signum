// src/core/services/siteExporter.service.ts
import JSZip from 'jszip';
import { LocalSiteData, ParsedMarkdownFile, ImageRef } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { flattenTree, FlattenedNode } from '@/core/services/fileTree.service';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { PageType } from '@/core/types';
import { render } from '@/core/services/themes/themeEngine.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getAssetContent, getJsonAsset, ThemeManifest, LayoutManifest } from '@/core/services/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/themes/theme.service';

/**
 * Escapes special XML characters in a string to make it safe for RSS/Sitemap feeds.
 * @param {unknown} str - The input string to escape.
 * @returns {string} The escaped string.
 */
function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'");
}

/**
 * A helper function to bundle all files for a given asset (theme or layout)
 * into a specified ZIP folder. It reads the asset's manifest to determine which files to include.
 * @param {JSZip} zip - The root JSZip instance.
 * @param {LocalSiteData} siteData - The complete site data.
 * @param {'theme' | 'layout'} assetType - The type of asset to bundle.
 * @param {string} assetId - The ID of the asset (e.g., 'default', 'listing').
 */
async function bundleAsset(zip: JSZip, siteData: LocalSiteData, assetType: 'theme' | 'layout', assetId: string) {
    const assetFolder = zip.folder('_signum')?.folder(`${assetType}s`)?.folder(assetId);
    if (!assetFolder) return;

    const manifestFileName = assetType === 'theme' ? 'theme.json' : 'layout.json';
    const manifest = await getJsonAsset<ThemeManifest | LayoutManifest>(siteData, assetType, assetId, manifestFileName);

    if (!manifest || !manifest.files) {
        console.warn(`Asset manifest for ${assetType}/${assetId} is missing or has no 'files' array. Skipping bundle.`);
        return;
    }

    for (const file of manifest.files) {
        const content = await getAssetContent(siteData, assetType, assetId, file.path);
        if (content) {
            assetFolder.file(file.path, content);
        } else {
            console.warn(`Could not find content for declared file: ${assetType}s/${assetId}/${file.path}`);
        }
    }
}

/**
 * Recursively finds all unique ImageRef objects within a site's manifest and content files.
 * @param {LocalSiteData} siteData - The site data to search through.
 * @returns {ImageRef[]} An array of all unique ImageRef objects found.
 */
function findAllImageRefs(siteData: LocalSiteData): ImageRef[] {
  const refs = new Set<ImageRef>();
  const visited = new Set<object>();

  function find(obj: unknown) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    if ('serviceId' in obj && 'src' in obj) {
        refs.add(obj as ImageRef);
    }
    Object.values(obj).forEach(value => find(value));
  }

  find(siteData.manifest);
  siteData.contentFiles?.forEach(file => find(file.frontmatter));
  return Array.from(refs);
}

/**
 * Compiles a full Signum site into a downloadable ZIP archive, ready for static deployment.
 *
 * This function follows the "Merge on Export" principle. It takes the user's saved manifest,
 * fetches the latest defaults from the canonical theme file, and merges them to create a
 * final, up-to-date configuration for the exported site.
 *
 * @param {LocalSiteData} siteData - The site data from the global store.
 * @returns {Promise<Blob>} A promise that resolves to the generated ZIP file as a Blob.
 */
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    const zip = new JSZip();
    
    // --- "Merge on Export" Logic ---
     const savedThemeConfig = siteData.manifest.theme;
    
    // [FIX] Call the correct function to get the fully merged config.
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        savedThemeConfig.name, 
        savedThemeConfig.config
    );
    
    const synchronizedManifest = { 
        ...siteData.manifest, 
        theme: { ...savedThemeConfig, config: finalMergedConfig }
    };
    const synchronizedSiteData = { ...siteData, manifest: synchronizedManifest };
    const { contentFiles } = synchronizedSiteData;
    // ---

    if (!contentFiles) {
        throw new Error("Cannot export site: content files are not loaded.");
    }
    
    const allRenderableNodes: FlattenedNode[] = flattenTree(synchronizedManifest.structure, contentFiles);

    // --- 1. Generate All HTML Pages ---
    for (const node of allRenderableNodes) {
        // ... no changes to this loop ...
        const initialResolution = resolvePageContent(synchronizedSiteData, node.slug.split('/'));
        if (initialResolution.type === PageType.NotFound) continue;

        const isPaginated = !!(initialResolution.pagination && initialResolution.pagination.totalPages > 1);
        if (isPaginated) {
            const totalPages = initialResolution.pagination!.totalPages;
            for (let i = 1; i <= totalPages; i++) {
                const resolutionForPage = resolvePageContent(synchronizedSiteData, node.slug.split('/'), i);
                if (resolutionForPage.type === PageType.NotFound) continue;
                const outputPath = getUrlForNode(node, synchronizedManifest, true, i);
                const depth = (outputPath.match(/\//g) || []).length;
                const relativePrefix = '../'.repeat(depth > 0 ? depth - 1 : 0);
                const finalHtml = await render(synchronizedSiteData, resolutionForPage, { siteRootPath: '/', isExport: true, relativeAssetPath: relativePrefix });
                zip.file(outputPath, finalHtml);
            }
        } else {
            const outputPath = getUrlForNode(node, synchronizedManifest, true);
            const depth = (outputPath.match(/\//g) || []).length;
            const relativePrefix = '../'.repeat(depth > 0 ? depth - 1 : 0);
            const finalHtml = await render(synchronizedSiteData, initialResolution, { siteRootPath: '/', isExport: true, relativeAssetPath: relativePrefix });
            zip.file(outputPath, finalHtml);
        }
    }

    // --- 2. Add _signum Source Content and Asset Files ---
    const signumFolder = zip.folder('_signum');
    if (signumFolder) {
        signumFolder.file('manifest.json', JSON.stringify(synchronizedManifest, null, 2));
        contentFiles.forEach(file => {
            signumFolder.file(file.path, stringifyToMarkdown(file.frontmatter, file.content));
        });
    }

    const allImageRefs = findAllImageRefs(synchronizedSiteData);
    if (allImageRefs.length > 0) {
        const imageService = getActiveImageService(synchronizedManifest);
        const assetsToBundle = await imageService.getExportableAssets(synchronizedSiteData.siteId, allImageRefs);
        for (const asset of assetsToBundle) {
            zip.file(asset.path, asset.data);
        }
    }

    const layoutIds = new Set<string>();
    contentFiles.forEach(file => {
        if (file.frontmatter.layout) layoutIds.add(file.frontmatter.layout);
        if (file.frontmatter.collection?.item_layout) layoutIds.add(file.frontmatter.collection.item_layout);
    });

    await bundleAsset(zip, synchronizedSiteData, 'theme', synchronizedManifest.theme.name);
    for (const layoutId of Array.from(layoutIds)) {
        await bundleAsset(zip, synchronizedSiteData, 'layout', layoutId);
    }

    // --- 3. Generate RSS Feed and Sitemap ---
    const siteBaseUrl = synchronizedManifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
    
    const rssItems = allRenderableNodes
        .map(node => ({ node, file: contentFiles.find(f => f.path === node.path) }))
        // [THE FIX] The type predicate now correctly uses FlattenedNode and asserts
        // that `file` is of type ParsedMarkdownFile, not undefined.
        .filter((item): item is { node: FlattenedNode; file: ParsedMarkdownFile } => 
            !!item.file && !!item.file.frontmatter.date && !item.file.frontmatter.collection
        )
        // With the fix above, TypeScript now knows `a.file` and `b.file` are defined.
        .sort((a, b) => new Date(b.file.frontmatter.date as string).getTime() - new Date(a.file.frontmatter.date as string).getTime())
        .slice(0, 20)
        // And it knows `item.file` is defined here as well.
        .map(item => {
            const relativeUrl = getUrlForNode(item.node, synchronizedManifest, false);
            const absoluteUrl = new URL(relativeUrl, siteBaseUrl).href;
            return `<item><title>${escapeForXml(item.node.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${new Date(item.file.frontmatter.date as string).toUTCString()}</pubDate><description>${escapeForXml(item.file.frontmatter.description)}</description></item>`;
        }).join('');

    const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(synchronizedManifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(synchronizedManifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
    zip.file('rss.xml', rssFeed);

    const sitemapUrls = allRenderableNodes.map(node => {
        const file = contentFiles.find(f => f.path === node.path);
        const relativeUrl = getUrlForNode(node, synchronizedManifest, false);
        const absoluteUrl = new URL(relativeUrl, siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');
    const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
    zip.file('sitemap.xml', sitemapXml);

    return zip.generateAsync({ type: 'blob' });
}