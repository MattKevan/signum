// src/core/state/slices/siteSlice.ts
import { StateCreator } from 'zustand';
import { produce } from 'immer';
import { LocalSiteData, Manifest } from '@/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import { loadSiteSecretsFromDb } from '@/core/services/siteSecrets.service';
import { toast } from 'sonner';

export interface SiteSlice {
  sites: LocalSiteData[];
  loadingSites: Set<string>;
  getSiteById: (siteId: string) => LocalSiteData | undefined;
  loadSite: (siteId: string) => Promise<void>;
  addSite: (siteData: LocalSiteData) => Promise<void>;
  updateManifest: (siteId: string, manifest: Manifest) => Promise<void>;
  deleteSiteAndState: (siteId: string) => Promise<void>;
  // --- FIX: Added action to initialize the store from storage ---
  initializeSites: () => Promise<void>;
}

export const createSiteSlice: StateCreator<SiteSlice, [], [], SiteSlice> = (set, get) => ({
  sites: [],
  loadingSites: new Set(),
  getSiteById: (siteId) => get().sites.find(s => s.siteId === siteId),

  // --- FIX: New action to hydrate the store on app load ---
  /**
   * Loads all site manifests from local storage and populates the initial state.
   * This is called once when the application starts. It only loads manifests
   * for a fast initial load; full site content is lazy-loaded later.
   */
  initializeSites: async () => {
    try {
      const manifests = await localSiteFs.loadAllSiteManifests();
      const initialSites: LocalSiteData[] = manifests.map(manifest => ({
        siteId: manifest.siteId,
        manifest: manifest,
        // Content and other files are intentionally left undefined for lazy loading.
      }));
      set({ sites: initialSites });
    } catch (error) {
      console.error("Failed to initialize sites from storage:", error);
      toast.error("Could not load your sites. Storage might be corrupted.");
    }
  },

  loadSite: async (siteId) => {
    if (get().loadingSites.has(siteId)) return;
    const existingSite = get().getSiteById(siteId);
    if (existingSite && existingSite.contentFiles) return;
    
    set(produce(draft => { draft.loadingSites.add(siteId); }));

    try {
      const manifest = await localSiteFs.getManifestById(siteId);
      if (!manifest) throw new Error(`Failed to load manifest for siteId: ${siteId}`);
      
      const [contentFiles, layoutFiles, themeFiles, secrets] = await Promise.all([
        localSiteFs.getSiteContentFiles(siteId),
        localSiteFs.getSiteLayoutFiles(siteId),
        localSiteFs.getSiteThemeFiles(siteId),
        loadSiteSecretsFromDb(siteId)
      ]);

      const loadedSiteData: LocalSiteData = { siteId, manifest, contentFiles, layoutFiles, themeFiles, secrets };

      set(produce((draft: SiteSlice) => {
        const siteIndex = draft.sites.findIndex(s => s.siteId === siteId);
        if (siteIndex > -1) {
          draft.sites[siteIndex] = loadedSiteData;
        } else {
          draft.sites.push(loadedSiteData);
        }
      }));
    } catch (error) {
      toast.error(`Could not load site data for ID: ${siteId}`);
      console.error(`[AppStore.loadSite] Error during load for ${siteId}:`, error);
    } finally {
      set(produce(draft => { draft.loadingSites.delete(siteId); }));
    }
  },

  addSite: async (newSiteData) => {
    await localSiteFs.saveSite(newSiteData);
    set(produce((draft: SiteSlice) => {
      const siteIndex = draft.sites.findIndex(s => s.siteId === newSiteData.siteId);
      if (siteIndex > -1) {
        // If site exists, overwrite it. This is used by the importer.
        draft.sites[siteIndex] = newSiteData;
      } else {
        draft.sites.push(newSiteData);
      }
    }));
  },

  updateManifest: async (siteId, newManifest) => {
    await localSiteFs.saveManifest(siteId, newManifest);
    set(produce((draft: SiteSlice) => {
      const site = draft.sites.find(s => s.siteId === siteId);
      if (site) site.manifest = newManifest;
    }));
  },

  deleteSiteAndState: async (siteId) => {
    await localSiteFs.deleteSite(siteId);
    set(produce((draft: SiteSlice) => {
      draft.sites = draft.sites.filter(s => s.siteId !== siteId);
    }));
  },
});