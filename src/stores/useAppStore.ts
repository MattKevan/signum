// src/stores/useAppStore.ts
import { create } from 'zustand';
import { produce } from 'immer';
import { AppState, LocalSiteData, Manifest, StructureNode, ParsedMarkdownFile } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs';
import { getParentPath } from '@/lib/fileTreeUtils';
import { DEFAULT_PAGE_LAYOUT_PATH, DEFAULT_COLLECTION_LAYOUT_PATH } from '@/config/editorConfig';

interface AppStoreWithInit extends AppState {
  isInitialized: boolean;
  initialize: () => Promise<void>;
  // This is a new action specifically for background updates
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => void;
}

export const useAppStore = create<AppStoreWithInit>()(
  (set, get) => ({
    sites: [],
    isInitialized: false,

    initialize: async () => {
      if (get().isInitialized) return;
      try {
        const sites = await localSiteFs.loadAllSites();
        set({ sites, isInitialized: true });
      } catch (error) {
        console.error("Failed to initialize app store:", error);
        set({ isInitialized: true }); // Mark as initialized even on error to prevent loops
      }
    },

    addSite: async (newSiteData: LocalSiteData) => {
      await localSiteFs.saveSite(newSiteData);
      set((state) => ({ sites: [...state.sites, newSiteData] }));
    },

    updateManifest: async (siteId: string, newManifest: Manifest) => {
      await localSiteFs.saveManifest(siteId, newManifest);
      set(produce((draft: AppStoreWithInit) => {
        const site = draft.sites.find((s) => s.siteId === siteId);
        if (site) {
          site.manifest = newManifest;
        }
      }));
    },
    
    addNewCollection: async (siteId: string, name: string, slug: string, layout: string) => {
      const site = get().getSiteById(siteId);
      if (!site) return;

      const newCollectionNode: StructureNode = {
        type: 'collection',
        title: name.trim(),
        path: `content/${slug}`,
        slug: slug,
        children: [],
        navOrder: site.manifest.structure.length,
        layout: layout || DEFAULT_COLLECTION_LAYOUT_PATH,
        itemLayout: DEFAULT_PAGE_LAYOUT_PATH,
      };
      
      const newManifest = produce(site.manifest, draft => {
        draft.structure.push(newCollectionNode);
      });
      
      await get().updateManifest(siteId, newManifest);
    },
    
    // This is the background update action. It does NOT save the manifest.
    updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => {
        set(produce((draft: AppStoreWithInit) => {
            const site = draft.sites.find(s => s.siteId === siteId);
            if (!site) return;

            const fileIndex = site.contentFiles.findIndex(f => f.path === savedFile.path);
            if (fileIndex !== -1) {
                site.contentFiles[fileIndex] = savedFile;
            } else {
                // This action should only be for updates, but handle adding as a fallback.
                site.contentFiles.push(savedFile);
            }
        }));
    },

    // This is the main user-facing action that saves the file AND updates the manifest.
    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string, layoutId: string): Promise<boolean> => {
      // Step 1: Save the file to disk and get the parsed version.
      const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
      
      // Step 2: Update the manifest based on the save.
      const site = get().getSiteById(siteId);
      if (!site) return false;

      const isNewFile = !site.contentFiles.some(f => f.path === filePath);

      const newManifest = produce(site.manifest, draft => {
          let parentFound = false;
          
          const mapNode = (node: StructureNode): StructureNode => {
              if (isNewFile && node.path === getParentPath(filePath)) {
                  parentFound = true;
                  return { ...node, children: [...(node.children || []), { type: 'page', title: savedFile.frontmatter.title, path: filePath, slug: savedFile.slug, layout: layoutId }] };
              }
              if (!isNewFile && node.path === filePath && node.title !== savedFile.frontmatter.title) {
                  return { ...node, title: savedFile.frontmatter.title };
              }
              if (node.children) {
                  return { ...node, children: node.children.map(mapNode) };
              }
              return node;
          };

          draft.structure = draft.structure.map(mapNode);

          if (isNewFile && !parentFound && getParentPath(filePath) === 'content') {
            draft.structure.push({ type: 'page', title: savedFile.frontmatter.title, path: filePath, slug: savedFile.slug, layout: layoutId, navOrder: draft.structure.length });
          }
      });
      
      // Step 3: Atomically update the store with the new file AND the new manifest.
      set(produce((draft: AppStoreWithInit) => {
          const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
          if (siteToUpdate) {
              const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === filePath);
              if (fileIndex !== -1) {
                  siteToUpdate.contentFiles[fileIndex] = savedFile;
              } else {
                  siteToUpdate.contentFiles.push(savedFile);
              }
              siteToUpdate.manifest = newManifest;
          }
      }));

      // Step 4: Save the updated manifest to disk.
      await localSiteFs.saveManifest(siteId, newManifest);
      
      return true;
    },
        
    deleteSiteAndState: async (siteId: string) => {
        await localSiteFs.deleteSite(siteId);
        set(state => ({
            sites: state.sites.filter(s => s.siteId !== siteId),
        }));
    },

    deleteContentFileAndState: async (siteId: string, filePath: string) => {
      const site = get().getSiteById(siteId);
      if (!site) return;

      await localSiteFs.deleteContentFile(siteId, filePath);
      
      const newManifest = produce(site.manifest, draft => {
          const filterStructure = (nodes: StructureNode[]): StructureNode[] => {
              return nodes.filter(node => node.path !== filePath).map(node => {
                  if (node.children) {
                      node.children = filterStructure(node.children);
                  }
                  return node;
              });
          };
          draft.structure = filterStructure(draft.structure);
      });
      
      await localSiteFs.saveManifest(siteId, newManifest);
      
      set(produce((draft: AppStoreWithInit) => {
          const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
          if(siteToUpdate) {
            siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
            siteToUpdate.manifest = newManifest;
          }
      }));
    },

    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s) => s.siteId === siteId);
    },
  })
);