'use client';

import { useParams } from 'next/navigation'; // REMOVED: useRouter as it's not used
import { useAppStore } from '@/stores/useAppStore';
import { useCallback, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { FileText, PlusCircle } from 'lucide-react';
import { StructureNode } from '@/types';
import { getAvailableLayouts, getLayoutSchema, type ThemeLayout } from '@/lib/themeEngine';
import SchemaDrivenForm from '@/components/publishing/SchemaDrivenForm';
import { RJSFSchema } from '@rjsf/utils';

// Define a specific type for the frontmatter of the collection itself.
// This avoids using `any` and makes the component's state clear.
type CollectionFrontmatter = {
    title: string;
    description: string;
    [key: string]: string; // Allow other string-based properties from the schema
};

export default function EditCollectionPage() {
    const params = useParams();
    // const router = useRouter(); // REMOVED: This was unused.
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;

    const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
    const updateManifest = useAppStore(state => state.updateManifest);

    const collectionPath = `content/${collectionName}`;

    // --- State Hooks ---
    const [selectedLayout, setSelectedLayout] = useState('');
    const [availableLayouts, setAvailableLayouts] = useState<ThemeLayout[]>([]);
    // FIXED: Use the specific CollectionFrontmatter type instead of `any`.
    const [collectionFrontmatter, setCollectionFrontmatter] = useState<CollectionFrontmatter>({ title: '', description: '' });
    const [formSchema, setFormSchema] = useState<RJSFSchema | null>(null);

    // --- Memoized Selectors ---
    const collectionNode = useMemo(() => {
        if (!site) return null;
        const findNode = (nodes: StructureNode[]): StructureNode | undefined => {
            for (const node of nodes) {
                if (node.path === collectionPath) return node;
                if (node.children) {
                    const found = findNode(node.children);
                    if (found) return found;
                }
            }
        };
        return findNode(site.manifest.structure);
    }, [site, collectionPath]);

    // --- Effects ---
    useEffect(() => {
        if (site && collectionNode) {
            setSelectedLayout(collectionNode.layout);
            // Populate the frontmatter state from the node in the manifest.
            setCollectionFrontmatter({
                title: collectionNode.title,
                // FIXED: Explicitly cast and provide a fallback to satisfy the type.
                description: (collectionNode as { description?: string }).description || '',
            });

            getAvailableLayouts(site.manifest.theme.name).then(layouts => {
                setAvailableLayouts(layouts.filter(l => l.type === 'collection'));
            });
        }
    }, [collectionNode, site]);

    useEffect(() => {
        async function loadSchema() {
            if (site && selectedLayout) {
                const schemaData = await getLayoutSchema(site.manifest.theme.name, selectedLayout);
                setFormSchema(schemaData?.schema || null);
            }
        }
        loadSchema();
    }, [selectedLayout, site]);

    // --- Event Handlers ---
    const handleSaveChanges = async () => {
        if (!site || !collectionNode) {
            toast.error("Cannot save, collection not found.");
            return;
        }

        const updateNode = (nodes: StructureNode[]): StructureNode[] => {
            return nodes.map(node => {
                if (node.path === collectionPath) {
                    return { 
                        ...node, 
                        layout: selectedLayout,
                        title: collectionFrontmatter.title,
                        // Spread the rest of the frontmatter onto the node for storage.
                        ...(collectionFrontmatter as Omit<CollectionFrontmatter, 'title'>),
                    };
                }
                if (node.children) {
                    return { ...node, children: updateNode(node.children) };
                }
                return node;
            });
        };
        
        const newStructure = updateNode(site.manifest.structure);
        const newManifest = { ...site.manifest, structure: newStructure };
        await updateManifest(siteId, newManifest);

        toast.success(`Collection "${collectionFrontmatter.title}" updated successfully!`);
    };
    
    if (!site || !collectionNode) {
        return <div>Loading collection data...</div>;
    }

    return (
        <div className="flex flex-row h-full gap-6">
            <main className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Editing Collection: {collectionNode.title}</h1>
                    <Button asChild>
                        <Link href={`/edit/${siteId}/content/${collectionName}/_new`}>
                            <PlusCircle className="mr-2 h-4 w-4" /> New Item
                        </Link>
                    </Button>
                </div>
                <div className="flex-grow p-4 border rounded-lg bg-background overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-3">Items in this Collection</h2>
                    {collectionNode.children && collectionNode.children.length > 0 ? (
                        <ul className="space-y-2">
                            {collectionNode.children.map((item: StructureNode) => (
                                <li key={item.path}>
                                    <Link href={`/edit/${siteId}/content/${item.slug}`} className="flex items-center p-2 rounded-md hover:bg-muted transition-colors">
                                        <FileText className="h-4 w-4 mr-3 text-muted-foreground" />
                                        <span className="font-medium">{item.title || item.slug}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No items in this collection yet.</p>
                    )}
                </div>
            </main>

            <aside className="w-80 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
                <h2 className="text-lg font-semibold border-b pb-2">Collection Settings</h2>
                <div>
                    <Label htmlFor="layout-select">Collection Layout</Label>
                    <Select value={selectedLayout} onValueChange={setSelectedLayout}>
                        <SelectTrigger id="layout-select"><SelectValue placeholder="Select a layout..." /></SelectTrigger>
                        <SelectContent>
                            {availableLayouts.map(layout => (
                              <SelectItem key={layout.id} value={layout.id}>{layout.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                {formSchema ? (
                    <SchemaDrivenForm
                        schema={formSchema}
                        formData={collectionFrontmatter}
                        onFormChange={(data) => setCollectionFrontmatter(data as CollectionFrontmatter)}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">Select a layout to see its settings.</p>
                )}

                <Button onClick={handleSaveChanges} className="w-full">Save Collection Settings</Button>
            </aside>
        </div>
    );
}