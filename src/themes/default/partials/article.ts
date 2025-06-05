// src/themes/default/partials/article.ts
import { ParsedMarkdownFile } from '@/types';
import { escapeHtml } from '../utils';
import { marked } from 'marked';

export function renderArticleContent(fileData: ParsedMarkdownFile): string {
  const title = escapeHtml(fileData.frontmatter.title || 'Untitled Page');
  const date = fileData.frontmatter.date 
    ? new Date(fileData.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : '';
  const markdownBodyHtml = marked.parse(fileData.content || '') as string;

  // The .prose class will provide Tailwind-like typography for elements within.
  return `
<article class="post prose"> {/* Added .prose class here */}
  <header class="post-header"> {/* Specific styling for post headers in theme.css */}
    <h1>${title}</h1> {/* Will be styled by .prose h1 */}
    ${date ? `<p class="post-date">${date}</p>` : ''}
    ${fileData.frontmatter.summary ? `<p class="post-summary">${escapeHtml(fileData.frontmatter.summary)}</p>` : ''}
  </header>
  <div class="post-content"> {/* This div is mostly for semantic grouping if needed */}
    ${markdownBodyHtml} {/* Markdown elements (p, ul, etc.) will be styled by .prose */}
  </div>
</article>
  `;
}