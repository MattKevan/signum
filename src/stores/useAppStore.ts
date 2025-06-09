// src/stores/useAppStore.ts
import { create } from 'zustand';
import { AppState, LocalSiteData, Manifest, StructureNode } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs';
import { getParentPath } from '@/lib/fileTreeUtils';
import { DEFAULT_PAGE_LAYOUT_PATH, DEFAULT_COLLECTION_LAYOUT_PATH } from '@/config/editorConfig';
//import { slugify } from './utils';

// Recursive helper to map over the structure tree
function mapStructure(nodes: StructureNode[], predicate: (node: StructureNode) => boolean, transform: (node: StructureNode) => StructureNode): StructureNode[] {
    return nodes.map(node => {
        if (predicate(node)) {
            return transform(node);
        }
        if (node.children) {
            return { ...node, children: mapStructure(node.children, predicate, transform) };
        }
        return node;
    });
}

// Recursive helper to filter the structure tree
function filterStructure(nodes: StructureNode[], predicate: (node: StructureNode) => boolean): StructureNode[] {
    return nodes.reduce((acc, node) => {
        if (predicate(node)) {
            acc.push({
                ...node,
                children: node.children ? filterStructure(node.children, predicate) : undefined,
            });
        }
        return acc;
    }, [] as StructureNode[]);
}


interface AppStoreWithInit extends AppState {
  isInitialized: boolean;
  initialize: () => Promise<void>;
}

export const useAppStore = create<AppStoreWithInit>()(
  (set, get) => ({
    sites: [],
    isInitialized: false,

    initialize: async () => {
      if (get().isInitialized) return;
      const sites = await localSiteFs.loadAllSites();
      set({ sites, isInitialized: true });
    },

    addSite: async (newSiteData: LocalSiteData) => {
      await localSiteFs.saveSite(newSiteData);
      set((state) => ({ sites: [...state.sites, newSiteData] }));
    },

    updateManifest: async (siteId: string, newManifest: Manifest) => {
      await localSiteFs.saveManifest(siteId, newManifest);
      set((state) => ({
        sites: state.sites.map((s) => (s.siteId === siteId ? { ...s, manifest: newManifest } : s)),
      }));
    },
    
    // CHANGED: Now correctly assigns default layouts for the collection and its items
    addNewCollection: async (siteId: string, name: string, slug: string, layout: string) => {
      const site = get().sites.find(s => s.siteId === siteId);
      if (!site) return;

      const newCollectionNode: StructureNode = {
        type: 'collection',
        title: name.trim(),
        path: `content/${slug}`,
        slug: slug,
        children: [],
        navOrder: site.manifest.structure.length,
        layout: layout || DEFAULT_COLLECTION_LAYOUT_PATH,
        itemLayout: DEFAULT_PAGE_LAYOUT_PATH, // Default layout for items inside this collection
      };
      
      const newStructure = [...site.manifest.structure, newCollectionNode];
      const newManifest = { ...site.manifest, structure: newStructure };
      
      await get().updateManifest(siteId, newManifest);
    },
    
    // CHANGED: This action is now much smarter about assigning layouts and updating the manifest
    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string, layoutId: string): Promise<boolean> => {
      const site = get().getSiteById(siteId);
      if (!site) return false;

      const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
      
      const isNewFile = !site.contentFiles.some(f => f.path === filePath);
      
      const updatedContentFiles = isNewFile
          ? [...site.contentFiles, savedFile]
          : site.contentFiles.map(f => f.path === filePath ? savedFile : f);

      let manifestChanged = false;
      let newStructure = [...site.manifest.structure];

      if (isNewFile) {
        manifestChanged = true;
        let parentFound = false;
        const parentPath = getParentPath(filePath);

        // Try to add the new file as a child of its parent in the structure
        newStructure = mapStructure(site.manifest.structure, node => node.path === parentPath, parentNode => {
          parentFound = true;
          return {
            ...parentNode,
            children: [
              ...(parentNode.children || []),
              {
                type: 'page',
                title: savedFile.frontmatter.title,
                path: filePath,
                slug: savedFile.slug,
                layout: layoutId, // Use the layout determined by the editor UI
              },
            ],
          };
        });
        
        // If no parent was found (e.g., a new top-level page), add it to the root.
        if (!parentFound && parentPath === 'content') {
            newStructure.push({ type: 'page', title: savedFile.frontmatter.title, path: filePath, slug: savedFile.slug, layout: layoutId, navOrder: newStructure.length });
        }
      } else {
        // If an existing file's title changed, update it in the manifest.
        newStructure = mapStructure(site.manifest.structure, node => node.path === filePath, node => {
          if (node.title !== savedFile.frontmatter.title) {
            manifestChanged = true;
            return { ...node, title: savedFile.frontmatter.title };
          }
          return node;
        });
      }

      const finalState = { ...site, contentFiles: updatedContentFiles };
      if (manifestChanged) {
        finalState.manifest = { ...site.manifest, structure: newStructure };
        await localSiteFs.saveManifest(siteId, finalState.manifest);
      }
      
      set(state => ({
        sites: state.sites.map(s => s.siteId === siteId ? finalState : s),
      }));
      
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
      
      const newStructure = filterStructure(site.manifest.structure, node => node.path !== filePath);
      const newContentFiles = site.contentFiles.filter(f => f.path !== filePath);
      const newManifest = { ...site.manifest, structure: newStructure };

      await localSiteFs.saveManifest(siteId, newManifest);
      
      set(state => ({
          sites: state.sites.map(s => s.siteId === siteId ? { ...s, manifest: newManifest, contentFiles: newContentFiles } : s),
      }));
    },

    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s) => s.siteId === siteId);
    },
  })
);