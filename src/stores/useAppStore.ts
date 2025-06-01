// src/stores/useAppStore.ts
import { create } from 'zustand';
import { AppState, LocalSiteData, SiteConfigFile, ParsedMarkdownFile } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs'; // Import all as localSiteFs module

// Define the store state and actions, including initialization logic
interface AppStore extends AppState {
  isInitialized: boolean;
  initialize: () => Promise<void>;
  // Renamed actions to avoid direct naming conflict with localSiteFs functions if an action
  // purely delegates. Better to have distinct names or encapsulate localSiteFs calls within actions.
  // For example, deleteSite in the store might be deleteSiteFromStateAndStorage.
  // Or, as done below, the action in the store can have the same name if its purpose is clear.
  // For this version, we'll keep names similar and ensure they call localSiteFs.
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string) => Promise<void>;
  deleteSiteAndState: (siteId: string) => Promise<void>; // New name for clarity
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>; // New name for clarity
}

export const useAppStore = create<AppStore>()(
  (set, get) => ({
    sites: [], // Initial empty array, will be populated by initialize
    isInitialized: false,

    /**
     * Initializes the store by loading all sites from localSiteFs.
     * Should be called once when the application mounts.
     */
    initialize: async () => {
      if (get().isInitialized) return; // Prevent re-initialization
      try {
        const sites = await localSiteFs.loadAllSites();
        set({ sites, isInitialized: true });
      } catch (error) {
        console.error("Failed to initialize app store from localSiteFs:", error);
        // Potentially set an error state or provide fallback
        set({ sites: [], isInitialized: true }); // Initialize with empty on error
      }
    },

    /**
     * Adds a new site to the application state and persists it.
     */
    addSite: async (newSiteData: LocalSiteData) => {
      try {
        await localSiteFs.saveSite(newSiteData); // Persist to local storage first
        set((state) => ({ sites: [...state.sites, newSiteData] })); // Then update in-memory state
      } catch (error) {
        console.error("Failed to add site:", error);
        // Potentially throw error or set an error state
      }
    },

    /**
     * Updates the configuration of an existing site and persists the change.
     */
    updateSiteConfig: async (siteId: string, config: SiteConfigFile) => {
      try {
        await localSiteFs.saveSiteConfig(siteId, config); // Persist config change
        set((state) => ({
          sites: state.sites.map((s) => (s.siteId === siteId ? { ...s, config } : s)),
        }));
      } catch (error) {
        console.error(`Failed to update site config for ${siteId}:`, error);
      }
    },

    /**
     * Adds a new content file or updates an existing one for a site.
     * It takes rawMarkdownContent (including frontmatter) and persists it.
     * localSiteFs.saveContentFile handles parsing before saving.
     */
    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string) => {
      try {
        // localSiteFs.saveContentFile will parse rawMarkdownContent and save the ParsedMarkdownFile structure
        const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
        
        if (savedFile) {
          set((state) => ({
            sites: state.sites.map((s) => {
              if (s.siteId === siteId) {
                const contentFiles = [...s.contentFiles]; // Create a new array for immutability
                const existingFileIndex = contentFiles.findIndex(f => f.path === filePath);
                if (existingFileIndex > -1) {
                  contentFiles[existingFileIndex] = savedFile; // Update existing file
                } else {
                  contentFiles.push(savedFile); // Add new file
                }
                return { ...s, contentFiles };
              }
              return s;
            }),
          }));
        } else {
            console.warn(`Content file was not saved or returned by localSiteFs for site ${siteId}, path ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to add or update content file ${filePath} for site ${siteId}:`, error);
      }
    },
    
    /**
     * Deletes a site from the application state and local storage.
     */
    deleteSiteAndState: async (siteId: string) => {
        try {
            await localSiteFs.deleteSite(siteId); // Delete from persistence
            set(state => ({ // Update in-memory state
                sites: state.sites.filter(s => s.siteId !== siteId),
            }));
        } catch (error) {
            console.error(`Failed to delete site ${siteId}:`, error);
        }
    },

    /**
     * Deletes a content file from a site in the application state and local storage.
     */
    deleteContentFileAndState: async (siteId: string, filePath: string) => {
        try {
            await localSiteFs.deleteContentFile(siteId, filePath); // Delete from persistence
            set(state => ({ // Update in-memory state
                sites: state.sites.map(s => {
                    if (s.siteId === siteId) {
                        return { ...s, contentFiles: s.contentFiles.filter(f => f.path !== filePath) };
                    }
                    return s;
                }),
            }));
        } catch (error) {
            console.error(`Failed to delete content file ${filePath} from site ${siteId}:`, error);
        }
    },

    /**
     * Retrieves a site by its ID from the current in-memory state.
     * Assumes the store is initialized.
     */
    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s) => s.siteId === siteId);
    },
  })
);

// Note: The `initialize()` method should be called from a root client component
// (e.g., in `src/app/layout.tsx` or a dedicated client-side initializer component)
// to load data when the application mounts.
// Example:
// import { useEffect } from 'react';
// import { useAppStore } from '@/stores/useAppStore';
//
// function AppInitializer() {
//   const { initialize, isInitialized } = useAppStore();
//   useEffect(() => {
//     if (!isInitialized) {
//       initialize();
//     }
//   }, [initialize, isInitialized]);
//   return null; // This component doesn't render anything itself
// }
//
// And then use <AppInitializer /> in your root layout.