// src/stores/useAppStore.ts
import { create } from 'zustand';
import { produce, enableMapSet } from 'immer';
import { AppState, LocalSiteData, Manifest, StructureNode, ParsedMarkdownFile } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs';
import { getParentPath } from '@/lib/fileTreeUtils';
import { DEFAULT_PAGE_LAYOUT_PATH, DEFAULT_COLLECTION_LAYOUT_PATH } from '@/config/editorConfig';
import { toast } from 'sonner';

// Enable the Immer plugin for Map and Set support
enableMapSet();

interface AppStoreWithInit extends AppState {
  isInitialized: boolean;
  loadingSites: Set<string>;
  initialize: () => Promise<void>;
  loadSite: (siteId: string) => Promise<void>;
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => void;
}

export const useAppStore = create<AppStoreWithInit>()(
  (set, get) => ({
    sites: [],
    isInitialized: false,
    loadingSites: new Set(),

    initialize: async () => {
      if (get().isInitialized) return;
      console.log('[AppStore] Initializing application state...');
      set({ isInitialized: true });
    },

    /**
     * Ensures a site is fully loaded into the store using an atomic update.
     * It fetches all necessary data first, then commits it to the store in a single update.
     * @param {string} siteId - The unique identifier of the site to load.
     */
    loadSite: async (siteId: string) => {
      const state = get();
      if (state.loadingSites.has(siteId)) {
        console.log(`[AppStore.loadSite] Load already in progress for siteId: ${siteId}.`);
        return;
      }

      const existingSite = state.getSiteById(siteId);
      if (existingSite && existingSite.contentFiles) {
        console.log(`[AppStore.loadSite] Site ${siteId} is already fully loaded.`);
        return;
      }
      
      console.log(`[AppStore.loadSite] Starting atomic load for siteId: ${siteId}...`);
      set(produce((draft) => { draft.loadingSites.add(siteId); }));

      try {
        // --- Step 1: Gather all required data asynchronously ---
        const manifest = await localSiteFs.getManifestById(siteId);
        if (!manifest) {
          toast.error(`Site data could not be found for ID: ${siteId}`);
          throw new Error(`Failed to load manifest for siteId: ${siteId}`);
        }

        const contentFiles = await localSiteFs.getSiteContentFiles(siteId);
        const layoutFiles = await localSiteFs.getSiteLayoutFiles(siteId); // Also fetch layout/theme files
        const themeFiles = await localSiteFs.getSiteThemeFiles(siteId);

        // --- Step 2: Assemble the final, complete site object ---
        const loadedSiteData: LocalSiteData = {
          siteId,
          manifest,
          contentFiles,
          layoutFiles,
          themeFiles,
        };

        // --- Step 3: Commit the final state in a single, atomic update ---
        set(produce((draft: AppStoreWithInit) => {
          const siteIndex = draft.sites.findIndex((s: LocalSiteData) => s.siteId === siteId);
          if (siteIndex > -1) {
            draft.sites[siteIndex] = loadedSiteData;
          } else {
            draft.sites.push(loadedSiteData);
          }
        }));

        console.log(`[AppStore.loadSite] Atomic load successful for siteId: ${siteId}.`);

      } catch (error) {
        console.error(`[AppStore.loadSite] Error during atomic load for ${siteId}:`, error);
      } finally {
        console.log(`[AppStore.loadSite] Finished load process for siteId: ${siteId}.`);
        set(produce((draft) => { draft.loadingSites.delete(siteId); }));
      }
    },

    /**
     * Adds a new site to persistent storage and then atomically updates the application state.
     * @param {LocalSiteData} newSiteData - The complete data object for the new site.
     */
    addSite: async (newSiteData: LocalSiteData) => {
      console.log(`[AppStore.addSite] Creating new site: "${newSiteData.manifest.title}" (ID: ${newSiteData.siteId})`);
      
      // --- Step 1: Perform the async operation ---
      await localSiteFs.saveSite(newSiteData);
      
      // --- Step 2: Perform the atomic state update ---
      set(produce((draft: AppStoreWithInit) => {
        // Prevent duplicates in case of race conditions
        if (!draft.sites.some((s: LocalSiteData) => s.siteId === newSiteData.siteId)) {
          draft.sites.push(newSiteData);
        }
      }));
      
      console.log(`[AppStore.addSite] Site "${newSiteData.siteId}" successfully saved and added to state.`);
    },

    /**
     * Updates a site's manifest in both persistent storage and the current application state.
     * @param {string} siteId - The ID of the site whose manifest is being updated.
     * @param {Manifest} newManifest - The new manifest object to save.
     */
    updateManifest: async (siteId: string, newManifest: Manifest) => {
      console.log(`[AppStore.updateManifest] Updating manifest for siteId: ${siteId}`);
      await localSiteFs.saveManifest(siteId, newManifest);
      set(produce((draft: AppStoreWithInit) => {
        const site = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
        if (site) {
          site.manifest = newManifest;
        }
      }));
    },
    
    // ... (The rest of the store actions (addNewCollection, updateContentFileOnly, etc.) remain the same as they were already correct) ...

    addNewCollection: async (siteId: string, name: string, slug: string, layout: string) => {
      console.log(`[AppStore.addNewCollection] Adding collection "${name}" to site ${siteId}`);
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
    
    updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => {
        set(produce((draft: AppStoreWithInit) => {
            const site = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
            if (!site?.contentFiles) {
              console.warn(`[AppStore.updateContentFileOnly] Attempted to update file, but content for site ${siteId} is not loaded. Aborting.`);
              return;
            }

            const fileIndex = site.contentFiles.findIndex(f => f.path === savedFile.path);
            if (fileIndex !== -1) {
                site.contentFiles[fileIndex] = savedFile;
            } else {
                site.contentFiles.push(savedFile);
            }
        }));
    },

    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string, layoutId: string): Promise<boolean> => {
      console.log(`[AppStore.addOrUpdateContentFile] Saving file "${filePath}" for site ${siteId}.`);
      const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
      
      const site = get().getSiteById(siteId);
      if (!site || !site.contentFiles) return false;

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
      
      set(produce((draft: AppStoreWithInit) => {
          const siteToUpdate = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
          if (siteToUpdate) {
              if (!siteToUpdate.contentFiles) siteToUpdate.contentFiles = [];

              const fileIndex = siteToUpdate.contentFiles.findIndex(f => f.path === filePath);
              if (fileIndex !== -1) {
                  siteToUpdate.contentFiles[fileIndex] = savedFile;
              } else {
                  siteToUpdate.contentFiles.push(savedFile);
              }
              siteToUpdate.manifest = newManifest;
          }
      }));

      await localSiteFs.saveManifest(siteId, newManifest);
      return true;
    },
        
    deleteSiteAndState: async (siteId: string) => {
        console.warn(`[AppStore.deleteSiteAndState] DELETING siteId: ${siteId}`);
        await localSiteFs.deleteSite(siteId);
        set(state => ({
            sites: state.sites.filter((s: LocalSiteData) => s.siteId !== siteId),
        }));
    },

    deleteContentFileAndState: async (siteId: string, filePath: string) => {
      console.warn(`[AppStore.deleteContentFileAndState] DELETING file "${filePath}" from site ${siteId}`);
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
          const siteToUpdate = draft.sites.find((s: LocalSiteData) => s.siteId === siteId);
          if(siteToUpdate) {
            if (siteToUpdate.contentFiles) {
                siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
            }
            siteToUpdate.manifest = newManifest;
          }
      }));
    },

    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s: LocalSiteData) => s.siteId === siteId);
    },
  })
);