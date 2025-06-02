// src/stores/useAppStore.ts
import { create } from 'zustand';
// AppState is now updated in src/types/index.ts
import { AppState, LocalSiteData, SiteConfigFile, ParsedMarkdownFile } from '@/types'; 
import * as localSiteFs from '@/lib/localSiteFs';

// The AppStore interface now correctly extends the modified AppState
// and adds its own specific properties like isInitialized and initialize.
interface AppStore extends AppState { // AppState already includes the new methods
  isInitialized: boolean;
  initialize: () => Promise<void>;
  // No need to re-declare methods already in AppState if their signatures match
}

export const useAppStore = create<AppStore>()( // This should now satisfy the AppStore type
  (set, get) => ({
    // State properties
    sites: [], 
    isInitialized: false,

    // Actions from AppState and specific to AppStore
    initialize: async () => {
      if (get().isInitialized) return;
      try {
        const sites = await localSiteFs.loadAllSites();
        set({ sites, isInitialized: true });
      } catch (error) {
        console.error("Failed to initialize app store from localSiteFs:", error);
        set({ sites: [], isInitialized: true });
      }
    },

    addSite: async (newSiteData: LocalSiteData) => {
      try {
        await localSiteFs.saveSite(newSiteData);
        set((state) => ({ sites: [...state.sites, newSiteData] }));
      } catch (error) {
        console.error("Failed to add site:", error);
        throw error;
      }
    },

    updateSiteConfig: async (siteId: string, config: SiteConfigFile) => {
      try {
        await localSiteFs.saveSiteConfig(siteId, config);
        set((state) => ({
          sites: state.sites.map((s) => (s.siteId === siteId ? { ...s, config } : s)),
        }));
      } catch (error) {
        console.error(`Failed to update site config for ${siteId}:`, error);
        throw error;
      }
    },

    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string): Promise<boolean> => {
      try {
        const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
        
        if (savedFile) {
          set((state) => ({
            sites: state.sites.map((s) => {
              if (s.siteId === siteId) {
                const contentFiles = [...s.contentFiles];
                const existingFileIndex = contentFiles.findIndex(f => f.path === filePath);
                if (existingFileIndex > -1) {
                  contentFiles[existingFileIndex] = savedFile;
                } else {
                  contentFiles.push(savedFile);
                }
                return { ...s, contentFiles };
              }
              return s;
            }),
          }));
          return true;
        } else {
            console.warn(`Content file was not saved (likely parse error) for site ${siteId}, path ${filePath}`);
            return false;
        }
      } catch (error) {
        console.error(`Failed to add or update content file ${filePath} for site ${siteId}:`, error);
        throw error;
      }
    },
    
    deleteSiteAndState: async (siteId: string) => {
        try {
            await localSiteFs.deleteSite(siteId);
            set(state => ({
                sites: state.sites.filter(s => s.siteId !== siteId),
            }));
        } catch (error) {
            console.error(`Failed to delete site ${siteId}:`, error);
            throw error;
        }
    },

    deleteContentFileAndState: async (siteId: string, filePath: string) => {
        try {
            await localSiteFs.deleteContentFile(siteId, filePath);
            set(state => ({
                sites: state.sites.map(s => {
                    if (s.siteId === siteId) {
                        return { ...s, contentFiles: s.contentFiles.filter(f => f.path !== filePath) };
                    }
                    return s;
                }),
            }));
        } catch (error) {
            console.error(`Failed to delete content file ${filePath} from site ${siteId}:`, error);
            throw error;
        }
    },

    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s) => s.siteId === siteId);
    },
  })
);