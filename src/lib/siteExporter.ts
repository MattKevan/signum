// src/lib/siteExporter.ts
import { LocalSiteData } from '@/types';
import JSZip from 'jszip';
import { slugify } from './utils';
import { stringifyToMarkdown } from './markdownParser';
import { generateNavLinks } from './navigationUtils';
import { resolvePageContent, PageType } from './pageResolver';
import { renderPageLayout } from '@/themes/default/layout';
import { renderHeader } from '@/themes/default/partials/header';
import { renderFooter } from '@/themes/default/partials/footer';
import { Manifest } from '@/types';

const SIGNUM_DIR = '_signum';
const CSS_DIR_EXPORT = 'css';
const JS_DIR_EXPORT = 'js';

interface GeneratedFile {
  path: string;
  content: string | Uint8Array;
}

function escapeForXml(str: string | undefined): string {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[<>&"']/g, function (match) {
        switch (match) {
            case '<': return '<';
            case '>': return '>';
            case '&': return '&';
            case '"': return '"';
            case "'": return "'";
            default: return match;
        }
    });
}

export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const generatedFiles: GeneratedFile[] = [];
  const siteRootPathForLinks = '/'; 

  console.log("[Exporter] Starting site export process...");

  const publicContentFiles = siteData.contentFiles.filter(
    (f) => !f.frontmatter.draft && f.frontmatter.status !== 'draft'
  );

  // --- Generate HTML pages ---
  const navLinks = generateNavLinks(siteData, { isStaticExport: true, siteRootPath: siteRootPathForLinks });
  const siteHeaderHtml = renderHeader(siteData.config, navLinks, siteRootPathForLinks);
  const siteFooterHtml = renderFooter(siteData.config);
  
  const pathsToRender = new Set<string>();
  publicContentFiles.forEach(file => {
      const path = file.path.replace(/^content\//, '').replace(/\.md$/, '');
      if (path === 'index') {
          pathsToRender.add(''); // Root index
      } else {
          pathsToRender.add(path); // Single page
          // Add parent collection path
          const segments = path.split('/');
          if (segments.length > 1) {
              pathsToRender.add(segments[0]);
          }
      }
  });

  for (const path of pathsToRender) {
    const slugArray = path.split('/').filter(Boolean);
    const resolution = resolvePageContent(siteData, slugArray);
    
    if (resolution.type === PageType.SinglePage || resolution.type === PageType.CollectionListing) {
        const fullHtml = renderPageLayout(
            siteData.config,
            resolution.pageTitle || 'Untitled',
            siteHeaderHtml,
            resolution.mainContentHtml || '',
            siteFooterHtml
        );
        const exportPath = path ? (resolution.type === PageType.CollectionListing ? `${path}/index.html` : `${path}.html`) : 'index.html';
        generatedFiles.push({ path: exportPath, content: fullHtml });
        console.log(`[Exporter] Generated HTML for: ${exportPath}`);
    }
  }

  // --- Asset Copying (CSS & JS) ---
  const themeStylePath = '/themes/default/style.css';
  try { 
    const styleCssResponse = await fetch(themeStylePath);
    if (styleCssResponse.ok) {
        generatedFiles.push({ path: `${CSS_DIR_EXPORT}/style.css`, content: await styleCssResponse.text() });
    }
  } catch (e) { console.warn(`[Exporter] CSS fetch error:`, e); }
  
  const themeScriptPath = '/themes/default/scripts.js';
  try { 
    const scriptsJsResponse = await fetch(themeScriptPath);
    if (scriptsJsResponse.ok) {
        generatedFiles.push({ path: `${JS_DIR_EXPORT}/scripts.js`, content: await scriptsJsResponse.text() });
    }
  } catch (e) { console.warn(`[Exporter] JS fetch error:`, e); }

  // --- _signum Data Packaging ---
  siteData.contentFiles.forEach(file => {
      const rawMarkdown = stringifyToMarkdown(file.frontmatter, file.content);
      generatedFiles.push({ path: `${SIGNUM_DIR}/${file.path}`, content: rawMarkdown });
  });

  // --- Manifest, RSS, Sitemap Generation ---
  const manifest: Manifest = {
    siteId: siteData.siteId.replace(/^remote-/, ''),
    generatorVersion: 'SignumClient/0.1.0',
    config: siteData.config,
    entries: publicContentFiles.map(file => {
      let htmlPath: string;
      const relativePathNoExt = file.path.replace(/^content\//i, '').replace(/\.md$/i, '');
      const pathParts = relativePathNoExt.split('/');
      if (relativePathNoExt === 'index') {
          htmlPath = 'index.html';
      } else if (file.path.toLowerCase().endsWith('/index.md')) {
          htmlPath = `${pathParts.slice(0, -1).join('/')}/index.html`;
      } else {
          htmlPath = `${relativePathNoExt}.html`;
      }
      return {
          type: file.path.toLowerCase().endsWith('/index.md') ? 'collection_index' : 'page',
          status: file.frontmatter.status || 'published',
          sourcePath: `${SIGNUM_DIR}/${file.path}`,
          htmlPath: htmlPath,
          url: `${siteRootPathForLinks}${htmlPath}`.replace(/\/\//g, '/'),
          title: file.frontmatter.title,
          date: file.frontmatter.date,
          slug: file.slug,
      };
    }),
  };
  generatedFiles.push({ path: `${SIGNUM_DIR}/manifest.json`, content: JSON.stringify(manifest, null, 2) });

  const signumIndexHtml = `<!DOCTYPE html><html><head><title>Signum Site Data</title></head><body><h1>Signum Site Data</h1><p>This directory contains raw source data for this website.</p></body></html>`;
  generatedFiles.push({ path: `${SIGNUM_DIR}/index.html`, content: signumIndexHtml });

  const siteBaseUrlForFeeds = `http://${slugify(siteData.config.title || 'example')}.com`;
  const rssItems = manifest.entries
      .filter(e => e.type === 'page' && e.date)
      .sort((a,b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 20)
      .map(entry => {
          const absoluteUrl = new URL(entry.url.replace(/^\//, ''), siteBaseUrlForFeeds).href;
          const fileData = siteData.contentFiles.find(f => f.slug === entry.slug);
          return `<item><title>${escapeForXml(entry.title)}</title><link>${escapeForXml(absoluteUrl)}</link><guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid><pubDate>${new Date(entry.date!).toUTCString()}</pubDate><description>${escapeForXml(fileData?.frontmatter.summary || '')}</description></item>`;
      }).join('');
  const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(siteData.config.title)}</title><link>${siteBaseUrlForFeeds}</link><description>${escapeForXml(siteData.config.description)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${new URL('rss.xml', siteBaseUrlForFeeds).href}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
  generatedFiles.push({ path: 'rss.xml', content: rssFeed });
  
  const sitemapUrls = manifest.entries.map(entry => `<url><loc>${new URL(entry.url.replace(/^\//, ''), siteBaseUrlForFeeds).href}</loc><lastmod>${(entry.date || new Date().toISOString()).split('T')[0]}</lastmod></url>`).join('');
  const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
  generatedFiles.push({ path: 'sitemap.xml', content: sitemapXml });

  // --- Final Zip Generation ---
  generatedFiles.forEach(file => {
    zip.file(file.path, file.content);
  });

  return zip.generateAsync({ type: 'blob' });
}