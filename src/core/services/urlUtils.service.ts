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
  node: { slug: string, path:string, type: 'page' | 'collection' },
  isExport: boolean,
  pageNumber?: number
): string {
    const isRootIndex = node.slug === 'index' && node.type === 'page' && !node.path.includes('/');

    if (isExport) {
        // --- EXPORT PATHS ---
        const baseName = node.path.replace(/^content\//, '').replace(/\.md$/, '');

        if (pageNumber && pageNumber > 1) {
            // For paginated routes, e.g., /blog/page/2.html
            return `${baseName}/page/${pageNumber}/index.html`;
        }
        if (isRootIndex) return 'index.html';
        if (node.type === 'collection') return `${node.slug}/index.html`;
        
        // For a view page that is the first page of a paginated list
        if (node.path.endsWith('.md')) {
            return `${baseName}/index.html`;
        }
        return `${baseName}.html`;
    }

    // --- LIVE PREVIEW PATH SEGMENTS ---
    if (pageNumber && pageNumber > 1) {
        return `${node.slug}/page/${pageNumber}`;
    }
    if (isRootIndex) return '';
    return node.path.replace(/^content\//, '').replace(/\.md$/, '').replace(/\/index$/, '');
}