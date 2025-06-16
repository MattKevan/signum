// src/core/state/slices/contentSlice.ts
import { StateCreator } from 'zustand';
import { produce } from 'immer';
import { ParsedMarkdownFile, StructureNode } from '@/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { getParentPath, findNodeByPath, findAndRemoveNode, updatePathsRecursively } from '@/core/services/fileTree.service';
import { toast } from 'sonner';
import { SiteSlice } from '@/core/state/slices/siteSlice';
import { stringifyToMarkdown } from '@/lib/markdownParser';

export interface ContentSlice {
  /**
   * Creates a new content file or updates an existing one, and updates the manifest structure.
   * This function recursively finds the correct parent node to ensure items are nested correctly.
   * @param siteId - The ID of the site.
   * @param filePath - The full path of the file to save (e.g., 'content/about.md').
   * @param rawMarkdownContent - The full string content of the file, including frontmatter.
   * @param layoutId - The ID of the layout to assign to this page.
   * @returns {Promise<boolean>} True if the operation was successful.
   */
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string, layoutId: string) => Promise<boolean>;

  /**
   * Deletes a content file from storage and removes its corresponding node from the manifest structure.
   * @param {string} siteId - The ID of the site.
   * @param {string} filePath - The full path of the file to delete.
   * @returns {Promise<void>}
   */
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  
  /**
   * Moves a page node (and all its children) to a new parent in the site structure.
   * This is a complex transactional operation that updates file paths, manifest structure,
   * and the file system in IndexedDB.
   * @param {string} siteId - The ID of the site.
   * @param {string} draggedNodePath - The path of the page being moved.
   * @param {string | null} targetNodePath - The path of the target page to nest under, or null to un-nest to the root.
   * @returns {Promise<void>}
   */
  moveNode: (siteId: string, draggedNodePath: string, targetNodePath: string | null) => Promise<void>;

  /**
   * Updates only the content of a file in storage and state.
   * Does not modify the manifest. Used for fast autosaving.
   * @param siteId - The ID of the site.
   * @param savedFile - The parsed markdown file object to save.
   * @returns {Promise<void>}
   */
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => Promise<void>;
}

