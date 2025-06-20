// src/stores/useAppStore.ts
import { create } from 'zustand';
import {  enableMapSet } from 'immer';
import { SiteSlice, createSiteSlice } from './slices/siteSlice';
import { ContentSlice, createContentSlice } from './slices/contentSlice';
import { SecretsSlice, createSecretsSlice } from './slices/secretsSlice';

// Enable Immer for Map and Set support
enableMapSet();

// The full store type is an intersection of all slice types
type AppStore = SiteSlice & ContentSlice & SecretsSlice & {
  isInitialized: boolean;
  initialize: () => void;
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string | null) => void;
};

export const useAppStore = create<AppStore>()((...a) => ({
  isInitialized: false,
  initialize: () => {
    const set = a[0]; // Zustand's `set` function
    if (a[1]().isInitialized) return;
    console.log('[AppStore] Initializing application state...');
    set({ isInitialized: true });
  },

  activeSiteId: null,
  setActiveSiteId: (siteId) => {
    a[0]({ activeSiteId: siteId });
  },

  ...createSiteSlice(...a),
  ...createContentSlice(...a),
  ...createSecretsSlice(...a),
}));