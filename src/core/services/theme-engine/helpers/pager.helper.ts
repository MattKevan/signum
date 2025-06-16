// src/core/services/theme-engine/helpers/pager.helper.ts

import Handlebars from 'handlebars';
import { SignumHelper } from './types';
import { PaginationData } from '@/types';

/**
 * Renders a complete pagination control component.
 * It generates 'Previous' and 'Next' links and a 'Page X of Y' indicator.
 * The links are disabled when not applicable (e.g., on the first or last page).
 * 
 * @param {PaginationData} pagination - The pagination data object from the page resolver.
 * @returns {Handlebars.SafeString} The full HTML for the pager component.
 *
 * @example
 * {{{pager pagination}}}
 */
export const pagerHelper: SignumHelper = () => ({
  pager: function(pagination: PaginationData | undefined): Handlebars.SafeString {
    if (!pagination || pagination.totalPages <= 1) {
      return new Handlebars.SafeString('');
    }

    const prevLink = pagination.hasPrevPage
      ? `<a href="${pagination.prevPageUrl}" class="link dim br-pill ph3 pv2 ba b--black-10 black">‹ Previous</a>`
      : `<span class="br-pill ph3 pv2 ba b--black-10 moon-gray o-50">‹ Previous</span>`;

    const nextLink = pagination.hasNextPage
      ? `<a href="${pagination.nextPageUrl}" class="link dim br-pill ph3 pv2 ba b--black-10 black">Next ›</a>`
      : `<span class="br-pill ph3 pv2 ba b--black-10 moon-gray o-50">Next ›</span>`;
    
    const pageIndicator = `<div class="f6 mid-gray">Page ${pagination.currentPage} of ${pagination.totalPages}</div>`;

    const pagerHtml = `
      <div class="flex items-center justify-between mt4 pt3 bt b--black-10">
        <div>${prevLink}</div>
        <div>${pageIndicator}</div>
        <div>${nextLink}</div>
      </div>
    `;

    return new Handlebars.SafeString(pagerHtml);
  }
});