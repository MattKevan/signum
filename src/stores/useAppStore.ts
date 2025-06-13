// src/stores/useAppStore.ts
import { create } from 'zustand';
import { produce } from 'immer';
import { AppState, LocalSiteData, Manifest, StructureNode, ParsedMarkdownFile } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs';
import { getParentPath } from '@/lib/fileTreeUtils';
import { DEFAULT_PAGE_LAYOUT_PATH, DEFAULT_COLLECTION_LAYOUT_PATH } from '@/config/editorConfig';

/**
 * The interface for the main application store, extending the base state
 * with initialization and lazy-loading capabilities.
 */
interface AppStoreWithInit extends AppState {
  /** A flag to track if the initial data has been loaded from storage. */
  isInitialized: boolean;
  /** The action to initialize the store on application startup. */
  initialize: () => Promise<void>;
  /** The action to lazy-load content files for a specific site. */
  loadContentForSite: (siteId: string) => Promise<void>;
  /** A lightweight action for updating only the in-memory state of a content file, used for autosaving. */
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => void;
}

/**
 * The main application store, created with Zustand.
 * This store manages the state of all user-created sites, handling all
 * CRUD (Create, Read, Update, Delete) operations and orchestrating the
 * interaction between the UI, the in-memory state, and the persistent
 * browser storage (`localforage`).
 */
export const useAppStore = create<AppStoreWithInit>()(
  (set, get) => ({
    sites: [],
    isInitialized: false,

    /**
     * Initializes the store on application startup.
     * This function performs a lightweight load, fetching only the manifests for all sites
     * to ensure the application starts quickly. The actual content of each site is lazy-loaded later.
     */
    initialize: async () => {
      if (get().isInitialized) return;
      try {
        const manifests = await localSiteFs.loadAllSiteManifests();
        
        const sites: LocalSiteData[] = manifests.map(manifest => ({
          siteId: manifest.siteId,
          manifest,
        }));

        set({ sites, isInitialized: true });
      } catch (error) {
        console.error("Failed to initialize app store:", error);
        set({ isInitialized: true }); // Mark as initialized even on error to prevent loops
      }
    },

    /**
     * Performs the on-demand lazy-loading of a site's content files.
     * This is called when a user navigates to a specific site's context (e.g., editor or view).
     * It fetches the content from storage and injects it into the site's state object.
     * The function is idempotent and will not re-fetch content that is already loaded.
     * @param {string} siteId - The unique identifier of the site whose content should be loaded.
     */
    loadContentForSite: async (siteId: string) => {
      const site = get().getSiteById(siteId);
      if (!site || site.contentFiles) return; 

      try {
        const contentFiles = await localSiteFs.getSiteContentFiles(siteId);
        
        set(produce((draft: AppStoreWithInit) => {
          const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
          if (siteToUpdate) {
            siteToUpdate.contentFiles = contentFiles;
          }
        }));
      } catch (error) {
        console.error(`Failed to load content for site ${siteId}:`, error);
      }
    },

    /**
     * Adds a new site to both the persistent storage and the application state.
     * @param {LocalSiteData} newSiteData - The complete data object for the new site to be created.
     */
    addSite: async (newSiteData: LocalSiteData) => {
      await localSiteFs.saveSite(newSiteData);
      set((state) => ({ sites: [...state.sites, newSiteData] }));
    },

    /**
     * Updates a site's manifest in both persistent storage and the current application state.
     * This is used for changes to site-wide metadata, such as the title, description, or file structure.
     * @param {string} siteId - The ID of the site whose manifest is being updated.
     * @param {Manifest} newManifest - The new manifest object to save.
     */
    updateManifest: async (siteId: string, newManifest: Manifest) => {
      await localSiteFs.saveManifest(siteId, newManifest);
      set(produce((draft: AppStoreWithInit) => {
        const site = draft.sites.find((s) => s.siteId === siteId);
        if (site) {
          site.manifest = newManifest;
        }
      }));
    },
    
    /**
     * A user-facing action to create a new collection within a site.
     * It constructs the new collection node, updates the manifest structure, and persists the change.
     * @param {string} siteId - The ID of the parent site.
     * @param {string} name - The display name for the new collection.
     * @param {string} slug - The URL-friendly slug for the collection folder.
     * @param {string} layout - The path to the layout to be used for this collection's listing page.
     */
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
    
    /**
     * Performs a lightweight, in-memory update of a single content file's state.
     * This is used by the autosave feature to keep the UI in sync without the overhead
     * of updating the manifest on every change. It does NOT persist the manifest.
     * @param {string} siteId - The ID of the site being edited.
     * @param {ParsedMarkdownFile} savedFile - The parsed content file object to update in the state.
     */
    updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile) => {
        set(produce((draft: AppStoreWithInit) => {
            const site = draft.sites.find(s => s.siteId === siteId);
            // Guard against the content not being loaded yet.
            if (!site?.contentFiles) return;

            const fileIndex = site.contentFiles.findIndex(f => f.path === savedFile.path);
            if (fileIndex !== -1) {
                site.contentFiles[fileIndex] = savedFile;
            } else {
                site.contentFiles.push(savedFile);
            }
        }));
    },

    /**
     * Handles the complete save/update process for a content file. This is a "heavy" operation
     * that persists the file to storage, updates the manifest structure, updates the in-memory
     * state for both the file and the manifest, and finally persists the updated manifest.
     * @param {string} siteId - The ID of the site.
     * @param {string} filePath - The path of the file to save (e.g., 'content/posts/my-post.md').
     * @param {string} rawMarkdownContent - The full string content of the file.
     * @param {string} layoutId - The ID of the layout associated with this content file.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string, layoutId: string): Promise<boolean> => {
      const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
      
      const site = get().getSiteById(siteId);
      if (!site) return false;

      const isNewFile = !site.contentFiles?.some(f => f.path === filePath);

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
          const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
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
        
    /**
     * Permanently deletes an entire site from both persistent storage and the application state.
     * @param {string} siteId - The ID of the site to delete.
     */
    deleteSiteAndState: async (siteId: string) => {
        await localSiteFs.deleteSite(siteId);
        set(state => ({
            sites: state.sites.filter(s => s.siteId !== siteId),
        }));
    },

    /**
     * Deletes a single content file from storage, updates the site manifest to remove
     * its entry, and syncs the state to reflect these changes.
     * @param {string} siteId - The ID of the site containing the file.
     * @param {string} filePath - The path of the content file to delete.
     */
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
            if (siteToUpdate.contentFiles) {
                siteToUpdate.contentFiles = siteToUpdate.contentFiles.filter(f => f.path !== filePath);
            }
            siteToUpdate.manifest = newManifest;
          }
      }));
    },

    /**
     * A synchronous getter to retrieve a site's data object from the current state by its ID.
     * @param {string} siteId - The ID of the site to retrieve.
     * @returns {LocalSiteData | undefined} The site data object, or undefined if not found in the state.
     */
    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s) => s.siteId === siteId);
    },
  })
);