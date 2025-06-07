// src/lib/siteExporter.ts
import { LocalSiteData, StructureNode } from '@/types';
import JSZip from 'jszip';
import { slugify } from '@/lib/utils'; // CORRECTED PATH
import { stringifyToMarkdown } from '@/lib/markdownParser'; // CORRECTED PATH
import { generateNavLinks } from '@/lib/navigationUtils'; // CORRECTED PATH
import { resolvePageContent, PageType } from '@/lib/pageResolver'; // CORRECTED PATH
import { renderPageLayout } from '@/themes/default/layout';
import { flattenStructureToPages } from '@/lib/fileTreeUtils'; // CORRECTED PATH

const SIGNUM_DIR = '_signum';
const CSS_DIR_EXPORT = 'css';
const JS_DIR_EXPORT = 'js';

function escapeForXml(str: string | undefined): string {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>"']/g, (match) => {
        return { '<': '<', '>': '>', '&': '&', '"': '"', "'": "'" }[match] || match;
    });
}

async function generateHtmlForStructure(
  siteData: LocalSiteData,
  nodes: StructureNode[],
  currentPath: string = ''
): Promise<{ path: string; content: string }[]> {
  let files: { path: string; content: string }[] = [];
  const navLinks = generateNavLinks(siteData, { isStaticExport: true, siteRootPath: '/' });

  for (const node of nodes) {
    const slugArray = (currentPath ? `${currentPath}/${node.slug}` : node.slug).split('/').filter(s => s !== 'index');
    const resolution = resolvePageContent(siteData, slugArray);
    
    if (resolution.type === PageType.SinglePage || resolution.type === PageType.CollectionListing) {
      const isIndex = node.slug === 'index' || node.type === 'collection';
      
      const pathSegments = currentPath.split('/').filter(Boolean);
      pathSegments.push(node.slug);

      const exportPath = isIndex 
        ? `${pathSegments.join('/')}/index.html`
        : `${pathSegments.join('/')}.html`;

      const cleanedExportPath = exportPath.replace(/^index\//, '');

      const fullHtml = renderPageLayout(
          siteData.manifest,
          siteData.manifest.theme.config,
          resolution.pageTitle || 'Untitled',
          navLinks,
          resolution.mainContentHtml || ''
      );
      files.push({ path: cleanedExportPath, content: fullHtml });
    }

    if (node.children) {
      const childFiles = await generateHtmlForStructure(siteData, node.children, `${currentPath}/${node.slug}`.replace(/^index/, '').replace(/\/index/,''));
      files = files.concat(childFiles);
    }
  }
  return files;
}

export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();

  const htmlFiles = await generateHtmlForStructure(siteData, siteData.manifest.structure);
  htmlFiles.forEach(file => zip.file(file.path, file.content));

  const themeStylePath = `/themes/default/style.css`;
  const styleCssResponse = await fetch(themeStylePath);
  if (styleCssResponse.ok) {
      zip.file(`${CSS_DIR_EXPORT}/style.css`, await styleCssResponse.text());
  }

  const themeScriptPath = `/themes/default/scripts.js`;
  const scriptsJsResponse = await fetch(themeScriptPath);
  if (scriptsJsResponse.ok) {
      zip.file(`${JS_DIR_EXPORT}/scripts.js`, await scriptsJsResponse.text());
  }

  zip.file(`${SIGNUM_DIR}/manifest.json`, JSON.stringify(siteData.manifest, null, 2));
  
  siteData.contentFiles.forEach(file => {
      const rawMarkdown = stringifyToMarkdown(file.frontmatter, file.content);
      zip.file(`${SIGNUM_DIR}/${file.path}`, rawMarkdown);
  });
  
  const allPages = flattenStructureToPages(siteData.manifest.structure);
  const siteBaseUrl = `https://${slugify(siteData.manifest.title || 'example')}.com`;

  const rssItems = allPages
    .map(p => ({ node: p, file: siteData.contentFiles.find(f => f.path === p.path) }))
    .filter(item => item.file && item.file.frontmatter.date)
    .sort((a,b) => new Date(b.file!.frontmatter.date!).getTime() - new Date(a.file!.frontmatter.date!).getTime())
    .slice(0, 20)
    .map(item => {
        const { node, file } = item;
        const relativeUrl = node.slug === 'index' ? '/' : node.path.replace('content/','').replace('.md','.html');
        const url = new URL(relativeUrl, siteBaseUrl).href;
        return `<item><title>${escapeForXml(node.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(file!.frontmatter.date!).toUTCString()}</pubDate><description>${escapeForXml(file!.frontmatter.summary || '')}</description></item>`;
    }).join('');

  const rssFeed = `<rss version="2.0"><channel><title>${escapeForXml(siteData.manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(siteData.manifest.description)}</description>${rssItems}</channel></rss>`;
  zip.file('rss.xml', rssFeed);

  const sitemapUrls = allPages.map(node => {
      const file = siteData.contentFiles.find(f => f.path === node.path);
      const relativeUrl = node.slug === 'index' ? '/' : node.path.replace('content/','').replace('.md','.html');
      const url = new URL(relativeUrl, siteBaseUrl).href;
      return `<url><loc>${url}</loc><lastmod>${(file?.frontmatter.date || new Date().toISOString()).split('T')[0]}</lastmod></url>`;
  }).join('');
  const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
  zip.file('sitemap.xml', sitemapXml);

  return zip.generateAsync({ type: 'blob' });
}