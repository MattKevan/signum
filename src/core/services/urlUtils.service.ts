// src/core/services/urlUtils.service.ts

/**
 * Generates a URL for a given site node, correctly handling index cases,
 * static export paths, and pagination routes.
 *
 * @param node - An object representing a node in the site structure.
 * @param isExport - A boolean indicating if the URL is for a static export.
 * @param pageNumber - Optional page number for generating paginated links.
 * @returns A string representing the URL segment or full filename.
 */
export function getUrlForNode(
  node: { slug: string; path: string },
  isExport: boolean,
  pageNumber?: number,
): string {
  // --- THIS IS THE KEY CHECK ---
  // A page is the true root index if its path is exactly 'content/index.md'.
  const isRootIndex = node.path === 'content/index.md';

  if (isExport) {
    // --- EXPORT PATHS ---

    // Handle the root index as a special case for export. It's the only file in the root.
    if (isRootIndex) {
      return 'index.html';
    }

    // For all other pages, use the full slug which represents the directory structure.
    const baseName = node.slug;

    if (pageNumber && pageNumber > 1) {
      // For paginated routes, e.g., /blog/page/2/index.html
      return `${baseName}/page/${pageNumber}/index.html`;
    }

    // All other pages go into a directory with an index.html file for clean URLs.
    // e.g., 'about-us' becomes '/about-us/index.html'
    // e.g., 'blog/my-post' becomes '/blog/my-post/index.html'
    return `${baseName}/index.html`;
  }

  // --- LIVE PREVIEW PATH SEGMENTS ---
  if (pageNumber && pageNumber > 1) {
    return `${node.slug}/page/${pageNumber}`;
  }

  // For the live preview, the root URL is just '/' (empty string)
  if (isRootIndex) {
    return '';
  }

  // For all other pages, the URL segment is simply its full slug.
  return node.slug;
}