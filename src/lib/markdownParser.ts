// src/lib/markdownParser.ts
import matter, { GrayMatterOption, Input } from 'gray-matter'; // Import GrayMatterOption and Input
import { marked } from 'marked'; // For optional direct HTML rendering, though mostly client-side
import { MarkdownFrontmatter, ParsedMarkdownFile } from '@/types';
import yaml from 'js-yaml'; // For more robust YAML stringification

/**
 * Parses a raw markdown string (which includes YAML frontmatter) into an object
 * containing the frontmatter (as an object) and the markdown body content.
 *
 * @param rawMarkdown The complete markdown string with frontmatter.
 * @returns An object with `frontmatter` and `content` (markdown body).
 * @throws Error if frontmatter parsing fails.
 */
export function parseMarkdownString(rawMarkdown: string): { frontmatter: MarkdownFrontmatter, content: string } {
  try {
    // Ensure gray-matter options are correctly typed if needed, though defaults are often fine
    const { data, content: bodyContent } = matter(rawMarkdown as Input); // Cast to Input if type issues
    
    // Ensure title is always a string, provide default if missing or not string
    const title = typeof data.title === 'string' ? data.title : 'Untitled';

    return { 
      frontmatter: { ...data, title } as MarkdownFrontmatter, // Ensure title is part of the typed frontmatter
      content: bodyContent.trim() 
    };
  } catch (e) {
    console.error("Error parsing markdown string with gray-matter:", e);
    // Provide a more specific error message to the user
    throw new Error("Invalid YAML frontmatter format. Please check for syntax errors (e.g., unclosed quotes, incorrect indentation).");
  }
}

/**
 * Converts a frontmatter object and a markdown body content string back into
 * a single string formatted as YAML frontmatter followed by the markdown content.
 * Uses js-yaml for robust YAML serialization.
 *
 * @param frontmatter The frontmatter object.
 * @param content The markdown body content.
 * @returns A string combining serialized YAML frontmatter and markdown content.
 */
export function stringifyToMarkdown(frontmatter: MarkdownFrontmatter, content: string): string {
  try {
    // Filter out undefined or null values from frontmatter before stringifying
    const cleanedFrontmatter: Partial<MarkdownFrontmatter> = {};
    for (const key in frontmatter) {
      if (Object.prototype.hasOwnProperty.call(frontmatter, key) && frontmatter[key] !== undefined && frontmatter[key] !== null) {
        cleanedFrontmatter[key] = frontmatter[key];
      }
    }

    const fmString = Object.keys(cleanedFrontmatter).length > 0 
      ? yaml.dump(cleanedFrontmatter, { skipInvalid: true, indent: 2 }) // Use js-yaml for proper YAML formatting
      : ''; // No frontmatter if object is empty

    if (fmString) {
        return `---\n${fmString}---\n\n${content}`;
    }
    return content; // Return only content if no frontmatter

  } catch (e) {
    console.error("Error stringifying frontmatter to YAML:", e);
    // Fallback to simpler stringification or re-throw
    // For now, let's try a very basic fallback if yaml.dump fails for some reason
    let fallbackFmString = '';
    for (const key in frontmatter) {
        if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
            fallbackFmString += `${key}: ${String(frontmatter[key])}\n`;
        }
    }
    if (fallbackFmString) {
        return `---\n${fallbackFmString}---\n\n${content}`;
    }
    return content;
  }
}

/**
 * Parses a raw markdown string and also renders its body content to HTML using 'marked'.
 * This is primarily a utility if pre-rendered HTML is needed somewhere, but Signum focuses
 * on client-side rendering of raw markdown.
 *
 * @param slug The slug for the parsed file.
 * @param path The file path for the parsed file.
 * @param rawMarkdownContent The complete markdown string with frontmatter.
 * @returns A ParsedMarkdownFile object, potentially including htmlContent.
 */
export function parseAndRenderMarkdown(slug: string, path: string, rawMarkdownContent: string): ParsedMarkdownFile {
  const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
  
  // marked.parse can be configured with options if needed
  // const htmlContent = marked.parse(content) as string;

  return {
    slug,
    path,
    frontmatter,
    content,
    // htmlContent, // Uncomment if you decide to pre-render HTML
  };
}