// src/core/services/siteExporter.service.ts
import JSZip from 'jszip';
import { LocalSiteData, ParsedMarkdownFile, ImageRef, PageType, Manifest, PageResolutionResult } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { flattenTree, FlattenedNode } from '@/core/services/fileTree.service';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render } from '@/core/services/themes/themeEngine.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getAssetContent, getJsonAsset, getLayoutManifest, ThemeManifest, LayoutManifest } from '@/core/services/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/themes/theme.service';
import * as localSiteFs from '@/core/services/localFileSystem.service';

function renderPathTemplate(templateString: string, context: Record<string, any>): string {
    let result = templateString;
    for (const key in context) {
        result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), context[key]);
    }
    return result;
}

function escapeForXml(str: unknown): string {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'");
}

async function bundleAsset(zip: JSZip, siteData: LocalSiteData, assetType: 'theme' | 'layout', assetId: string) {
    if (!assetId) return;
    const assetFolder = zip.folder('_signum')?.folder(`${assetType}s`)?.folder(assetId);
    if (!assetFolder) return;
    const manifest = await getJsonAsset<ThemeManifest | LayoutManifest>(siteData, assetType, assetId, `${assetType}.json`);
    if (!manifest || !manifest.files) return;
    for (const file of manifest.files) {
        const content = await getAssetContent(siteData, assetType, assetId, file.path);
        if (content) assetFolder.file(file.path, content);
    }
}

function findAllImageRefs(siteData: LocalSiteData): ImageRef[] {
  const refs = new Set<ImageRef>();
  const visited = new Set<object>();
  function find(obj: unknown) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);
    if (('serviceId' in obj) && ('src' in obj) && (obj as ImageRef).serviceId && (obj as ImageRef).src) {
        refs.add(obj as ImageRef);
    }
    Object.values(obj).forEach(find);
  }
  find(siteData.manifest);
  siteData.contentFiles?.forEach(file => find(file.frontmatter));
  return Array.from(refs);
}

