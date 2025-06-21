// src/core/state/slices/contentSlice.ts
import { StateCreator } from 'zustand';
import { produce } from 'immer';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { ParsedMarkdownFile, StructureNode, MarkdownFrontmatter } from '@/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import {
  getParentPath,
  findAndRemoveNode,
  updatePathsRecursively,
  findParentOfNode,
  updateNodeInChildren,
} from '@/core/services/fileTree.service';
import { SiteSlice } from '@/core/state/slices/siteSlice';
import { stringifyToMarkdown } from '@/lib/markdownParser';

/**
 * A private helper function to update the paths and slugs of content files
 * in the in-memory state after a move operation.
 * @param files The current array of content files.
 * @param pathsToMove An array of objects mapping old paths to new paths.
 * @returns A new array of content files with updated paths.
 */
const updateContentFilePaths = (files: ParsedMarkdownFile[], pathsToMove: { oldPath: string; newPath:string }[]): ParsedMarkdownFile[] => {
    const pathMap = new Map(pathsToMove.map(p => [p.oldPath, p.newPath]));
    return files.map(file => {
        if (pathMap.has(file.path)) {
            const newPath = pathMap.get(file.path)!;
            const newSlug = newPath.replace(/^content\//, '').replace(/\.md$/, '');
            return { ...file, path: newPath, slug: newSlug };
        }
        return file;
    });
};

/**
 * Defines the state and actions for managing a site's content and structure.
 * This includes creating, updating, deleting, and reordering pages.
 */
export interface ContentSlice {
  /**
   * Creates a new content file or updates an existing one. It persists the file
   * to storage and updates the site manifest's structure tree.
   * @param siteId The ID of the site being modified.
   * @param filePath The full path for the content file (e.g., 'content/about.md').
   * @param rawMarkdownContent The full content of the file, including frontmatter.
   * @returns A promise that resolves to true on success.
   */
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;

  /**
   * Deletes a content file from storage, removes it from the manifest structure,
   * and updates all relevant state. If the deleted file was the homepage, it
   * intelligently assigns a new homepage.
   * @param siteId The ID of the site being modified.
   * @param filePath The path of the content file to delete.
   */
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;

  /**
   * Moves a node (and all its children) to a new parent in the structure tree.
   * This handles file path/slug updates and physical file moves in storage.
   * @param siteId The ID of the site being modified.
   * @param draggedNodePath The path of the node being moved.
   * @param targetNodePath The path of the new parent node, or null to move to the root.
   */
  moveNode: (siteId: string, draggedNodePath: string, targetNodePath: string | null) => Promise<void>;

  /**
   * A lightweight action to save changes to a file's content or frontmatter
   * without altering the site's structure tree.
   * @param siteId The ID of the site being modified.
   * @param savedFile The complete `ParsedMarkdownFile` object to save.
   */
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => Promise<void>;

  /**
   * Sets a specific page as the site's homepage. This action ensures that only
   * one page has the `homepage: true` flag by removing the flag from the
   * previous homepage in a single, transactional operation.
   * @param siteId The ID of the site being modified.
   * @param newHomepagePath The path of the file to designate as the new homepage.
   */
  setHomepageAction: (siteId: string, newHomepagePath: string) => Promise<void>;

  /**
   * Reorders a node within its current list of siblings.
   * @param siteId The ID of the site being modified.
   * @param activePath The path of the node being dragged.
   * @param targetPath The path of the node being dropped onto.
   * @param position Indicates whether the drop was above or below the target.
   */
  reorderNodeAction: (siteId: string, activePath: string, targetPath: string, position: 'reorder-before' | 'reorder-after') => Promise<void>;
  
  /**
   * Moves a nested node to the root level of the site structure.
   * @param siteId The ID of the site being modified.
   * @param activePath The path of the node being un-nested.
   */
  unNestNodeAction: (siteId: string, activePath: string) => Promise<void>;
    repositionNode: (siteId: string, activePath: string, overPath: string, intent: 'reorder-before' | 'reorder-after' | 'nest') => Promise<void>;

}

export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get) => ({

  updateContentFileOnly: async (siteId, savedFile) => {
    await localSiteFs.saveContentFile(siteId, savedFile.path, stringifyToMarkdown(savedFile.frontmatter, savedFile.content));
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (siteToUpdate?.contentFiles) {
        const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
        if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
        else siteToUpdate.contentFiles.push(savedFile);
      }
    }));
  },

  

  addOrUpdateContentFile: async (siteId, filePath, rawMarkdownContent) => {
    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    const site = get().getSiteById(siteId);
    if (!site || !site.contentFiles) return false;

    const isNewFile = !site.contentFiles.some(f => f.path === filePath);
    const menuTitle = typeof savedFile.frontmatter.menuTitle === 'string' ? savedFile.frontmatter.menuTitle : undefined;

    const newManifest = produce(site.manifest, draft => {
      let parentFound = false;
      const parentPath = getParentPath(filePath);
      const findAndUpdateNode = (nodes: StructureNode[]): StructureNode[] => nodes.map(node => {
        if (!isNewFile && node.path === filePath) return { ...node, title: savedFile.frontmatter.title, menuTitle: menuTitle };
        const nodeAsDir = node.path.replace(/\.md$/, '');
        if (isNewFile && parentPath === nodeAsDir) {
          parentFound = true;
          return { ...node, children: [...(node.children || []), { type: 'page', title: savedFile.frontmatter.title, menuTitle: menuTitle, path: filePath, slug: savedFile.slug }] };
        }
        if (node.children) return { ...node, children: findAndUpdateNode(node.children) };
        return node;
      });
      draft.structure = findAndUpdateNode(draft.structure);
      if (isNewFile && !parentFound && parentPath === 'content') draft.structure.push({ type: 'page', title: savedFile.frontmatter.title, menuTitle: menuTitle, path: filePath, slug: savedFile.slug, navOrder: draft.structure.length });
    });

    await localSiteFs.saveManifest(siteId, newManifest);

    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (siteToUpdate) {
        siteToUpdate.manifest = newManifest;
        if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];
        const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === filePath);
        if (fileIndex !== -1) siteToUpdate.contentFiles[fileIndex] = savedFile;
        else siteToUpdate.contentFiles.push(savedFile);
      }
    }));
    return true;
  },

  deleteContentFileAndState: async (siteId, filePath) => {
    const site = get().getSiteById(siteId);
    if (!site) return;
    const fileToDelete = site.contentFiles?.find(f => f.path === filePath);
    const wasHomepage = fileToDelete?.frontmatter.homepage === true;

    const newManifest = produce(site.manifest, draft => {
      const filterStructure = (nodes: StructureNode[]): StructureNode[] => nodes.filter(node => node.path !== filePath).map(node => {
        if (node.children) node.children = filterStructure(node.children);
        return node;
      });
      draft.structure = filterStructure(draft.structure);
    });

    await Promise.all([localSiteFs.deleteContentFile(siteId, filePath), get().updateManifest(siteId, newManifest)]);
    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (siteToUpdate?.contentFiles) siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
    }));

    if (wasHomepage) {
      const updatedSite = get().getSiteById(siteId);
      const fallbackHomepageNode = updatedSite?.manifest.structure.find(node => node.type === 'page');
      if (fallbackHomepageNode) {
        toast.warning(`Homepage deleted. Setting "${fallbackHomepageNode.title}" as the new homepage.`);
        await get().setHomepageAction(siteId, fallbackHomepageNode.path);
      } else {
        toast.error("Homepage deleted, and no other pages were available to take its place.");
      }
    }
  },


  moveNode: async (siteId, draggedNodePath, targetNodePath) => {
    const site = get().getSiteById(siteId);
    if (!site?.contentFiles) {
      toast.error("Site data not found.");
      return;
    }

    // --- 1. PREPARE STATE CHANGES IN MEMORY ---
    const { found: draggedNode, tree: treeWithoutDraggedNode } = findAndRemoveNode([...site.manifest.structure], draggedNodePath);
    if (!draggedNode) {
      toast.error("An error occurred while moving the page.");
      return;
    }

    const newParentPath = targetNodePath ? targetNodePath.replace(/\.md$/, '') : 'content';
    const updatedNode = updatePathsRecursively(draggedNode, newParentPath);

    const pathsToMove: { oldPath: string; newPath: string }[] = [];
    const collectPaths = (newNode: StructureNode, oldNode: StructureNode) => {
      if (newNode.path !== oldNode.path) {
        pathsToMove.push({ oldPath: oldNode.path, newPath: newNode.path });
      }
      if (newNode.children && oldNode.children) {
        newNode.children.forEach((child, i) => collectPaths(child, oldNode.children![i]));
      }
    };
    collectPaths(updatedNode, draggedNode);

    let finalTree: StructureNode[];
    if (targetNodePath) {
      const insertIntoTree = (nodes: StructureNode[]): StructureNode[] => nodes.map(node => {
        if (node.path === targetNodePath) {
          return { ...node, children: [...(node.children || []), updatedNode] };
        }
        if (node.children) {
          return { ...node, children: insertIntoTree(node.children) };
        }
        return node;
      });
      finalTree = insertIntoTree(treeWithoutDraggedNode);
    } else {
      finalTree = [...treeWithoutDraggedNode, updatedNode];
    }

    // --- 2. PERSIST TO FILE SYSTEM ---
    if (pathsToMove.length > 0) {
      await localSiteFs.moveContentFiles(siteId, pathsToMove);
    }

    // --- 3. UPDATE ZUSTAND STORE TRANSACTIONALLY ---
    const newManifest = { ...site.manifest, structure: finalTree };
    const updatedContentFiles = updateContentFilePaths(site.contentFiles, pathsToMove);

    set(
      produce((draft: any) => {
        const siteToUpdate = draft.sites.find((s: any) => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = newManifest;
          siteToUpdate.contentFiles = updatedContentFiles;
        }
      })
    );
    
    // Persist the new manifest
    await localSiteFs.saveManifest(siteId, newManifest);

    toast.success(`Moved "${updatedNode.title}" successfully.`);
  },

  setHomepageAction: async (siteId, newHomepagePath) => {
    const site = get().getSiteById(siteId);
    if (!site?.contentFiles) throw new Error("Site content not loaded.");

    const targetFile = site.contentFiles.find(f => f.path === newHomepagePath);
    if (targetFile?.frontmatter.homepage === true) { toast.info("This page is already the designated homepage."); return; }

    const updates: { path: string; frontmatter: MarkdownFrontmatter }[] = [];
    let newHomepageTitle = 'the selected page';

    site.contentFiles.forEach(file => {
      if (file.path === newHomepagePath) {
        newHomepageTitle = file.frontmatter.title;
        updates.push({ path: file.path, frontmatter: { ...file.frontmatter, homepage: true } });
      } else if (file.frontmatter.homepage === true) {
        const { homepage, ...rest } = file.frontmatter;
        updates.push({ path: file.path, frontmatter: rest });
      }
    });

    if (updates.length === 0 && targetFile) {
        newHomepageTitle = targetFile.frontmatter.title;
        updates.push({ path: targetFile.path, frontmatter: { ...targetFile.frontmatter, homepage: true } });
    } else if (updates.length === 0) {
        throw new Error("Target homepage file not found.");
    }
    
    await Promise.all(updates.map(update => {
      const originalFile = site.contentFiles!.find(f => f.path === update.path)!;
      return localSiteFs.saveContentFile(siteId, update.path, stringifyToMarkdown(update.frontmatter, originalFile.content));
    }));

    set(produce((draft: SiteSlice) => {
      const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
      if (siteToUpdate?.contentFiles) updates.forEach(update => {
        const fileInState = siteToUpdate.contentFiles!.find(f => f.path === update.path);
        if (fileInState) fileInState.frontmatter = update.frontmatter;
      });
    }));

    toast.success(`Homepage has been set to "${newHomepageTitle}".`);
  },

  reorderNodeAction: async (siteId, activePath, targetPath, position) => {
        const site = get().getSiteById(siteId);
        if (!site) return;

        const parent = findParentOfNode(site.manifest.structure, activePath);
        const list = parent ? parent.children : site.manifest.structure;

        if (!list) return;

        const oldIndex = list.findIndex((n: StructureNode) => n.path === activePath);
        let newIndex = list.findIndex((n: StructureNode) => n.path === targetPath);
        if (oldIndex === -1 || newIndex === -1) return;
        
        if (position === 'reorder-after' && oldIndex < newIndex) { /* No adjustment */ } 
        else if (position === 'reorder-before' && oldIndex > newIndex) { /* No adjustment */ } 
        else if (position === 'reorder-after') { newIndex += 1; }

        const reorderedList: StructureNode[] = arrayMove(list, oldIndex, newIndex);

        let newStructure: StructureNode[];
        if (parent) {
            newStructure = updateNodeInChildren(site.manifest.structure, parent.path, reorderedList);
        } else {
            newStructure = reorderedList;
        }
        
        await get().updateManifest(siteId, { ...site.manifest, structure: newStructure });
        toast.success("Page order updated.");
    },

    unNestNodeAction: async (siteId, activePath) => {
        return get().moveNode(siteId, activePath, null);
    },
