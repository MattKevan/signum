// src/stores/useAppStore.ts
import { create } from 'zustand';
import { AppState, LocalSiteData, Manifest, StructureNode } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs';
import { parseMarkdownString } from '@/lib/markdownParser';

// Helper function to recursively traverse the structure tree and apply updates.
const mapStructure = (nodes: StructureNode[], predicate: (node: StructureNode) => boolean, transform: (node: StructureNode) => StructureNode): StructureNode[] => {
  return nodes.map(node => {
    if (predicate(node)) {
      node = transform(node);
    }
    if (node.children) {
      node.children = mapStructure(node.children, predicate, transform);
    }
    return node;
  });
};

// Helper function to recursively find and remove a node from the tree.
const filterStructure = (nodes: StructureNode[], predicate: (node: StructureNode) => boolean): StructureNode[] => {
  return nodes.filter(predicate).map(node => {
    if (node.children) {
      node.children = filterStructure(node.children, predicate);
    }
    return node;
  });
};

interface AppStore extends AppState {
  isInitialized: boolean;
  initialize: () => Promise<void>;
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

    // REPLACES updateSiteConfig and updateSiteStructure
    updateManifest: async (siteId: string, newManifest: Manifest) => {
      try {
        await localSiteFs.saveManifest(siteId, newManifest);
        set((state) => ({
          sites: state.sites.map((s) => (s.siteId === siteId ? { ...s, manifest: newManifest } : s)),
        }));
      } catch (error) {
        console.error(`Failed to update manifest for ${siteId}:`, error);
        throw error;
      }
    },

    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string): Promise<boolean> => {
      try {
        const savedFile = await localSiteFs.saveContentFile(siteId, filePath, rawMarkdownContent);
        if (!savedFile) return false;

        const site = get().sites.find(s => s.siteId === siteId);
        if (!site) return false;
        
        const isNewFile = !site.contentFiles.some(f => f.path === filePath);
        
        // Update contentFiles in state
        const updatedContentFiles = isNewFile
          ? [...site.contentFiles, savedFile]
          : site.contentFiles.map(f => f.path === filePath ? savedFile : f);

        // Update manifest.structure
        const { frontmatter } = parseMarkdownString(rawMarkdownContent);
        let manifest_changed = false;
        let newStructure = site.manifest.structure;

        if (isNewFile) {
            // Find parent and insert new node
            const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
            manifest_changed = true;
            let parentFoundAndUpdated = false;

            newStructure = mapStructure(newStructure, (node) => node.path === parentPath, (parentNode) => {
                const children = parentNode.children || [];
                children.push({
                    type: 'page',
                    title: frontmatter.title,
                    path: filePath,
                    slug: savedFile.slug,
                });
                parentFoundAndUpdated = true;
                return { ...parentNode, children };
            });

            // If parent isn't in tree (e.g., top-level file), add to root
            if (!parentFoundAndUpdated && parentPath === 'content') {
                 newStructure.push({
                    type: 'page',
                    title: frontmatter.title,
                    path: filePath,
                    slug: savedFile.slug,
                });
            }

        } else {
            // Find existing node and update its title if it changed
            newStructure = mapStructure(newStructure, node => node.path === filePath, node => {
                if (node.title !== frontmatter.title) {
                    manifest_changed = true;
                    return { ...node, title: frontmatter.title };
                }
                return node;
            });
        }
        
        // Persist changes
        set(state => ({
            sites: state.sites.map(s => s.siteId === siteId ? { ...s, contentFiles: updatedContentFiles } : s),
        }));

        if (manifest_changed) {
            await get().updateManifest(siteId, { ...site.manifest, structure: newStructure });
        }

        return true;
      } catch (error) {
        console.error(`Failed to add/update file ${filePath}:`, error);
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
            const site = get().sites.find(s => s.siteId === siteId);
            if (!site) return;

            // Remove node from manifest structure
            const newStructure = filterStructure(site.manifest.structure, node => node.path !== filePath);
            await get().updateManifest(siteId, { ...site.manifest, structure: newStructure });

            // Remove file from contentFiles in state
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

     addNewCollection: async (siteId: string, name: string, slug: string) => {
      const site = get().sites.find(s => s.siteId === siteId);
      if (!site) return;

      const newCollectionNode: StructureNode = {
        type: 'collection',
        title: name.trim(),
        path: `content/${slug}`,
        slug: slug,
        children: [],
        navOrder: site.manifest.structure.length, // Add to the end of the top-level nav
      };
      
      const newStructure = [...site.manifest.structure, newCollectionNode];
      const newManifest = { ...site.manifest, structure: newStructure };
      
      await get().updateManifest(siteId, newManifest);
    },

    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s) => s.siteId === siteId);
    },
  })
);