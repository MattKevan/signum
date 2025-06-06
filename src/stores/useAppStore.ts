// src/stores/useAppStore.ts
import { create } from 'zustand';
import { AppState, LocalSiteData, SiteConfigFile, NavItem } from '@/types'; 
import * as localSiteFs from '@/lib/localSiteFs';

interface AppStore extends AppState {
  isInitialized: boolean;
  initialize: () => Promise<void>;
  updateSiteStructure: (siteId: string, navItems: NavItem[]) => Promise<void>;
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string, isNewFile?: boolean) => Promise<boolean>;
}

export const useAppStore = create<AppStore>()(
  (set, get) => ({
    sites: [], 
    isInitialized: false,

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
    
    updateSiteStructure: async (siteId: string, newNavItems: NavItem[]) => {
      const site = get().sites.find(s => s.siteId === siteId);
      if (!site) return;
      
      // The logic for moving files when nesting is complex and will be a future enhancement.
      // For now, this action correctly saves the new order and structure of nav_items.
      const newConfig = { ...site.config, nav_items: newNavItems };
      await get().updateSiteConfig(siteId, newConfig);
    },

    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string, isNewFile: boolean = false): Promise<boolean> => {
      try {
        const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
        
        if (savedFile) {
          set((state) => {
            const sitesWithUpdate = state.sites.map((s) => {
              if (s.siteId === siteId) {
                const contentFiles = [...s.contentFiles];
                const existingFileIndex = contentFiles.findIndex(f => f.path === filePath);
                if (existingFileIndex > -1) {
                  contentFiles[existingFileIndex] = savedFile;
                } else {
                  contentFiles.push(savedFile);
                }

                if (isNewFile && !filePath.endsWith('index.md')) {
                  const path = filePath.replace('content/', '').replace('.md', '');
                  const newNavItem: NavItem = {
                    type: 'page',
                    path: path,
                    order: s.config.nav_items?.length || 0,
                  };

                  const newNavItems = [...(s.config.nav_items || []), newNavItem];
                  const newConfig = { ...s.config, nav_items: newNavItems };
                  
                  localSiteFs.saveSiteConfig(siteId, newConfig);
                  return { ...s, config: newConfig, contentFiles };
                }
                
                return { ...s, contentFiles };
              }
              return s;
            });
            return { sites: sitesWithUpdate };
          });
          return true;
        } else {
            console.warn(`Content file was not saved for site ${siteId}, path ${filePath}`);
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