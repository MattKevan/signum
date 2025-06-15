// src/lib/siteExporter.ts
import JSZip from 'jszip';
import { LocalSiteData, ParsedMarkdownFile, StructureNode } from '@/types';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { flattenStructureToRenderableNodes } from './fileTree.service';
import { resolvePageContent, PageType } from './pageResolver.service';
import { render } from './theme-engine/themeEngine.service';
import { getUrlForNode } from './urlUtils.service';
import { getAssetContent, getJsonAsset, ThemeManifest, LayoutManifest } from './configHelpers.service'; 

/**
 * Escapes special XML characters in a string to make it safe for RSS/Sitemap feeds.
 * @param {unknown} str - The input string to escape.
 * @returns {string} The escaped string.
 */
function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'");
}

/**
 * A helper function to find all files for a given asset (theme or layout)
 * by reading its manifest's `files` array, and then add them to the ZIP archive.
 * This ensures that core and custom assets are bundled with the site.
 *
 * @param {JSZip} zip - The JSZip instance to add files to.
 * @param {LocalSiteData} siteData - The complete site data, including any custom asset files.
 * @param {'theme' | 'layout'} assetType - The type of asset to bundle.
 * @param {string} assetPath - The path/ID of the asset (e.g., 'default' or 'my-custom-theme').
 */
async function bundleAsset(zip: JSZip, siteData: LocalSiteData, assetType: 'theme' | 'layout', assetPath: string) {
    const assetFolder = zip.folder('_signum')?.folder(`${assetType}s`)?.folder(assetPath);
    if (!assetFolder) return;

    // 1. Fetch the manifest for the asset (e.g., theme.json or layout.json).
    const manifest = await getJsonAsset<ThemeManifest | LayoutManifest>(siteData, assetType, assetPath, `${assetType}.json`);
    
    // 2. If the manifest has a 'files' array, iterate through it. This is our source of truth.
    if (!manifest || !manifest.files) {
        console.warn(`Asset manifest for ${assetType}/${assetPath} is missing or has no 'files' array. Skipping bundle.`);
        return;
    }

    // 3. For each file listed in the manifest, fetch its content and add it to the ZIP.
    for (const file of manifest.files) {
        const content = await getAssetContent(siteData, assetType, assetPath, file.path);
        if (content) {
            assetFolder.file(file.path, content);
        } else {
            console.warn(`Could not find content for declared file: ${assetType}s/${assetPath}/${file.path}`);
        }
    }
}


/**
 * Compiles a full Signum site into a downloadable ZIP archive, ready for deployment.
 * This function orchestrates HTML generation, source file packaging, asset bundling, and feed creation.
 *
 * @param {LocalSiteData} siteData - The complete, in-memory representation of the site.
 * @returns {Promise<Blob>} A promise that resolves to a Blob containing the ZIP archive.
 */
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    const zip = new JSZip();
    const { manifest } = siteData;
    const allRenderableNodes = flattenStructureToRenderableNodes(manifest.structure);

    // --- 1. Generate All HTML Pages ---
    for (const node of allRenderableNodes) {
        const slugArray = (node.type === 'collection') ? [node.slug] : node.path.replace(/^content\//, '').replace(/\.md$/, '').split('/').filter(Boolean);
        const resolution = resolvePageContent(siteData, slugArray);
        if (resolution.type === PageType.NotFound) continue;
        
        const outputPath = getUrlForNode({ ...node, type: node.type as 'page' | 'collection' }, true);
        
        // Calculate the relative path depth for portable asset links (e.g., '../' or './').
        const depth = (outputPath.match(/\//g) || []).length;
        const relativePrefix = '../'.repeat(depth);

        // Render the final HTML, passing the correct export options.
        const finalHtml = await render(siteData, resolution, {
            siteRootPath: '/',
            isExport: true,
            relativeAssetPath: relativePrefix
        });
        zip.file(outputPath, finalHtml);
    }

    // --- 2. Add _signum Source Content and Asset Files ---
    const signumFolder = zip.folder('_signum');
    if (signumFolder) {
        // Add the main site manifest and all markdown content files.
        signumFolder.file('manifest.json', JSON.stringify(manifest, null, 2));
        (siteData.contentFiles ?? []).forEach(file => {
            signumFolder.file(file.path, stringifyToMarkdown(file.frontmatter, file.content));
        });
    }

    // Bundle the active theme and all layouts used by the site.
    const activeThemePath = manifest.theme.name;
    const uniqueLayoutPaths = [...new Set(allRenderableNodes.map(n => n.layout))];

    await bundleAsset(zip, siteData, 'theme', activeThemePath);
    for (const layoutPath of uniqueLayoutPaths) {
        await bundleAsset(zip, siteData, 'layout', layoutPath);
    }
    
    // --- 3. Generate RSS Feed and Sitemap with Absolute URLs ---
    const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
    const contentFiles = siteData.contentFiles ?? [];
    const allPageNodes = allRenderableNodes.filter((n: StructureNode): n is StructureNode & { type: 'page' } => n.type === 'page');
    type RssItemData = { node: StructureNode, file: ParsedMarkdownFile };

    // Create RSS items
    const rssItems = allPageNodes.map((pNode): RssItemData | null => {
            const file = contentFiles.find(f => f.path === pNode.path);
            return file ? { node: pNode, file } : null;
        })
        .filter((item): item is RssItemData => item !== null && !!item.file.frontmatter.date)
        .sort((a, b) => new Date(b.file.frontmatter.date as string).getTime() - new Date(a.file.frontmatter.date as string).getTime())
        .slice(0, 20)
        .map((item) => {
            const relativeUrl = getUrlForNode(item.node, true);
            const absoluteUrl = new URL(relativeUrl, siteBaseUrl).href;
            const description = escapeForXml(item.file.frontmatter.summary);
            const pubDate = new Date(item.file.frontmatter.date as string).toUTCString();
            return `<item><title>${escapeForXml(item.node.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${pubDate}</pubDate><description>${description}</description></item>`;
        }).join('');

    const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
    zip.file('rss.xml', rssFeed);
    
    // Create Sitemap URLs
    const sitemapUrls = allPageNodes.map((node) => {
        const file = contentFiles.find(f => f.path === node.path);
        const relativeUrl = getUrlForNode(node, true);
        const absoluteUrl = new URL(relativeUrl, siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');

    const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
    zip.file('sitemap.xml', sitemapXml);

    // --- 4. Generate the Final ZIP file ---
    return zip.generateAsync({ type: 'blob' });
}