export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get) => ({

    updateContentFileOnly: async (siteId, savedFile) => {
    // This action ONLY updates the file content in storage and in the store.
    // It does NOT touch the manifest, making it fast for autosave.
    await localSiteFs.saveContentFile(siteId, savedFile.path, stringifyToMarkdown(savedFile.frontmatter, savedFile.content));
    
    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate?.contentFiles) {
            const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
            if (fileIndex !== -1) {
                siteToUpdate.contentFiles[fileIndex] = savedFile;
            } else {
                siteToUpdate.contentFiles.push(savedFile);
            }
        }
    }));
  },

  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent, layoutId) => {
    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    const site = get().getSiteById(siteId);
    if (!site || !site.contentFiles) return false;

    const isNewFile = !site.contentFiles.some(f => f.path === filePath);

    const newManifest = produce(site.manifest, draft => {
        let parentFound = false;
        const parentPath = getParentPath(filePath);

        // --- START OF FIX: RECURSIVE PARENT FINDER ---
        /**
         * Recursively traverses the structure to find the correct parent node
         * and adds the new file as a child.
         * @param nodes - The current array of nodes to search through.
         * @returns A new array of nodes with the update applied.
         */
        const findAndUpdateParent = (nodes: StructureNode[]): StructureNode[] => {
            return nodes.map(node => {
                // Check if this node is the parent we're looking for.
                // It can be a page or a collection.
                if (isNewFile && node.path === parentPath) {
                    parentFound = true;
                    // Add the new file as a child to this node.
                    return { 
                        ...node, 
                        children: [
                            ...(node.children || []), 
                            { 
                                type: 'page', 
                                title: savedFile.frontmatter.title, 
                                path: filePath, 
                                slug: savedFile.slug, 
                                layout: layoutId 
                            }
                        ] 
                    };
                }

                // If not the parent, check if it's the file being updated (for a title change).
                if (!isNewFile && node.path === filePath && node.title !== savedFile.frontmatter.title) {
                    return { ...node, title: savedFile.frontmatter.title };
                }

                // If this node has children, recurse into them.
                if (node.children) {
                    return { ...node, children: findAndUpdateParent(node.children) };
                }

                // Otherwise, return the node as is.
                return node;
            });
        };

        draft.structure = findAndUpdateParent(draft.structure);
        // --- END OF FIX ---

        // Handle creating a new top-level page (if parent is root 'content' folder)
        if (isNewFile && !parentFound && parentPath === 'content') {
          draft.structure.push({ type: 'page', title: savedFile.frontmatter.title, path: filePath, slug: savedFile.slug, layout: layoutId, navOrder: draft.structure.length });
        }
    });
    
    // First, commit the manifest change to storage.
    await localSiteFs.saveManifest(siteId, newManifest);

    // Then, update the in-memory state to match.
    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
            siteToUpdate.manifest = newManifest;
            if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];
            const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === filePath);
            if (fileIndex !== -1) {
                siteToUpdate.contentFiles[fileIndex] = savedFile;
            } else {
                siteToUpdate.contentFiles.push(savedFile);
            }
        }
    }));
    return true;
  },

  deleteContentFileAndState: async (siteId, filePath) => {
    const site = get().getSiteById(siteId);
    if (!site) return;

    // Use a recursive filter to remove the node from anywhere in the tree.
    const newManifest = produce(site.manifest, draft => {
        const filterStructure = (nodes: StructureNode[]): StructureNode[] => {
            return nodes
                .filter(node => node.path !== filePath)
                .map(node => {
                    if (node.children) {
                        node.children = filterStructure(node.children);
                    }
                    return node;
                });
        };
        draft.structure = filterStructure(draft.structure);
    });
    
    await Promise.all([
      localSiteFs.deleteContentFile(siteId, filePath),
      get().updateManifest(siteId, newManifest)
    ]);
    
    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate?.contentFiles) {
            siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
        }
    }));
  },

 moveNode: async (siteId, draggedNodePath, targetNodePath) => {
    const site = get().getSiteById(siteId);
    if (!site) {
      toast.error("Site data not found.");
      return;
    }

    const draggedNodeInfo = findNodeByPath(site.manifest.structure, draggedNodePath);
    if (!draggedNodeInfo || draggedNodeInfo.type !== 'page') {
      toast.error("Only pages can be moved.");
      return;
    }

    const targetNodeInfo = targetNodePath ? findNodeByPath(site.manifest.structure, targetNodePath) : null;
    if (targetNodePath && (!targetNodeInfo || (targetNodeInfo.type !== 'page' && targetNodeInfo.type !== 'collection'))) {
      toast.error("Pages can only be nested under other pages or collections.");
      return;
    }

    // 1. Remove the dragged node from the tree.
    const { found: draggedNode, tree: treeWithoutDraggedNode } = findAndRemoveNode([...site.manifest.structure], draggedNodePath);
    if (!draggedNode) {
      toast.error("An error occurred while moving the page.");
      return;
    }

    // 2. Recursively update paths for the dragged node and its children.
    const newParentPath = targetNodePath ? targetNodePath : 'content';
    const updatedNode = updatePathsRecursively(draggedNode, newParentPath);

    // 3. Collect all old and new paths for the file system move.
    const pathsToMove: { oldPath: string, newPath: string }[] = [];
    const collectPaths = (newNode: StructureNode, oldNode: StructureNode) => {
        pathsToMove.push({ oldPath: oldNode.path, newPath: newNode.path });
        if (newNode.children && oldNode.children) {
            newNode.children.forEach((child, i) => collectPaths(child, oldNode.children![i]));
        }
    };
    collectPaths(updatedNode, draggedNode);
    
    // 4. Perform the file move operations in IndexedDB.
    await localSiteFs.moveContentFiles(siteId, pathsToMove);
    
    // 5. Insert the updated node into its new position in the manifest structure.
    let finalTree: StructureNode[];
    if (targetNodePath) { // Nesting
        const insertIntoTree = (nodes: StructureNode[]): StructureNode[] => nodes.map(node => {
            if (node.path === targetNodePath) return { ...node, children: [...(node.children || []), updatedNode] };
            if (node.children) return { ...node, children: insertIntoTree(node.children) };
            return node;
        });
        finalTree = insertIntoTree(treeWithoutDraggedNode);
    } else { // Un-nesting to root
        finalTree = [...treeWithoutDraggedNode, updatedNode];
    }

    // 6. Commit the new manifest.
    const newManifest = { ...site.manifest, structure: finalTree };
    await get().updateManifest(siteId, newManifest);

    // 7. Trigger a full reload of the site's data to ensure UI consistency.
    await get().loadSite(siteId);
    toast.success(`Moved "${updatedNode.title}" successfully.`);
  },
});