repositionNode: async (
    siteId: string,
    activePath: string,
    overPath: string,
    intent: 'reorder-before' | 'reorder-after' | 'nest'
  ) => {
    const site = get().getSiteById(siteId);
    if (!site || !site.contentFiles) {
        toast.error("Site data not loaded. Cannot move page.");
        return;
    }

    // --- 1. VALIDATE THE MOVE ---
    const homepagePath = site.manifest.structure[0]?.path;
    if (activePath === homepagePath) {
      toast.error("The homepage cannot be moved.");
      return;
    }
    if (intent === 'reorder-before' && overPath === homepagePath) {
      toast.error("Pages cannot be moved above the homepage.");
      return;
    }
    if (intent === 'nest') {
      const targetFile = site.contentFiles.find(f => f.path === overPath);
      if (targetFile?.frontmatter.collection) {
        toast.error("Cannot nest pages under a Collection Page.");
        return;
      }
    }

    // --- 2. PREPARE THE NEW STRUCTURE (in memory) ---
    const { found: activeNode, tree: treeWithoutActive } = findAndRemoveNode([...site.manifest.structure], activePath);
    if (!activeNode) return;

    let finalTree = treeWithoutActive;

    if (intent === 'nest') {
        const insert = (nodes: StructureNode[]): boolean => {
            for (const node of nodes) {
                if (node.path === overPath) {
                    node.children = [...(node.children || []), activeNode];
                    return true;
                }
                if (node.children && insert(node.children)) return true;
            }
            return false;
        };
        insert(finalTree);
    } else { // Handle reordering (which also covers un-nesting)
        const parentOfOver = findParentOfNode(finalTree, overPath);
        const targetList = parentOfOver ? parentOfOver.children! : finalTree;
        const overIndex = targetList.findIndex(n => n.path === overPath);
        const newIndex = intent === 'reorder-after' ? overIndex + 1 : overIndex;
        targetList.splice(newIndex, 0, activeNode);
        
        if (parentOfOver) {
            finalTree = updateNodeInChildren(finalTree, parentOfOver.path, targetList);
        } else {
            finalTree = targetList;
        }
    }

    // --- 3. CALCULATE REQUIRED FILE PATH CHANGES ---
    const parentOfActiveFinal = findParentOfNode(finalTree, activePath);
    const newParentDir = parentOfActiveFinal ? parentOfActiveFinal.path.replace(/\.md$/, '') : 'content';
    const finalActiveNode = updatePathsRecursively(activeNode, newParentDir);
    
    const pathsToMove: { oldPath: string; newPath: string }[] = [];
    const collectPaths = (newNode: StructureNode, oldNode: StructureNode) => {
        if (newNode.path !== oldNode.path) pathsToMove.push({ oldPath: oldNode.path, newPath: newNode.path });
        if (newNode.children && oldNode.children) newNode.children.forEach((child, i) => collectPaths(child, oldNode.children![i]));
    };
    collectPaths(finalActiveNode, activeNode);

    // --- 4. EXECUTE THE FULLY TRANSACTIONAL UPDATE ---
    try {
        // Step 4a: Persist physical file moves first
        if (pathsToMove.length > 0) {
            await localSiteFs.moveContentFiles(siteId, pathsToMove);
        }

        // Step 4b: Prepare new state for Zustand
        const newManifest = { ...site.manifest, structure: finalTree };
        const updatedContentFiles = updateContentFilePaths(site.contentFiles, pathsToMove);
        
        // Step 4c: Update Zustand store atomically
        set(produce((draft: any) => {
            const siteToUpdate = draft.sites.find((s: any) => s.siteId === siteId);
            if (siteToUpdate) {
                siteToUpdate.manifest = newManifest;
                siteToUpdate.contentFiles = updatedContentFiles;
            }
        }));

        // Step 4d: Persist the new manifest structure
        await localSiteFs.saveManifest(siteId, newManifest);
        toast.success("Site structure updated successfully.");
    } catch (error) {
        console.error("Failed to reposition node:", error);
        toast.error("An error occurred while updating the site structure.");
        // If anything fails, reload state from storage to prevent UI inconsistencies
        get().loadSite(siteId);
    }
  },
});