// src/stores/useAppStore.ts
import { create } from 'zustand';
import { AppState, LocalSiteData, Manifest, StructureNode, ParsedMarkdownFile } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs';
import { parseMarkdownString, stringifyToMarkdown } from '@/lib/markdownParser';
import { getParentPath } from '@/lib/fileTreeUtils';

// Helper function to recursively find and update a node in the structure tree.
const mapStructure = (nodes: StructureNode[], predicate: (node: StructureNode) => boolean, transform: (node: StructureNode) => StructureNode): StructureNode[] => {
  return nodes.map(node => {
    let transformedNode = node;
    if (predicate(node)) {
      transformedNode = transform(node);
    }
    if (transformedNode.children) {
      transformedNode.children = mapStructure(transformedNode.children, predicate, transform);
    }
    return transformedNode;
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
        layout: layout,
        itemLayout: 'page', // Default item layout for new collections
      };
      
      const newStructure = [...site.manifest.structure, newCollectionNode];
      const newManifest = { ...site.manifest, structure: newStructure };
      
      await get().updateManifest(siteId, newManifest);
    },
    
    // UPDATED: Signature now includes layoutId.
    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string, layoutId: string): Promise<boolean> => {
      const site = get().sites.find(s => s.siteId === siteId);
      if (!site) return false;

      const { frontmatter: parsedFm, content } = parseMarkdownString(rawMarkdownContent);
      const isNewFile = !site.contentFiles.some(f => f.path === filePath);
      
      const fileSlug = filePath.substring(filePath.lastIndexOf('/') + 1).replace('.md', '');
      const savedFile: ParsedMarkdownFile = { slug: fileSlug, path: filePath, frontmatter: parsedFm, content };

      await localSiteFs.saveContentFile(siteId, filePath, stringifyToMarkdown(parsedFm, content));
      
      const updatedContentFiles = isNewFile
          ? [...site.contentFiles, savedFile]
          : site.contentFiles.map(f => f.path === filePath ? savedFile : f);
      set(state => ({
        sites: state.sites.map(s => s.siteId === siteId ? { ...s, contentFiles: updatedContentFiles } : s),
      }));

      let manifestChanged = false;
      let newStructure = site.manifest.structure;

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
                title: parsedFm.title,
                path: filePath,
                slug: fileSlug,
                layout: layoutId, // Use the provided layoutId
              },
            ],
          };
        });
        
        // If no parent was found (e.g., a new top-level page), add it to the root.
        if (!parentFound && parentPath === 'content') {
            newStructure.push({ type: 'page', title: parsedFm.title, path: filePath, slug: fileSlug, layout: layoutId, navOrder: newStructure.length });
        }
      } else {
        // If an existing file's title changed, update it in the manifest.
        newStructure = mapStructure(site.manifest.structure, node => node.path === filePath, node => {
          if (node.title !== parsedFm.title) {
            manifestChanged = true;
            return { ...node, title: parsedFm.title };
          }
          return node;
        });
      }

      if (manifestChanged) {
        await get().updateManifest(siteId, { ...site.manifest, structure: newStructure });
      }

      return true;
    },
    
    deleteContentFileAndState: async (siteId: string, filePath: string) => {
      await localSiteFs.deleteContentFile(siteId, filePath);
      const site = get().sites.find(s => s.siteId === siteId);
      if (!site) return;

      const newStructure = filterStructure(site.manifest.structure, node => node.path !== filePath);
      await get().updateManifest(siteId, { ...site.manifest, structure: newStructure });

      set(state => ({
          sites: state.sites.map(s => {
              if (s.siteId === siteId) {
                  return { ...s, contentFiles: s.contentFiles.filter(f => f.path !== filePath) };
              }
              return s;
          }),
      }));
    },
    
    deleteSiteAndState: async (siteId: string) => {
        await localSiteFs.deleteSite(siteId);
        set(state => ({
            sites: state.sites.filter(s => s.siteId !== siteId),
        }));
    },

    getSiteById: (siteId: string): LocalSiteData | undefined => {
      return get().sites.find((s) => s.siteId === siteId);
    },
  })
);