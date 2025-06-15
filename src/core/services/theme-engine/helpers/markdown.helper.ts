// src/lib/theme-helpers/markdown.helper.ts
import { SignumHelper } from './types';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const markdownHelper: SignumHelper = () => ({
  /**
   * Safely renders a string of Markdown into HTML.
   * @example {{{markdown some.body_content}}}
   */
  markdown: function(markdownString: string): Handlebars.SafeString {
    if (!markdownString) return new Handlebars.SafeString('');

    // Use marked to parse, then DOMPurify to sanitize against XSS attacks.
    const unsafeHtml = marked.parse(markdownString, { async: false }) as string;
    const safeHtml = DOMPurify.sanitize(unsafeHtml);

    return new Handlebars.SafeString(safeHtml);
  }
});