// src/core/services/siteExporter.service.ts
import JSZip from 'jszip';
import { LocalSiteData, ParsedMarkdownFile, StructureNode, ImageRef } from '@/types';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { flattenTree } from './fileTree.service';
import { resolvePageContent } from './pageResolver.service';
import { PageType } from '@/types';
import { render } from './theme-engine/themeEngine.service';
import { getUrlForNode } from './urlUtils.service';
import { getAssetContent, getJsonAsset, ThemeManifest, LayoutManifest } from './configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';

/**
 * Escapes special XML characters in a string to make it safe for RSS/Sitemap feeds.
 */
function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'");
}

/**
 * A helper function to find all files for a given asset (theme or layout)
 * and add them to the ZIP archive.
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
 * A helper function to recursively find all ImageRef objects within a site's data.
 */
function findAllImageRefs(siteData: LocalSiteData): ImageRef[] {
  const refs = new Set<ImageRef>();
  const visited = new Set<object>();

  function find(obj: unknown) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    // Type guard to check if obj has the properties of an ImageRef
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
 * Compiles a full Signum site into a downloadable ZIP archive, ready for deployment.
 */
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    const zip = new JSZip();
    const { manifest, contentFiles } = siteData;
    if (!contentFiles) {
        throw new Error("Cannot export site: content files are not loaded.");
    }
    
    // --- FIX: Call the updated 'flattenTree' function with both required arguments. ---
    const allRenderableNodes = flattenTree(manifest.structure, contentFiles);

    // --- 1. Generate All HTML Pages ---
    for (const node of allRenderableNodes) {
        const initialResolution = resolvePageContent(siteData, node.slug.split('/'));
        if (initialResolution.type === PageType.NotFound) continue;
        const isPaginated = !!(initialResolution.pagination && initialResolution.pagination.totalPages > 1);

        if (isPaginated) {
            const totalPages = initialResolution.pagination!.totalPages;
            for (let i = 1; i <= totalPages; i++) {
                const resolutionForPage = resolvePageContent(siteData, node.slug.split('/'), i);
                if (resolutionForPage.type === PageType.NotFound) continue;
                const outputPath = getUrlForNode(node, manifest, true, i);
                const depth = (outputPath.match(/\//g) || []).length;
                const relativePrefix = '../'.repeat(depth > 0 ? depth - 1 : 0);
                const finalHtml = await render(siteData, resolutionForPage, { siteRootPath: '/', isExport: true, relativeAssetPath: relativePrefix });
                zip.file(outputPath, finalHtml);
            }
        } else {
            const outputPath = getUrlForNode(node, manifest, true);
            const depth = (outputPath.match(/\//g) || []).length;
            const relativePrefix = '../'.repeat(depth > 0 ? depth - 1 : 0);
            const finalHtml = await render(siteData, initialResolution, { siteRootPath: '/', isExport: true, relativeAssetPath: relativePrefix });
            zip.file(outputPath, finalHtml);
        }
    }

    // --- 2. Add _signum Source Content and Asset Files ---
    const signumFolder = zip.folder('_signum');
    if (signumFolder) {
        signumFolder.file('manifest.json', JSON.stringify(manifest, null, 2));
        contentFiles.forEach(file => {
            signumFolder.file(file.path, stringifyToMarkdown(file.frontmatter, file.content));
        });
    }

    const allImageRefs = findAllImageRefs(siteData);
    if (allImageRefs.length > 0) {
        const imageService = getActiveImageService(manifest);
        const assetsToBundle = await imageService.getExportableAssets(siteData.siteId, allImageRefs);
        for (const asset of assetsToBundle) {
            zip.file(asset.path, asset.data);
        }
    }

    const layoutIds = new Set<string>();
    contentFiles.forEach(file => {
        if (file.frontmatter.layout) layoutIds.add(file.frontmatter.layout);
        if (file.frontmatter.collection) {
            layoutIds.add(file.frontmatter.collection.item_layout);
        }
    });

    await bundleAsset(zip, siteData, 'theme', manifest.theme.name);
    for (const layoutId of Array.from(layoutIds)) {
        await bundleAsset(zip, siteData, 'layout', layoutId);
    }

    // --- 3. Generate RSS Feed and Sitemap ---
    const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
    type RssItemData = { node: StructureNode, file: ParsedMarkdownFile };

    const rssItems = allRenderableNodes
        .map((node): RssItemData | null => {
            const file = contentFiles.find(f => f.path === node.path);
            return file ? { node, file } : null;
        })
        .filter((item): item is RssItemData => {
            if (!item || !item.file) return false;
            // Only include items that have a date and are not collection landing pages
            return !!item.file.frontmatter.date && !item.file.frontmatter.collection;
        })
        .sort((a, b) => new Date(b.file.frontmatter.date as string).getTime() - new Date(a.file.frontmatter.date as string).getTime())
        .slice(0, 20) // Limit to the 20 most recent items
        .map((item) => {
            const relativeUrl = getUrlForNode(item.node, manifest, false);
            const absoluteUrl = new URL(relativeUrl, siteBaseUrl).href;
            const description = escapeForXml(item.file.frontmatter.description);
            const pubDate = new Date(item.file.frontmatter.date as string).toUTCString();
            return `<item><title>${escapeForXml(item.node.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${pubDate}</pubDate><description>${description}</description></item>`;
        }).join('');

    const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
    zip.file('rss.xml', rssFeed);

    const sitemapUrls = allRenderableNodes.map((node) => {
        const file = contentFiles.find(f => f.path === node.path);
        const relativeUrl = getUrlForNode(node, manifest, false);
        const absoluteUrl = new URL(relativeUrl, siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');

    const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
    zip.file('sitemap.xml', sitemapXml);

    return zip.generateAsync({ type: 'blob' });
}