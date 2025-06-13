// src/lib/siteExporter.ts
import JSZip from 'jszip';
import { LocalSiteData, ParsedMarkdownFile, StructureNode, ThemeInfo } from '@/types';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { flattenStructureToRenderableNodes } from './fileTreeUtils';
import { resolvePageContent, PageType } from './pageResolver';
import { render } from './themeEngine';
import { getUrlForNode } from './urlUtils'; 
import { CORE_THEMES } from '@/config/editorConfig';

/**
 * Checks if a theme path corresponds to a core, built-in theme.
 * @param {string} path - The path of the theme.
 * @returns {boolean} True if the theme is a core theme.
 */
const isCoreTheme = (path: string): boolean => CORE_THEMES.some((t: ThemeInfo) => t.path === path);

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
 * Compiles a full Signum site into a downloadable ZIP archive, ready for deployment.
 * This function orchestrates HTML generation, source file packaging, and feed creation.
 *
 * @param {LocalSiteData} siteData - The complete, in-memory representation of the site.
 * @returns {Promise<Blob>} A promise that resolves to a Blob containing the ZIP archive.
 */
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    const zip = new JSZip();
    const { manifest } = siteData;
    const allRenderableNodes = flattenStructureToRenderableNodes(manifest.structure);
    const themePath = manifest.theme.name;

    // --- 1. Generate All HTML Pages ---
    for (const node of allRenderableNodes) {
        const slugArray = (node.type === 'collection') ? [node.slug] : node.path.replace(/^content\//, '').replace(/\.md$/, '').split('/').filter(Boolean);
        const resolution = resolvePageContent(siteData, slugArray);
        if (resolution.type === PageType.NotFound) continue;
        
        const outputPath = getUrlForNode({ ...node, type: node.type as 'page' | 'collection' }, true);
        
        const depth = (outputPath.match(/\//g) || []).length;
        const relativePrefix = '../'.repeat(depth);

        const finalHtml = await render(siteData, resolution, {
            siteRootPath: '/',
            isExport: true,
            relativeAssetPath: relativePrefix
        });
        zip.file(outputPath, finalHtml);
    }

    // --- 2. Add _signum Source and Asset Files ---
    const signumFolder = zip.folder('_signum');
    if (signumFolder) {
        signumFolder.file(`manifest.json`, JSON.stringify(manifest, null, 2));
        
        // FIX: Add a type guard to ensure `siteData.contentFiles` exists before accessing it.
        if (siteData.contentFiles) {
            siteData.contentFiles.forEach(file => {
                signumFolder.file(file.path, stringifyToMarkdown(file.frontmatter, file.content));
            });
        }
    }
    
    if (siteData.themeFiles && !isCoreTheme(themePath)) {
        siteData.themeFiles.forEach(file => {
            zip.file(file.path, file.content);
        });
    }

    // --- 3. Generate RSS Feed and Sitemap with Correct Absolute URLs ---
    const siteBaseUrl = manifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
    
    // FIX: Safely access contentFiles, defaulting to an empty array if it's undefined.
    // This single constant fixes the TypeScript errors for both RSS and Sitemap generation.
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

    // --- 4. Generate the ZIP file ---
    return zip.generateAsync({ type: 'blob' });
}