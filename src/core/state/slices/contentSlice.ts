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
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  moveNode: (siteId: string, draggedNodePath: string, targetNodePath: string | null) => Promise<void>;
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

    // --- FIX: Safely extract menuTitle with a type check ---
    const menuTitle = typeof savedFile.frontmatter.menuTitle === 'string'
      ? savedFile.frontmatter.menuTitle
      : undefined;

    const newManifest = produce(site.manifest, draft => {
        let parentFound = false;
        const parentPath = getParentPath(filePath);

        const findAndUpdateNode = (nodes: StructureNode[]): StructureNode[] => {
            return nodes.map(node => {
                if (!isNewFile && node.path === filePath) {
                    return { 
                        ...node, 
                        title: savedFile.frontmatter.title,
                        menuTitle: menuTitle, // Use the safe, typed variable
                    };
                }

                const nodeAsDir = node.path.replace(/\.md$/, '');
                if (isNewFile && parentPath === nodeAsDir) {
                    parentFound = true;
                    return {
                        ...node,
                        children: [
                            ...(node.children || []),
                            {
                                type: 'page',
                                title: savedFile.frontmatter.title,
                                menuTitle: menuTitle, // Use the safe, typed variable
                                path: filePath,
                                slug: savedFile.slug,
                            }
                        ]
                    };
                }
                
                if (node.children) {
                    return { ...node, children: findAndUpdateNode(node.children) };
                }
                return node;
            });
        };

        draft.structure = findAndUpdateNode(draft.structure);

        if (isNewFile && !parentFound && parentPath === 'content') {
          draft.structure.push({
              type: 'page',
              title: savedFile.frontmatter.title,
              menuTitle: menuTitle, // Use the safe, typed variable
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

    const { found: draggedNode, tree: treeWithoutDraggedNode } = findAndRemoveNode([...site.manifest.structure], draggedNodePath);
    if (!draggedNode) {
      toast.error("An error occurred while moving the page.");
      return;
    }

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
    if (targetNodePath) {
        const insertIntoTree = (nodes: StructureNode[]): StructureNode[] => nodes.map(node => {
            if (node.path === targetNodePath) return { ...node, children: [...(node.children || []), updatedNode] };
            if (node.children) return { ...node, children: insertIntoTree(node.children) };
            return node;
        });
        finalTree = insertIntoTree(treeWithoutDraggedNode);
    } else {
        finalTree = [...treeWithoutDraggedNode, updatedNode];
    }

    const newManifest = { ...site.manifest, structure: finalTree };
    await get().updateManifest(siteId, newManifest);

    await get().loadSite(siteId);
    toast.success(`Moved "${updatedNode.title}" successfully.`);
  },
});