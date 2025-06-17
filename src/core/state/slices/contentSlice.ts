// src/core/state/slices/contentSlice.ts
import { StateCreator } from 'zustand';
import { produce } from 'immer';
import { ParsedMarkdownFile, StructureNode } from '@/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { getParentPath, findNodeByPath, findAndRemoveNode, updatePathsRecursively } from '@/core/services/fileTree.service';
import { toast } from 'sonner';
import { SiteSlice } from '@/core/state/slices/siteSlice';
import { stringifyToMarkdown } from '@/lib/markdownParser';

// The ContentSlice now only focuses on page/file operations.
export interface ContentSlice {
  /**
   * Creates a new content file or updates an existing one, and updates the manifest structure.
   * @param siteId - The ID of the site.
   * @param filePath - The full path of the file to save (e.g., 'content/about.md').
   * @param rawMarkdownContent - The full string content of the file, including frontmatter.
   * @returns {Promise<boolean>} True if the operation was successful.
   */
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;

  /**
   * Deletes a content file from storage and its node from the manifest structure.
   * @param {string} siteId - The ID of the site.
   * @param {string} filePath - The full path of the file to delete.
   * @returns {Promise<void>}
   */
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;

  /**
   * Moves a page node (and all its children) to a new parent in the site structure.
   * @param {string} siteId - The ID of the site.
   * @param {string} draggedNodePath - The path of the page being moved.
   * @param {string | null} targetNodePath - The path of the target page to nest under, or null to un-nest to the root.
   * @returns {Promise<void>}
   */
  moveNode: (siteId: string, draggedNodePath: string, targetNodePath: string | null) => Promise<void>;

  /**
   * Updates only the content of a file in storage and state. Used for fast autosaving.
   * @param siteId - The ID of the site.
   * @param savedFile - The parsed markdown file object to save.
   * @returns {Promise<void>}
   */
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => Promise<void>;
}

export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get) => ({

    updateContentFileOnly: async (siteId, savedFile) => {
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

  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent) => {
    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    const site = get().getSiteById(siteId);
    if (!site || !site.contentFiles) return false;

    const isNewFile = !site.contentFiles.some(f => f.path === filePath);

    const newManifest = produce(site.manifest, draft => {
        let parentFound = false;
        const parentPath = getParentPath(filePath);

        const findAndUpdateParent = (nodes: StructureNode[]): StructureNode[] => {
            return nodes.map(node => {
                // Nest the new page under its parent.
                if (isNewFile && node.path === parentPath) {
                    parentFound = true;
                    return {
                        ...node,
                        children: [
                            ...(node.children || []),
                            {
                                type: 'page', // Always 'page' now
                                title: savedFile.frontmatter.title,
                                path: filePath,
                                slug: savedFile.slug,
                            }
                        ]
                    };
                }

                // If updating an existing file, just update its title if it changed.
                if (!isNewFile && node.path === filePath && node.title !== savedFile.frontmatter.title) {
                    return { ...node, title: savedFile.frontmatter.title };
                }

                if (node.children) {
                    return { ...node, children: findAndUpdateParent(node.children) };
                }
                return node;
            });
        };

        draft.structure = findAndUpdateParent(draft.structure);

        // Handle creating a new top-level page.
        if (isNewFile && !parentFound && parentPath === 'content') {
          draft.structure.push({
              type: 'page', // Always 'page' now
              title: savedFile.frontmatter.title,
              path: filePath,
              slug: savedFile.slug,
              navOrder: draft.structure.length
          });
        }
    });

    await localSiteFs.saveManifest(siteId, newManifest);

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

    // The logic is simpler now, as we only move pages.
    const draggedNodeInfo = findNodeByPath(site.manifest.structure, draggedNodePath);
    if (!draggedNodeInfo) {
      toast.error("The page to move could not be found.");
      return;
    }

    const targetNodeInfo = targetNodePath ? findNodeByPath(site.manifest.structure, targetNodePath) : null;
    if (targetNodePath && !targetNodeInfo) {
      toast.error("The target destination could not be found.");
      return;
    }

    // Un-nesting is a move to the root, which is always valid.
    // Nesting is a move to another page, which is always valid.
    // No more complex checks for 'collection' type are needed.

    const { found: draggedNode, tree: treeWithoutDraggedNode } = findAndRemoveNode([...site.manifest.structure], draggedNodePath);
    if (!draggedNode) {
      toast.error("An error occurred while moving the page.");
      return;
    }

    // The parent path is now simply the target's path or 'content' for the root.
    const newParentPath = targetNodePath ? targetNodePath.replace(/\.md$/, '') : 'content';
    const updatedNode = updatePathsRecursively(draggedNode, newParentPath);

    const pathsToMove: { oldPath: string, newPath: string }[] = [];
    const collectPaths = (newNode: StructureNode, oldNode: StructureNode) => {
        pathsToMove.push({ oldPath: oldNode.path, newPath: newNode.path });
        if (newNode.children && oldNode.children) {
            newNode.children.forEach((child, i) => collectPaths(child, oldNode.children![i]));
        }
    };
    collectPaths(updatedNode, draggedNode);

    await localSiteFs.moveContentFiles(siteId, pathsToMove);

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

    const newManifest = { ...site.manifest, structure: finalTree };
    await get().updateManifest(siteId, newManifest);

    await get().loadSite(siteId);
    toast.success(`Moved "${updatedNode.title}" successfully.`);
  },
});