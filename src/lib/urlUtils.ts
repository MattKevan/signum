// src/lib/urlUtils.ts

/**
 * Generates a relative URL for a given site node, correctly handling
 * the 'index.html' case and adding the .html extension for static exports.
 * 
 * @param node - An object representing a node in the site structure.
 * @param isExport - A boolean indicating if the URL is for a static export.
 * @returns A string representing the relative URL.
 */
export function getUrlForNode(
  node: { slug: string, path: string, type: 'page' | 'collection' },
  isExport: boolean
): string {
    const isRootIndex = node.slug === 'index' && node.type === 'page' && !node.path.includes('/');

    if (isExport) {
        if (isRootIndex) return 'index.html';
        if (node.type === 'collection') return `${node.slug}/index.html`;
        return `${node.path.replace(/^content\//, '').replace(/\.md$/, '')}.html`;
    }

    // URLs for live preview (no .html extension)
    if (isRootIndex) return '/';
    return `/${node.path.replace(/^content\//, '').replace(/\.md$/, '')}`.replace(/\/index$/, '');
}