export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    const zip = new JSZip();
    
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name, 
        siteData.manifest.theme.config
    );
    const synchronizedManifest = { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig }};
    const synchronizedSiteData = { ...siteData, manifest: synchronizedManifest };
    const { contentFiles } = synchronizedSiteData;

    if (!contentFiles) throw new Error("Cannot export site: content files are not loaded.");
    
    // --- FIX: Correct variable name was `allStaticNodes` ---
    const allStaticNodes: FlattenedNode[] = flattenTree(synchronizedManifest.structure, contentFiles);

    // --- STEP 1: GENERATE ALL STATIC PAGES ---
    for (const node of allStaticNodes) {
        const resolution = resolvePageContent(synchronizedSiteData, node.slug.split('/'));
        if (resolution.type === PageType.NotFound) continue;
        const outputPath = getUrlForNode(node, synchronizedManifest, true);
        const finalHtml = await render(synchronizedSiteData, resolution, { 
            siteRootPath: '/', isExport: true, relativeAssetPath: '../'.repeat((outputPath.match(/\//g) || []).length)
        });
        zip.file(outputPath, finalHtml);
    }

    // --- STEP 2: GENERATE ALL DYNAMIC PAGES ---
    const collectionPages = contentFiles.filter(f => f.frontmatter.collection);
    for (const collectionPage of collectionPages) {
        const layoutManifest = await getLayoutManifest(synchronizedSiteData, collectionPage.frontmatter.layout);
        if (!layoutManifest?.dynamic_routes) continue;

        for (const routeKey in layoutManifest.dynamic_routes) {
            const route = layoutManifest.dynamic_routes[routeKey];
            const dataSourceId = route.data_source.id;
            const dataFileDef = layoutManifest.data_files?.find(df => df.id === dataSourceId);
            if (!dataFileDef) continue;
            
            const collectionSlug = collectionPage.slug;
            const dataFilePath = renderPathTemplate(dataFileDef.path_template, { collection: { slug: collectionSlug } });
            const dataSourceContent = await localSiteFs.getDataFileContent(synchronizedSiteData.siteId, dataFilePath);
            if (!dataSourceContent) continue;
            
            const dataSourceItems = JSON.parse(dataSourceContent);

            for (const item of dataSourceItems) {
                const outputPath = `${renderPathTemplate(route.path_template, { collection: { slug: collectionSlug }, item })}/index.html`;

                const filterField = route.content_filter.by_frontmatter_field;
                const filterValue = item[route.content_filter.contains_value_from];
                const matchingContent = contentFiles.filter(cf => 
                    Array.isArray(cf.frontmatter[filterField]) && (cf.frontmatter[filterField] as any[]).includes(filterValue)
                );

                const dynamicResolution: PageResolutionResult = {
                    type: PageType.SinglePage,
                    pageTitle: item.name || 'Archive',
                    contentFile: collectionPage,
                    layoutPath: route.layout,
                    collectionItems: matchingContent,
                    term: item,
                } as any; 

                const finalHtml = await render(synchronizedSiteData, dynamicResolution, {
                    siteRootPath: '/', isExport: true, relativeAssetPath: '../'.repeat((outputPath.match(/\//g) || []).length)
                });
                zip.file(outputPath, finalHtml);
            }
        }
    }

    // --- STEP 3: BUNDLE SOURCE FILES & ASSETS ---
    const signumFolder = zip.folder('_signum');
    if (signumFolder) {
        signumFolder.file('manifest.json', JSON.stringify(synchronizedManifest, null, 2));
        contentFiles.forEach(file => {
            signumFolder.file(file.path, stringifyToMarkdown(file.frontmatter, file.content));
        });
        const dataFiles = await localSiteFs.getAllDataFiles(synchronizedSiteData.siteId);
        for(const [path, content] of Object.entries(dataFiles)) {
            // FIX: Ensure content is a string before zipping.
            if (typeof content === 'string') {
                signumFolder.file(path, content);
            }
        }
    }

    const allImageRefs = findAllImageRefs(synchronizedSiteData);
    if (allImageRefs.length > 0) {
        const imageService = getActiveImageService(synchronizedManifest);
        const assetsToBundle = await imageService.getExportableAssets(synchronizedSiteData.siteId, allImageRefs);
        for (const asset of assetsToBundle) {
            zip.file(asset.path, asset.data);
        }
    }

    const layoutIds = new Set<string>(contentFiles.map(f => f.frontmatter.layout));
    await bundleAsset(zip, synchronizedSiteData, 'theme', synchronizedManifest.theme.name);
    for (const layoutId of Array.from(layoutIds)) {
        await bundleAsset(zip, synchronizedSiteData, 'layout', layoutId);
    }
    
    // --- STEP 4: GENERATE METADATA FILES ---
    const siteBaseUrl = synchronizedManifest.baseUrl?.replace(/\/$/, '') || 'https://example.com';
    
    // FIX: Use the correct variable `allStaticNodes` and add types to callbacks.
    const rssItems = allStaticNodes
        .map((node: FlattenedNode) => ({ node, file: contentFiles.find(f => f.path === node.path) }))
        .filter((item): item is { node: FlattenedNode; file: ParsedMarkdownFile } => 
            !!item.file && !!item.file.frontmatter.date && !item.file.frontmatter.collection
        )
        .sort((a, b) => new Date(b.file.frontmatter.date as string).getTime() - new Date(a.file.frontmatter.date as string).getTime())
        .slice(0, 20)
        .map((item) => {
            const absoluteUrl = new URL(getUrlForNode(item.node, synchronizedManifest, false), siteBaseUrl).href;
            return `<item><title>${escapeForXml(item.node.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${new Date(item.file.frontmatter.date as string).toUTCString()}</pubDate><description>${escapeForXml(item.file.frontmatter.description)}</description></item>`;
        }).join('');

    const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(synchronizedManifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(synchronizedManifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
    zip.file('rss.xml', rssFeed);

    const sitemapUrls = allStaticNodes.map((node: FlattenedNode) => {
        const file = contentFiles.find(f => f.path === node.path);
        const absoluteUrl = new URL(getUrlForNode(node, synchronizedManifest, false), siteBaseUrl).href;
        const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
        return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
    }).join('');
    const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
    zip.file('sitemap.xml', sitemapXml);

    return zip.generateAsync({ type: 'blob' });
}