// src/stores/useAppStore.ts
import { create } from 'zustand';
import {  enableMapSet } from 'immer';
import { SiteSlice, createSiteSlice } from './slices/siteSlice';
import { ContentSlice, createContentSlice } from './slices/contentSlice';

// Enable Immer for Map and Set support
enableMapSet();

// The full store type is an intersection of all slice types
type AppStore = SiteSlice & ContentSlice & {
  isInitialized: boolean;
  initialize: () => void;
};

export const useAppStore = create<AppStore>()((...a) => ({
  isInitialized: false,
  initialize: () => {
    const set = a[0]; // Zustand's `set` function
    if (a[1]().isInitialized) return;
    console.log('[AppStore] Initializing application state...');
    set({ isInitialized: true });
  },
  ...createSiteSlice(...a),
  ...createContentSlice(...a),
}));