// src/stores/useAppStore.ts
import { create } from 'zustand';
import { AppState, LocalSiteData, Manifest, StructureNode, ParsedMarkdownFile } from '@/types';
import * as localSiteFs from '@/lib/localSiteFs';
import { parseMarkdownString, stringifyToMarkdown } from '@/lib/markdownParser'; // FIXED: Added 'stringifyToMarkdown' import
import { RJSFSchema } from '@rjsf/utils'; // FIXED: Import RJSFSchema for type safety

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
      };
      
      const newStructure = [...site.manifest.structure, newCollectionNode];
      const newManifest = { ...site.manifest, structure: newStructure };
      
      await get().updateManifest(siteId, newManifest);
    },
    
    // FIXED: Added 'RJSFSchema' type to avoid 'any'
    addOrUpdateContentFile: async (siteId: string, filePath: string, rawMarkdownContent: string, frontmatterSchema: RJSFSchema): Promise<boolean> => {
      const site = get().sites.find(s => s.siteId === siteId);
      if (!site) return false;

      const { frontmatter: parsedFm, content } = parseMarkdownString(rawMarkdownContent);
      const isNewFile = !site.contentFiles.some(f => f.path === filePath);
      
      if (isNewFile && frontmatterSchema?.properties) {
          for (const [key, prop] of Object.entries(frontmatterSchema.properties)) {
              if (typeof prop === 'object' && prop !== null && 'default' in prop && parsedFm[key] === undefined) {
                  parsedFm[key] = prop.default;
              }
          }
      }
      
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
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));

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
                layout: parentNode.itemLayout || 'page',
              },
            ],
          };
        });
        
        if (!parentFound) {
            newStructure.push({ type: 'page', title: parsedFm.title, path: filePath, slug: fileSlug, layout: 'page' });
        }
      } else {
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