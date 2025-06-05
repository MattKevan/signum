// src/lib/siteExporter.ts
import { LocalSiteData, ParsedMarkdownFile, SiteConfigFile } from '@/types';
import { renderPageLayout } from '@/themes/default/layout';
import { renderHeader } from '@/themes/default/partials/header';
import { renderFooter } from '@/themes/default/partials/footer';
import { renderArticleContent } from '@/themes/default/partials/article';
import { renderCollectionListContent, type CollectionItemForTemplate } from '@/themes/default/partials/collection';
import { marked } from 'marked';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import { slugify } from './utils';
import type { NavLinkItem } from '@/types';
import { stringifyToMarkdown } from './markdownParser';

const SIGNUM_DIR = '_signum';
const CONTENT_DIR_IN_SIGNUM = `${SIGNUM_DIR}/content`;
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

// This function needs to be robust and mirror live navigation logic as closely as possible
function getSsgNavLinks(siteData: LocalSiteData, siteRootPath: string): NavLinkItem[] {
    const navLinks: NavLinkItem[] = [];
    const homePath = siteRootPath.endsWith('/') ? siteRootPath : `${siteRootPath}/`;
    navLinks.push({ href: homePath, label: "Home", iconName: "home", isActive: false });

    const collections = new Map<string, {label: string}>(); // Simplified for nav link generation
    const topLevelPages = new Map<string, ParsedMarkdownFile>();

    siteData.contentFiles.forEach(file => {
        if (file.frontmatter.draft || file.frontmatter.status === 'draft') return;
        
        const relativePath = file.path.replace(/^content\//i, ''); // Case insensitive replace
        const pathParts = relativePath.split('/');
        
        if (pathParts.length > 1 && pathParts[0].toLowerCase() !== 'index.md') {
            const collectionSlug = pathParts[0];
            if (!collections.has(collectionSlug)) {
                const collectionConfig = siteData.config.collections?.find(c => c.path.toLowerCase() === collectionSlug.toLowerCase());
                collections.set(collectionSlug, {
                    label: collectionConfig?.nav_label || collectionSlug.charAt(0).toUpperCase() + collectionSlug.slice(1)
                });
            }
        } else if (pathParts.length === 1 && relativePath.toLowerCase() !== 'index.md') {
            const slug = relativePath.replace(/\.md$/i, '');
            topLevelPages.set(slug, file);
        }
    });

    topLevelPages.forEach((file, slug) => {
        navLinks.push({
            href: `${siteRootPath}${slug}.html`.replace(/\/\//g, '/'),
            label: file.frontmatter.title || slug,
            iconName: "file-text", 
            isActive: false,
        });
    });

    collections.forEach((collectionData, collectionSlug) => {
        navLinks.push({
            href: `${siteRootPath}${collectionSlug}/index.html`.replace(/\/\//g, '/'),
            label: collectionData.label,
            iconName: "folder",
            isActive: false,
        });
    });
    
    return navLinks.filter((link, index, self) => 
        index === self.findIndex((l) => (l.href === link.href))
    );
}


export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const generatedFiles: GeneratedFile[] = [];
  const siteRootPathForLinks = '/'; 

  console.log("[Exporter] Starting site export process...");

  const publicContentFiles = siteData.contentFiles.filter(
    (f) => !f.frontmatter.draft && f.frontmatter.status !== 'draft'
  );

  const ssgNavLinks = getSsgNavLinks(siteData, siteRootPathForLinks);
  const siteHeaderHtml = renderHeader(siteData.config, ssgNavLinks, siteRootPathForLinks);
  const siteFooterHtml = renderFooter(siteData.config);

  const filesByCollection: Record<string, ParsedMarkdownFile[]> = {};
  const topLevelPages: ParsedMarkdownFile[] = [];
  
  publicContentFiles.forEach((file) => {
      const pathParts = file.path.replace(/^content\//i, '').split('/');
      if (pathParts.length > 1 && pathParts[0].toLowerCase() !== 'index.md') {
          const collectionName = pathParts[0];
          if (!filesByCollection[collectionName]) filesByCollection[collectionName] = [];
          if (pathParts[pathParts.length -1].toLowerCase() !== 'index.md') {
              filesByCollection[collectionName].push(file);
          }
      } else {
          topLevelPages.push(file);
      }
  });

  console.log(`[Exporter] Found ${topLevelPages.length} top-level pages and ${Object.keys(filesByCollection).length} collections.`);

  // Generate single pages (and site index.html)
  for (const file of topLevelPages) {
    const articleMainContentHtml = renderArticleContent(file); // Uses partial
    const pageHtml = renderPageLayout(
        siteData.config, 
        file.frontmatter.title || file.slug, 
        siteHeaderHtml, 
        articleMainContentHtml, 
        siteFooterHtml
    );
    
    const exportPath = (file.path.toLowerCase() === 'content/index.md') 
        ? 'index.html' 
        : `${file.path.replace(/^content\//i, '').replace(/\.md$/i, '')}.html`;
    generatedFiles.push({ path: exportPath, content: pageHtml });
    console.log(`[Exporter] Generated HTML for: ${exportPath}`);
  }

  // Generate collection pages
  for (const collectionName in filesByCollection) {
    const items = filesByCollection[collectionName];
    items.sort((a, b) => { 
        const dateA = a.frontmatter.date ? new Date(a.frontmatter.date).getTime() : 0;
        const dateB = b.frontmatter.date ? new Date(b.frontmatter.date).getTime() : 0;
        if(dateA === 0 && dateB === 0) return (a.frontmatter.title || '').localeCompare(b.frontmatter.title || '');
        return dateB - dateA; 
    });

    const collectionItemsForTemplate: CollectionItemForTemplate[] = items.map(item => {
        const itemPathSegment = item.path.replace(/^content\//i, '').replace(/\.md$/i, '');
        // Generate teaser: use summary, or first ~150 chars of content (plaintext)
        let teaser = item.frontmatter.summary || '';
        if (!teaser) {
            const plainTextContent = (item.content || '').replace(/<[^>]+>/gm, '').replace(/\s+/g, ' ').trim(); // Basic strip HTML
            teaser = plainTextContent.substring(0, 150) + (plainTextContent.length > 150 ? '...' : '');
        }
        return {
            slug: item.slug, // Pass slug through
            path: item.path, // Pass path through
            frontmatter: item.frontmatter, // Pass frontmatter through
            itemLink: `${siteRootPathForLinks}${itemPathSegment}.html`.replace(/\/\//g,'/'),
            summaryOrContentTeaser: escapeForXml(teaser), // Escape the teaser for HTML
        };
    });

    const collectionIndexFile = publicContentFiles.find(
        f => f.path.toLowerCase() === `content/${collectionName}/index.md`.toLowerCase()
    );
    let collectionIndexBodyHtmlRendered = '';
    let collectionPageTitle = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);
    const collectionConfig = siteData.config.collections?.find(c => c.path.toLowerCase() === collectionName.toLowerCase());
    if(collectionConfig?.nav_label) collectionPageTitle = collectionConfig.nav_label;

    if (collectionIndexFile) {
        collectionPageTitle = collectionIndexFile.frontmatter.title || collectionPageTitle;
        collectionIndexBodyHtmlRendered = marked.parse(collectionIndexFile.content || '') as string;
    }
    
    const collectionListMainContentHtml = renderCollectionListContent(
      collectionPageTitle, 
      collectionItemsForTemplate,
      collectionIndexBodyHtmlRendered 
    );
    
    const fullCollectionPageHtml = renderPageLayout(
        siteData.config, 
        collectionPageTitle, 
        siteHeaderHtml, 
        collectionListMainContentHtml, 
        siteFooterHtml
    );
    generatedFiles.push({ path: `${collectionName}/index.html`, content: fullCollectionPageHtml });
    console.log(`[Exporter] Generated HTML for collection index: ${collectionName}/index.html`);

    // Generate individual item pages within collections
    for (const item of items) { 
      const articleMainContentHtml = renderArticleContent(item); // Use partial
      const itemPageHtml = renderPageLayout(
          siteData.config, 
          item.frontmatter.title || item.slug, 
          siteHeaderHtml, 
          articleMainContentHtml, 
          siteFooterHtml
      );
      const itemExportPath = item.path.replace(/^content\//i, '').replace(/\.md$/i, '.html');
      generatedFiles.push({ path: itemExportPath, content: itemPageHtml });
      console.log(`[Exporter] Generated HTML for collection item: ${itemExportPath}`);
    }
  }

  // --- Asset Copying (CSS & JS) ---
  const themeStylePath = '/themes/default/style.css';
  const themeScriptPath = '/themes/default/scripts.js';
  try { 
    console.log(`[Exporter] Fetching theme CSS from: ${themeStylePath}`);
    const styleCssResponse = await fetch(themeStylePath);
    if (!styleCssResponse.ok) throw new Error(`Failed to fetch style.css (${styleCssResponse.status})`);
    const styleCssContent = await styleCssResponse.text();
    if (styleCssContent.toLowerCase().includes('<!doctype html>')) {
        console.error(`[Exporter] Fetched HTML instead of CSS from ${themeStylePath}. Check file exists in /public and no route conflict.`);
    } else {
        generatedFiles.push({ path: `${CSS_DIR_EXPORT}/style.css`, content: styleCssContent });
        console.log(`[Exporter] Added ${CSS_DIR_EXPORT}/style.css to bundle.`);
    }
  } catch (e) { console.warn(`[Exporter] CSS fetch error:`, e); }

  try { 
    console.log(`[Exporter] Fetching theme JS from: ${themeScriptPath}`);
    const scriptsJsResponse = await fetch(themeScriptPath);
    if (!scriptsJsResponse.ok) throw new Error(`Failed to fetch scripts.js (${scriptsJsResponse.status})`);
    const scriptsJsContent = await scriptsJsResponse.text();
     if (scriptsJsContent.toLowerCase().includes('<!doctype html>')) {
        console.error(`[Exporter] Fetched HTML instead of JS from ${themeScriptPath}. Check file exists in /public and no route conflict.`);
    } else {
        generatedFiles.push({ path: `${JS_DIR_EXPORT}/scripts.js`, content: scriptsJsContent });
        console.log(`[Exporter] Added ${JS_DIR_EXPORT}/scripts.js to bundle.`);
    }
  } catch (e) { console.warn(`[Exporter] JS fetch error:`, e); }

  // --- _signum Data Packaging ---
    const siteYamlContent = yaml.dump(siteData.config);
    generatedFiles.push({ path: `${SIGNUM_DIR}/site.yaml`, content: siteYamlContent });
    console.log(`[Exporter] Added ${SIGNUM_DIR}/site.yaml`);

    for (const file of siteData.contentFiles) { 
        const rawMarkdown = stringifyToMarkdown(file.frontmatter, file.content);
        generatedFiles.push({ path: `${SIGNUM_DIR}/${file.path}`, content: rawMarkdown });
    }
    console.log(`[Exporter] Added ${siteData.contentFiles.length} raw content files to ${SIGNUM_DIR}/content`);
    
    // Manifest generation
    const manifest = {
        siteId: siteData.siteId.replace(/^remote-/, ''),
        title: siteData.config.title,
        description: siteData.config.description,
        lastUpdatedSite: new Date().toISOString(),
        generatorVersion: 'SignumClient/0.1.0',
        entries: publicContentFiles.map(file => {
            let htmlPath = '';
            const relativePathNoExt = file.path.replace(/^content\//i, '').replace(/\.md$/i, '');
            const pathParts = file.path.replace(/^content\//i, '').split('/');

            if (file.path.toLowerCase() === 'content/index.md') {
                htmlPath = 'index.html';
            } else if (pathParts.length > 1 && pathParts[pathParts.length - 1].toLowerCase() === 'index.md') {
                htmlPath = `${pathParts.slice(0, -1).join('/')}/index.html`;
            } else {
                htmlPath = `${relativePathNoExt}.html`;
            }
            htmlPath = htmlPath.replace(/^\//, '').replace(/\/\//g, '/'); // Clean path

            return {
                type: file.path.toLowerCase().endsWith('index.md') ? 'collection_index' : 'page',
                status: file.frontmatter.status || 'published',
                sourcePath: `${SIGNUM_DIR}/${file.path}`, 
                htmlPath: htmlPath,
                url: `${siteRootPathForLinks}${htmlPath}`.replace(/\/\//g,'/'), // Relative URL path
                title: file.frontmatter.title, 
                date: file.frontmatter.date, 
                slug: file.slug,
            };
        }),
    };
    generatedFiles.push({ path: `${SIGNUM_DIR}/manifest.json`, content: JSON.stringify(manifest, null, 2) });
    console.log(`[Exporter] Generated ${SIGNUM_DIR}/manifest.json`);

    const signumIndexHtml = `<!DOCTYPE html><html><head><title>Signum Site Data</title><meta charset="utf-8"><style>body{font-family: sans-serif; padding: 2em; text-align: center;} h1{color: #333;} p{color:#555;}</style></head><body><h1>This is a Signum Site</h1><p>This <code>_signum</code> directory contains the raw source data and manifest for this website, intended for use by Signum clients and compatible tools.</p><p><a href="https://signum.dev" target="_blank" rel="noopener">Learn more about Signum</a> (hypothetical link)</p></body></html>`;
    generatedFiles.push({ path: `${SIGNUM_DIR}/index.html`, content: signumIndexHtml });

  // --- RSS and Sitemap ---
  // Placeholder for siteBaseUrl - this should ideally come from siteConfig
  const siteBaseUrlForFeeds = `http://${slugify(siteData.config.title || 'example-site').substring(0,30)}.com`; 

  const rssItems = publicContentFiles
      .filter(f => f.path.toLowerCase() !== 'content/index.md' && !f.path.toLowerCase().endsWith('/index.md'))
      .sort((a,b) => new Date(b.frontmatter.date || 0).getTime() - new Date(a.frontmatter.date || 0).getTime())
      .slice(0, 20) // Limit RSS items
      .map(file => {
      const entryInManifest = manifest.entries.find(e => e.sourcePath === `${SIGNUM_DIR}/${file.path}`);
      // Ensure URL is absolute for RSS
      const absoluteUrl = new URL((entryInManifest?.url || '').replace(/^\//, ''), siteBaseUrlForFeeds).href;
      return `
          <item>
          <title>${escapeForXml(file.frontmatter.title || 'Untitled')}</title>
          <link>${escapeForXml(absoluteUrl)}</link>
          <guid isPermaLink="true">${escapeForXml(absoluteUrl)}</guid>
          <pubDate>${file.frontmatter.date ? new Date(file.frontmatter.date).toUTCString() : new Date().toUTCString()}</pubDate>
          <description>${escapeForXml(file.frontmatter.summary || (file.content || '').substring(0, 200).replace(/<[^>]+>/gm, '').replace(/\s+/g, ' ').trim() + '...')}</description>
          </item>`;
      }).join('');

  const rssFeedLink = new URL('rss.xml', siteBaseUrlForFeeds).href;
  const channelLink = siteBaseUrlForFeeds.endsWith('/') ? siteBaseUrlForFeeds : `${siteBaseUrlForFeeds}/`;

  const rssFeed = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeForXml(siteData.config.title)}</title><link>${escapeForXml(channelLink)}</link><description>${escapeForXml(siteData.config.description || '')}</description><language>en-us</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${escapeForXml(rssFeedLink)}" rel="self" type="application/rss+xml" />${rssItems}</channel></rss>`;
  generatedFiles.push({ path: 'rss.xml', content: rssFeed });
  console.log(`[Exporter] Generated rss.xml`);

  const sitemapUrls = manifest.entries.map(entry => {
      const absoluteUrl = new URL(entry.url.replace(/^\//, ''), siteBaseUrlForFeeds).href;
      const lastMod = entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0];
      return `<url><loc>${escapeForXml(absoluteUrl)}</loc><lastmod>${lastMod}</lastmod></url>`;
  }).join('');

  const sitemapXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>`;
  generatedFiles.push({ path: 'sitemap.xml', content: sitemapXml });
  console.log(`[Exporter] Generated sitemap.xml`);

  // --- Final Zip Generation ---
  console.log(`[Exporter] Adding ${generatedFiles.length} files to Zip archive...`);
  generatedFiles.forEach(file => {
    zip.file(file.path, file.content);
  });

  console.log("[Exporter] Generating Zip blob...");
  return zip.generateAsync({ type: 'blob' });
}