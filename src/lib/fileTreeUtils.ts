// src/lib/fileTreeUtils.ts
import { ParsedMarkdownFile, SiteConfigFile, NavItem } from '@/types';

export interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'collection';
  path: string; // The content-relative path (e.g., 'about/team' or 'posts')
  children?: TreeNode[];
  fileData?: ParsedMarkdownFile;
}

/**
 * Recursively builds a UI tree node from a navigation item config.
 * @param item The NavItem from the site config.
 * @param allItems A flat list of all NavItems to resolve children.
 * @param config The full site config, for looking up collection labels.
 * @param files The full list of site files, for looking up page titles.
 * @returns A single TreeNode with its children, if any.
 */
const buildNode = (item: NavItem, allItems: NavItem[], config: SiteConfigFile, files: ParsedMarkdownFile[]): TreeNode => {
  let node: TreeNode;
  if (item.type === 'collection' || item.type === 'folder') {
    const collectionConfig = config.collections?.find(c => c.path === item.path);
    const fullPath = `content/${item.path}`;
    
    // Find children by checking which items have this item's path as their direct parent
    const childrenItems = allItems.filter(child => 
        child.path.startsWith(`${item.path}/`) && 
        child.path.split('/').length === item.path.split('/').length + 1
    );
    childrenItems.sort((a, b) => a.order - b.order);

    node = {
      id: fullPath,
      name: collectionConfig?.nav_label || item.path.split('/').pop() || item.path,
      type: item.type,
      path: fullPath,
      children: childrenItems.map(child => buildNode(child, allItems, config, files)),
    };
  } else { // type === 'page'
    const fullPath = `content/${item.path}.md`;
    const file = files.find(f => f.path === fullPath);
    node = {
      id: fullPath,
      name: file?.frontmatter.title || item.path.split('/').pop() || item.path,
      type: 'file',
      path: fullPath,
      fileData: file,
      children: [], // Files cannot have children
    };
  }
  return node;
};


/**
 * Builds a fully hierarchical tree of nodes based on the declarative `nav_items` array.
 * @param config The site's configuration file.
 * @param files An array of all parsed markdown files.
 * @returns An array of top-level TreeNode objects.
 */
export function buildFileTree(config: SiteConfigFile, files: ParsedMarkdownFile[]): TreeNode[] {
  const navItems = config.nav_items || [];
  
  // Filter for top-level items only (path does not contain a '/')
  const topLevelItems = navItems.filter(item => !item.path.includes('/'));
  topLevelItems.sort((a, b) => a.order - b.order);
  
  // Recursively build the tree starting from the top-level items
  return topLevelItems.map(item => buildNode(item, navItems, config, files));
}