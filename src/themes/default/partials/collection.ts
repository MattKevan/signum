// src/themes/default/partials/collection.ts
import { ParsedMarkdownFile } from '@/types';
import { escapeHtml } from '../utils';

// This interface is used by renderCollectionListContent when preparing items
export interface CollectionItemForTemplate extends Omit<ParsedMarkdownFile, 'frontmatter' | 'content'> {
  frontmatter: ParsedMarkdownFile['frontmatter'] & {
    date?: string;
    title: string;
  };
  itemLink: string;
  summaryOrContentTeaser: string;
}

// Renders a single item in a list - this itself doesn't need .prose, but its contents will be.
export function renderCollectionItemContent(item: CollectionItemForTemplate): string {
  const title = escapeHtml(item.frontmatter.title || 'Untitled Item');
  const date = item.frontmatter.date 
    ? new Date(item.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return `
<li class="collection-item"> <!-- Styled by theme.css -->
  <article>
    <h2 class="collection-item-title"><a href="${escapeHtml(item.itemLink)}">${title}</a></h2>
    ${date ? `<p class="collection-item-date">${date}</p>` : ''}
    ${item.summaryOrContentTeaser ? `<div class="collection-item-summary prose-sm">${item.summaryOrContentTeaser}</div>` : ''} <!-- Wrap teaser in a div with prose styling if it's HTML -->
    <a href="${escapeHtml(item.itemLink)}" class="collection-item-readmore">Read More →</a>
  </article>
</li>
  `;
}

// Renders the overall list of collection items.
export function renderCollectionListContent(
  collectionTitle: string, 
  items: CollectionItemForTemplate[], 
  collectionIndexContentHtml?: string // HTML from the collection's own index.md page
): string {
  const itemsHtml = items.map(item => renderCollectionItemContent(item)).join('');

  return `
<section class="collection prose"> <!-- Added .prose class here for overall styling -->
  <header class="collection-header">
    <h1>${escapeHtml(collectionTitle)}</h1> <!-- Styled by .prose h1 -->
  </header>
  ${collectionIndexContentHtml ? `<div class="collection-index-content">${collectionIndexContentHtml}</div>` : ''} <!-- Content from collection's index.md -->
  ${items.length > 0 ? `<ul class="collection-list">${itemsHtml}</ul>` : '<p>No items in this collection.</p>'}
</section>
  `;
}