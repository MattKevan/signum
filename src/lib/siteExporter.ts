// src/lib/siteExporter.ts
import JSZip from 'jszip';
import { LocalSiteData, ParsedMarkdownFile, StructureNode, ThemeInfo, LayoutInfo } from '@/types';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { flattenStructureToRenderableNodes } from './fileTreeUtils';
import { resolvePageContent, PageType } from './pageResolver';
import { render } from './themeEngine';
import { CORE_THEMES, CORE_LAYOUTS } from '@/config/editorConfig';
import { getJsonAsset, LayoutManifest, ThemeManifest } from './configHelpers';
import { getUrlForNode } from './urlUtils'; 
// --- Helpers ---
const isCoreTheme = (path: string): boolean => CORE_THEMES.some((t: ThemeInfo) => t.path === path);
const isCoreLayout = (path: string): boolean => CORE_LAYOUTS.some((l: LayoutInfo) => l.path === path);

function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>"']/g, (match) => ({'<': '<', '>': '>', '&': '&', '"': '"', "'": "'"}[match] || match));
}

/**
 * Compiles a full Signum site into a downloadable ZIP archive.
 */
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    const zip = new JSZip();
    const { manifest } = siteData;
    const allRenderableNodes = flattenStructureToRenderableNodes(manifest.structure);
    
    const cssFolder = zip.folder('css');
    const addedAssets = new Set<string>();

    // Helper to copy a declared asset file to the zip
    const addAssetToZip = async (type: 'theme' | 'layout', assetPath: string, relativeFilePath: string, destFolder: JSZip | null) => {
        const uniqueAssetId = `${type}-${assetPath}-${relativeFilePath}`;
        if (addedAssets.has(uniqueAssetId) || !destFolder) return;

        const isCore = type === 'theme' ? isCoreTheme(assetPath) : isCoreLayout(assetPath);
        const sourcePath = `/${type}s/${assetPath}/${relativeFilePath}`;
        const destFileName = sourcePath.substring(1).replace(/[^a-zA-Z0-9.\-_]/g, '-');

        try {
            let content: string | Blob | null = null;
            if (isCore) {
                const response = await fetch(sourcePath);
                if (response.ok) {
                    // FIXED: Handle response based on content type
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('svg')) {
                        content = await response.text();
                    } else {
                        content = await response.blob();
                    }
                }
            } else {
                content = (type === 'theme' ? siteData.themeFiles : siteData.layoutFiles)?.find(f => f.path === `${type}s/${assetPath}/${relativeFilePath}`)?.content ?? null;
            }
            
            if (content) {
                // FIXED: JSZip can handle string or Blob, which our logic now provides.
                destFolder.file(destFileName, content);
                addedAssets.add(uniqueAssetId);
            }
        } catch {
            // FIXED: Removed unused 'e' variable
            console.warn(`Could not add asset: ${sourcePath}`);
        }
    };

    // --- 1. Discover and Copy All Necessary Asset Files to ZIP ---
    await addAssetToZip('theme', 'default', 'css/signum-base.css', cssFolder);
    
    const themePath = manifest.theme.name;
    const uniqueLayoutPaths = [...new Set(allRenderableNodes.map(n => n.layout))];
    
    const themeManifest = await getJsonAsset<ThemeManifest>(siteData, 'theme', themePath, 'theme.json');
    for (const file of themeManifest?.stylesheets || []) { await addAssetToZip('theme', themePath, file, cssFolder); }
    
    for (const layoutPath of uniqueLayoutPaths) {
        const layoutManifest = await getJsonAsset<LayoutManifest>(siteData, 'layout', layoutPath, 'layout.json');
        for (const file of layoutManifest?.stylesheets || []) { await addAssetToZip('layout', layoutPath, file, cssFolder); }
    }

    // --- 2. Generate All HTML Pages ---
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

    // --- 3. Add _signum Source Files ---
    zip.file(`_signum/manifest.json`, JSON.stringify(manifest, null, 2));
    siteData.contentFiles.forEach(file => zip.file(`_signum/${file.path}`, stringifyToMarkdown(file.frontmatter, file.content)));
    if (siteData.themeFiles && !isCoreTheme(themePath)) {
        siteData.themeFiles.forEach(file => zip.file(`_signum/${file.path}`, file.content));
    }
    if (siteData.layoutFiles) {
        uniqueLayoutPaths.filter(p => !isCoreLayout(p)).forEach(layoutPath => {
            const files = siteData.layoutFiles?.filter(f => f.path.startsWith(`layouts/${layoutPath}/`)) || [];
            files.forEach(file => zip.file(`_signum/${file.path}`, file.content));
        });
    }

    // --- 4. Generate RSS Feed and Sitemap ---
    const allPageNodes = allRenderableNodes.filter((n: StructureNode): n is StructureNode & { type: 'page' } => n.type === 'page');
    const siteBaseUrl = `https://${manifest.title.toLowerCase().replace(/\s+/g, '-') || 'example'}.com`;
    type RssItemData = { node: StructureNode, file: ParsedMarkdownFile };
    const rssItems = allPageNodes.map((pNode): RssItemData | null => {
            const file = siteData.contentFiles.find(f => f.path === pNode.path);
            return file ? { node: pNode, file } : null;
        }).filter((item): item is RssItemData => item !== null && !!item.file.frontmatter.date)
        .sort((a, b) => new Date(b.file.frontmatter.date as string).getTime() - new Date(a.file.frontmatter.date as string).getTime())
        .slice(0, 20)
        .map((item) => {
            const relativeUrl = getUrlForNode(item.node, true);
            const url = new URL(relativeUrl, siteBaseUrl).href;
            const description = escapeForXml(item.file.frontmatter.summary);
            const pubDate = new Date(item.file.frontmatter.date as string).toUTCString();
            return `<item><title>${escapeForXml(item.node.title)}</title><link>${escapeForXml(url)}</link><guid isPermaLink="true">${escapeForXml(url)}</guid><pubDate>${pubDate}</pubDate><description>${description}</description></item>`;
        }).join('');
    const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
    zip.file('rss.xml', rssFeed);
    
    const sitemapUrls = allPageNodes.map((node) => {
        const file = siteData.contentFiles.find(f => f.path === node.path);
        const relativeUrl = getUrlForNode(node, true);
        const url = new URL(relativeUrl, siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(url)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');
    const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
    zip.file('sitemap.xml', sitemapXml);

    return zip.generateAsync({ type: 'blob' });
}