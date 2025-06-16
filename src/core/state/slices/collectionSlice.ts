// src/core/state/slices/collectionSlice.ts

import { StateCreator } from 'zustand';
import { produce } from 'immer';
import { StructureNode } from '@/types';
import { SiteSlice } from './siteSlice';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { toast } from 'sonner';

export interface CollectionSlice {
    addNewCollection: (siteId: string, name: string, slug: string) => Promise<void>;
}

export const createCollectionSlice: StateCreator<SiteSlice & CollectionSlice, [], [], CollectionSlice> = (set, get) => ({
    addNewCollection: async (siteId, name, slug) => {
        const site = get().getSiteById(siteId);
        if (!site) return;

        const newCollectionNode: StructureNode = {
            type: 'collection',
            title: name.trim(),
            path: `content/${slug}`,
            slug: slug,
            children: [],
            layout: 'none', // Collections no longer have a primary layout
            itemLayout: DEFAULT_PAGE_LAYOUT_PATH,
        };
        
        const newManifest = produce(site.manifest, draft => {
            draft.structure.push(newCollectionNode);
        });
        
        await get().updateManifest(siteId, newManifest);
        toast.success(`Collection "${name.trim()}" created.`);
    },
});