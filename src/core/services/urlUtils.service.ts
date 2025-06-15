// src/lib/urlUtils.ts

/**
 * Generates a URL for a given site node, correctly handling the 'index' case
 * and creating paths appropriate for either static export or live preview.
 * 
 * @param node - An object representing a node in the site structure.
 * @param isExport - A boolean indicating if the URL is for a static export.
 * @returns A string representing the URL segment or full filename.
 */
export function getUrlForNode(
  node: { slug: string, path: string, type: 'page' | 'collection' },
  isExport: boolean
): string {
    const isRootIndex = node.slug === 'index' && node.type === 'page' && !node.path.includes('/');

    if (isExport) {
        // --- EXPORT PATHS ---
        if (isRootIndex) return 'index.html';
        if (node.type === 'collection') return `${node.slug}/index.html`;
        // Generates "about.html" or "posts/my-post.html"
        return `${node.path.replace(/^content\//, '').replace(/\.md$/, '')}.html`;
    }

    // --- LIVE PREVIEW PATH SEGMENTS ---
    if (isRootIndex) return ''; // The root path segment is empty
    // Generates "about" or "posts/my-post", without leading slash
    return node.path.replace(/^content\//, '').replace(/\.md$/, '').replace(/\/index$/, '');
}