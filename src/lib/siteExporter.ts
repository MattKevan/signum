// src/lib/siteExporter.ts
import JSZip from 'jszip';
import { LocalSiteData, ParsedMarkdownFile, StructureNode } from '@/types';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { flattenStructureToRenderableNodes } from './fileTreeUtils';
import { resolvePageContent, PageType } from './pageResolver';
import { render as renderWithTheme } from './themeEngine';

function escapeForXml(str: string | undefined | unknown): string {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>"']/g, (match) => {
      return { '<': '<', '>': '>', '&': '&', '"': '"', "'": "'" }[match] || match;
    });
}
  
function getUrlForNode(node: { slug: string, path: string, type: 'page' | 'collection' }, basePath: string = '/'): string {
    if (node.slug === 'index' && node.type === 'page' && !node.path.includes('/')) {
        return `${basePath}index.html`;
    }

    if (node.type === 'collection') {
        return `${basePath}${node.slug}/index.html`.replace(/\/\//g, '/');
    }
    
    const pathSegments = node.path.replace(/^content\//, '').replace(/\.md$/, '');
    const path = `${basePath}${pathSegments}.html`;
    return path.replace(/\/\//g, '/');
}


// --- Main Export Function ---
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const themeId = siteData.manifest.theme.name;
  const themeType = siteData.manifest.theme.type;
  const themePath = `/themes/${themeType}/${themeId}`;

  // 1. Correctly bundle all theme assets (CSS, JS)
  try {
    const themeManifest = await fetch(`${themePath}/theme.json`).then(r => r.json());
    let finalCss = '';
    
    const baseCssPath = `${themePath}/assets/base.css`;
    const baseCss = await fetch(baseCssPath).then(r => r.ok ? r.text() : '').catch(() => '');
    finalCss += baseCss + '\n';
    
    if (themeManifest.layouts) {
        for (const layoutId of themeManifest.layouts) {
            const layoutCssPath = `${themePath}/layouts/${layoutId}/style.css`;
            const layoutCss = await fetch(layoutCssPath).then(r => r.ok ? r.text() : '').catch(() => '');
            finalCss += layoutCss + '\n';
        }
    }
    zip.file('style.css', finalCss);

    const scriptsJsPath = `${themePath}/scripts.js`;
    const scriptsJs = await fetch(scriptsJsPath).then(r => r.ok ? r.text() : '').catch(() => '');
    if (scriptsJs) {
        zip.file('scripts.js', scriptsJs);
    }

  } catch (e) {
      console.warn("Could not bundle theme assets for export.", e);
  }

  // 2. Generate all HTML pages using the correct node list
  const allRenderableNodes = flattenStructureToRenderableNodes(siteData.manifest.structure);
  
  for (const node of allRenderableNodes) {
      const slugArray = (node.type === 'collection') 
          ? [node.slug] 
          : node.path.replace(/^content\//, '').replace(/\.md$/, '').split('/').filter(Boolean);
      
      const resolution = resolvePageContent(siteData, slugArray);
      
      if (resolution.type === PageType.NotFound) {
        console.warn(`Skipping export for node with missing content: ${node.path}`);
        continue;
      }
      
      const finalHtml = await renderWithTheme(siteData, resolution, '/');
      
      let outputPath = getUrlForNode({ ...node, type: node.type as 'page' | 'collection' }, '/');
      outputPath = outputPath.startsWith('/') ? outputPath.substring(1) : outputPath;

      zip.file(outputPath, finalHtml);
  }

  // 3. Add _signum source files
  zip.file(`_signum/manifest.json`, JSON.stringify(siteData.manifest, null, 2));
  for (const file of siteData.contentFiles) {
    const rawMd = stringifyToMarkdown(file.frontmatter, file.content);
    zip.file(`_signum/${file.path}`, rawMd);
  }

  // 4. Conditionally bundle custom theme source files
  if (themeType === 'contrib') {
    console.log(`Bundling 'contrib' theme source for: ${themeId}`);
    const themeZipPrefix = `_signum/themes/contrib/${themeId}`;
    const themeFetchPrefix = `/themes/contrib/${themeId}`;

    const themeManifest = await fetch(`${themeFetchPrefix}/theme.json`).then(r => r.json());
    
    zip.file(`${themeZipPrefix}/theme.json`, JSON.stringify(themeManifest, null, 2));
    
    const addFileToTheme = async (filePath: string) => {
        try {
            const response = await fetch(filePath);
            if (response.ok) {
                const content = await response.text();
                const zipPath = filePath.replace(themeFetchPrefix, themeZipPrefix);
                zip.file(zipPath, content);
            }
        } catch {}
    };

    await addFileToTheme(`${themeFetchPrefix}/assets/base.css`);
    await addFileToTheme(`${themeFetchPrefix}/scripts.js`);

    // CORRECTED: Only bundle partials that are explicitly defined in the manifest.
    if(themeManifest.partials) {
        for (const key in themeManifest.partials) {
            await addFileToTheme(themeManifest.partials[key]);
        }
    }

    for (const layoutId of themeManifest.layouts) {
        const layoutPath = `${themeFetchPrefix}/layouts/${layoutId}`;
        await addFileToTheme(`${layoutPath}/schema.json`);
        await addFileToTheme(`${layoutPath}/item.schema.json`);
        await addFileToTheme(`${layoutPath}/index.hbs`);
        await addFileToTheme(`${layoutPath}/item.hbs`);
        await addFileToTheme(`${layoutPath}/style.css`);
    }
  }

  // 5. RSS and Sitemap Generation
  const allPageNodes = allRenderableNodes.filter((n: StructureNode) => n.type === 'page');
  const siteBaseUrl = `https://${siteData.manifest.title.toLowerCase().replace(/\s+/g, '-') || 'example'}.com`;

  type RssItem = { node: StructureNode, file?: ParsedMarkdownFile };

  const rssItems = allPageNodes
    .map((p: StructureNode): RssItem => ({ node: p, file: siteData.contentFiles.find(f => f.path === p.path) }))
    .filter((item: RssItem) => item.file && item.file.frontmatter.date)
    .sort((a: RssItem, b: RssItem) => new Date(b.file!.frontmatter.date as string).getTime() - new Date(a.file!.frontmatter.date as string).getTime())
    .slice(0, 20)
    .map((item: RssItem) => {
        const url = new URL(getUrlForNode({ ...item.node!, type: 'page' }, '/'), siteBaseUrl).href;
        const description = escapeForXml(item.file!.frontmatter.summary || '');
        return `<item><title>${escapeForXml(item.node!.title)}</title><link>${escapeForXml(url)}</link><guid isPermaLink="true">${escapeForXml(url)}</guid><pubDate>${new Date(item.file!.frontmatter.date as string).toUTCString()}</pubDate><description>${description}</description></item>`;
    }).join('');
  const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(siteData.manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(siteData.manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
  zip.file('rss.xml', rssFeed);

  const sitemapUrls = allPageNodes.map((node: StructureNode) => {
      const file = siteData.contentFiles.find(f => f.path === node.path);
      const url = new URL(getUrlForNode({ ...node, type: 'page' }, '/'), siteBaseUrl).href;
      const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
      return `<url><loc>${escapeForXml(url)}</loc><lastmod>${lastMod}</lastmod></url>`;
  }).join('');
  const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
  zip.file('sitemap.xml', sitemapXml);

  return zip.generateAsync({ type: 'blob' });
}