// src/lib/siteExporter.ts
import JSZip from 'jszip';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import { LocalSiteData, StructureNode, ParsedMarkdownFile, Manifest, NavLinkItem } from '@/types';
import { stringifyToMarkdown } from '@/lib/markdownParser';
import { flattenStructureToPages } from './fileTreeUtils';

// --- Type Definition for Template Context ---
interface TemplateContext {
    manifest: Manifest;
    navLinks: NavLinkItem[];
    collection?: StructureNode & { items: ParsedMarkdownFile[] };
    frontmatter?: ParsedMarkdownFile['frontmatter'];
    contentHtml?: string;
    body?: string;
}

// --- Caching and Helper Functions ---
const templateCache: { [key:string]: Handlebars.TemplateDelegate } = {};
async function getTemplate(path: string): Promise<Handlebars.TemplateDelegate> {
  if (templateCache[path]) return templateCache[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Template not found: ${path}`);
  const source = await res.text();
  const template = Handlebars.compile(source);
  templateCache[path] = template;
  return template;
}

function escapeForXml(str: string | undefined | unknown): string {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, (match) => {
    return { '<': '<', '>': '>', '&': '&', '"': '"', "'": "'" }[match] || match;
  });
}

function getUrlForNode(node: StructureNode, basePath: string = '/'): string {
    if (node.slug === 'index') return basePath;
    const path = `${basePath}/${node.slug}`.replace(/\/\//g, '/');
    return path;
}


// --- Main Export Function ---
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const themeName = siteData.manifest.theme.name;
  const themeManifest = await fetch(`/themes/${themeName}/theme.json`).then(r => r.json());

  // 1. Concatenate all CSS files
  let finalCss = '';
  const baseCss = await fetch(`/themes/${themeName}/assets/base.css`).then(r => r.text()).catch(() => '');
  finalCss += baseCss + '\n';
  for (const layoutId of themeManifest.layouts) {
    const layoutCss = await fetch(`/themes/${themeName}/layouts/${layoutId}/style.css`).then(r => r.text()).catch(() => '');
    finalCss += layoutCss + '\n';
  }
  zip.file('css/style.css', finalCss);
  
  // 2. Prepare for HTML Generation
  const baseTemplate = await getTemplate(`/themes/${themeName}/base.hbs`);

  // 3. Recursive HTML Generation
  async function generateHtmlRecursive(nodes: StructureNode[], zipPathPrefix: string) {
    for (const node of nodes) {
      const context: TemplateContext = { manifest: siteData.manifest, navLinks: [] };
      let layoutTemplate: Handlebars.TemplateDelegate;
      let outputPath: string;
      
      if (node.type === 'collection') {
        layoutTemplate = await getTemplate(`/themes/${themeName}/layouts/${node.layout}/index.hbs`);
        const items = (node.children || [])
          .map(child => siteData.contentFiles.find(f => f.path === child.path))
          .filter((f): f is ParsedMarkdownFile => !!f);
        
        context.collection = { ...node, items };
        outputPath = `${zipPathPrefix}${node.slug}/index.html`;

      } else { // type === 'page'
        const contentFile = siteData.contentFiles.find(f => f.path === node.path);
        if (!contentFile) continue;
        
        const isIndexFileForCollection = node.path.endsWith('/index.md') && node.slug !== 'index';
        const templateFile = isIndexFileForCollection ? 'index.hbs' : 'item.hbs';
        layoutTemplate = await getTemplate(`/themes/${themeName}/layouts/${node.layout}/${templateFile}`);
        
        context.frontmatter = contentFile.frontmatter;
        // FIXED: Use 'await' to ensure we get a string from the marked parser.
        context.contentHtml = await marked.parse(contentFile.content);
        
        outputPath = node.slug === 'index' ? `index.html` : `${zipPathPrefix}${node.slug}.html`;
      }
      
      const mainContentHtml = layoutTemplate(context);
      const finalHtml = baseTemplate({ ...context, body: mainContentHtml });
      zip.file(outputPath.replace(/^\//, ''), finalHtml);

      if (node.children) {
        await generateHtmlRecursive(node.children, `${zipPathPrefix}${node.slug}/`);
      }
    }
  }

  await generateHtmlRecursive(siteData.manifest.structure, '');

  // 4. Add _signum source files
  zip.file(`_signum/manifest.json`, JSON.stringify(siteData.manifest, null, 2));
  for (const file of siteData.contentFiles) {
    const rawMd = stringifyToMarkdown(file.frontmatter, file.content);
    zip.file(`_signum/${file.path}`, rawMd);
  }

  // 5. RSS and Sitemap Generation
  const allPageNodes = flattenStructureToPages(siteData.manifest.structure);
  const siteBaseUrl = `https://${siteData.manifest.title.toLowerCase().replace(/\s+/g, '-') || 'example'}.com`;

  const rssItems = allPageNodes
    .map(p => ({ node: p, file: siteData.contentFiles.find(f => f.path === p.path) }))
    .filter(item => item.file && item.file.frontmatter.date)
    .sort((a,b) => new Date(b.file!.frontmatter.date as string).getTime() - new Date(a.file!.frontmatter.date as string).getTime())
    .slice(0, 20)
    .map(item => {
        const url = new URL(getUrlForNode(item.node!, '/').replace(/^\//, ''), siteBaseUrl).href + '.html';
        const description = escapeForXml(item.file!.frontmatter.description || item.file!.frontmatter.summary);
        return `<item><title>${escapeForXml(item.node!.title)}</title><link>${escapeForXml(url)}</link><guid isPermaLink="true">${escapeForXml(url)}</guid><pubDate>${new Date(item.file!.frontmatter.date as string).toUTCString()}</pubDate><description>${description}</description></item>`;
    }).join('');
  const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(siteData.manifest.title)}</title><link>${siteBaseUrl}</link><description>${escapeForXml(siteData.manifest.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrl).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
  zip.file('rss.xml', rssFeed);

  const sitemapUrls = allPageNodes.map(node => {
      const file = siteData.contentFiles.find(f => f.path === node.path);
      const url = new URL(getUrlForNode(node, '/').replace(/^\//, ''), siteBaseUrl).href + '.html';
      const lastMod = (file?.frontmatter.date as string || new Date().toISOString()).split('T')[0];
      return `<url><loc>${escapeForXml(url)}</loc><lastmod>${lastMod}</lastmod></url>`;
  }).join('');
  const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
  zip.file('sitemap.xml', sitemapXml);

  return zip.generateAsync({ type: 'blob' });
}