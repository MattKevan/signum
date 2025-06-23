// src/core/state/slices/contentSlice.ts
import { StateCreator } from 'zustand';
import { produce } from 'immer';
import { toast } from 'sonner';
import { ParsedMarkdownFile, StructureNode } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import {
  findAndRemoveNode,
  updatePathsRecursively,
  findNodeByPath,
  getNodeDepth,
} from '@/core/services/fileTree.service';
import { SiteSlice } from '@/core/state/slices/siteSlice';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';

// Helper function remains the same.
const updateContentFilePaths = (files: ParsedMarkdownFile[], pathsToMove: { oldPath: string; newPath:string }[]): ParsedMarkdownFile[] => {
    const pathMap = new Map(pathsToMove.map(p => [p.oldPath, p.newPath]));
    return files.map(file => {
        if (pathMap.has(file.path)) {
            const newPath = pathMap.get(file.path)!;
            const newSlug = newPath.split('/').pop()?.replace('.md', '') ?? '';
            return { ...file, path: newPath, slug: newSlug };
        }
        return file;
    });
};

export interface ContentSlice {
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<boolean>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  repositionNode: (siteId: string, activeNodePath: string, newParentPath: string | null, newIndex: number) => Promise<void>;
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => Promise<void>;
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
    const site = get().getSiteById(siteId);
    if (!site) return false;

    const isFirstFile = site.manifest.structure.length === 0 && !site.contentFiles?.some(f => f.path === filePath);
    let { frontmatter } = parseMarkdownString(rawMarkdownContent);
    const { content } = parseMarkdownString(rawMarkdownContent);

    if (isFirstFile) {
        toast.info("First page created. It has been set as the permanent homepage.");
        frontmatter = { ...frontmatter, homepage: true };
        rawMarkdownContent = stringifyToMarkdown(frontmatter, content);
    }
    
    const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
    const isNewFileInStructure = !findNodeByPath(site.manifest.structure, filePath);

    const newManifest = produce(site.manifest, draft => {
      if (isNewFileInStructure) {
        const newNode: StructureNode = {
          type: 'page',
          title: savedFile.frontmatter.title,
          menuTitle: typeof savedFile.frontmatter.menuTitle === 'string' ? savedFile.frontmatter.menuTitle : undefined,
          path: filePath,
          slug: savedFile.slug,
          navOrder: draft.structure.length,
          children: [],
        };
        draft.structure.push(newNode);
      } else {
        const findAndUpdate = (nodes: StructureNode[]): void => {
          for (const node of nodes) {
            if (node.path === filePath) {
              node.title = savedFile.frontmatter.title;
              node.menuTitle = typeof savedFile.frontmatter.menuTitle === 'string' ? savedFile.frontmatter.menuTitle : undefined;
              return;
            }
            if (node.children) findAndUpdate(node.children);
          }
        };
        findAndUpdate(draft.structure);
      }
    });

    await get().updateManifest(siteId, newManifest);

    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];
          const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === savedFile.path);
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
    if (fileToDelete?.frontmatter.homepage === true) {
      toast.error("Cannot delete the homepage.", { description: "The first page of a site is permanent." });
      return;
    }
    const newManifest = produce(site.manifest, draft => {
      const filterStructure = (nodes: StructureNode[]): StructureNode[] => nodes.filter(node => {
        if (node.path === filePath) return false;
        if (node.children) node.children = filterStructure(node.children);
        return true;
      });
      draft.structure = filterStructure(draft.structure);
    });
    await Promise.all([
      localSiteFs.deleteContentFile(siteId, filePath),
      get().updateManifest(siteId, newManifest),
    ]);
    set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate?.contentFiles) {
          siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
        }
      }));
    toast.success(`Page "${fileToDelete?.frontmatter.title || 'file'}" deleted.`);
  },
    
  repositionNode: async (siteId, activeNodePath, newParentPath, newIndex) => {
    const site = get().getSiteById(siteId);
    if (!site?.contentFiles || !site.manifest) {
      toast.error("Site data not ready. Cannot move page.");
      return;
    }

    const structure = site.manifest.structure;
    const homepagePath = structure[0]?.path;

    if (activeNodePath === homepagePath) {
      toast.error("The homepage cannot be moved.");
      return;
    }

    const nodeToMove = findNodeByPath(structure, activeNodePath);
    if (newParentPath && nodeToMove?.children && nodeToMove.children.length > 0) {
      toast.error("Cannot nest a page that already has its own child pages.", {
        description: "This would create too many levels of nesting."
      });
      return;
    }
    
    if (newParentPath) {
      const parentNode = findNodeByPath(structure, newParentPath);
      if (!parentNode) {
        toast.error("Target parent page for nesting not found.");
        return;
      }
      
      // --- FIX: Update depth check to allow nesting up to 3 levels total. ---
      // A parent can be at depth 0 or 1. A page at depth 2 cannot be a parent.
      const parentDepth = getNodeDepth(structure, newParentPath);
      if (parentDepth >= 2) {
        toast.error("Nesting is limited to two levels deep (3 levels total).");
        return;
      }
      
      const parentFile = site.contentFiles.find(f => f.path === newParentPath);
      if (parentFile?.frontmatter.collection) {
        toast.error("Pages cannot be nested under a Collection Page.");
        return;
      }
    }

    const { found: activeNode, tree: treeWithoutActive } = findAndRemoveNode([...structure], activeNodePath);
    if (!activeNode) return;

    const newParentDir = newParentPath ? newParentPath.replace(/\.md$/, '') : 'content';
    const finalActiveNode = updatePathsRecursively(activeNode, newParentDir);
    
    const pathsToMove: { oldPath: string; newPath: string }[] = [];
    const collectPaths = (newNode: StructureNode, oldNode: StructureNode) => {
        if (newNode.path !== oldNode.path) pathsToMove.push({ oldPath: oldNode.path, newPath: newNode.path });
        if (newNode.children && oldNode.children) newNode.children.forEach((child, i) => collectPaths(child, oldNode.children![i]));
    };
    collectPaths(finalActiveNode, activeNode);
    
    const finalTree = produce(treeWithoutActive, draft => {
        if (newParentPath) {
            const parent = findNodeByPath(draft, newParentPath);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.splice(newIndex, 0, finalActiveNode);
            }
        } else {
            draft.splice(newIndex, 0, finalActiveNode);
        }
    });
    
    try {
      if (pathsToMove.length > 0) await localSiteFs.moveContentFiles(siteId, pathsToMove);
      const newManifest = { ...site.manifest, structure: finalTree };
      const updatedContentFiles = updateContentFilePaths(site.contentFiles, pathsToMove);
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = newManifest;
          siteToUpdate.contentFiles = updatedContentFiles;
        }
      }));
      await localSiteFs.saveManifest(siteId, newManifest);
      toast.success("Site structure updated successfully.");
    } catch (error) {
      console.error("Failed to reposition node:", error);
      toast.error("An error occurred while updating the site structure. Reverting changes.");
      get().loadSite(siteId);
    }
  },
});