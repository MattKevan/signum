'use client';

import { useParams } from 'next/navigation';
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

type CollectionFrontmatter = {
    title: string;
    description?: string;
    [key: string]: unknown;
};

export default function EditCollectionPage() {
    const params = useParams();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;

    const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
    const updateManifest = useAppStore(state => state.updateManifest);

    const collectionPath = `content/${collectionName}`;

    // --- State Hooks ---
    const [selectedCollectionLayout, setSelectedCollectionLayout] = useState('');
    const [selectedItemLayout, setSelectedItemLayout] = useState('');
    const [availableCollectionLayouts, setAvailableCollectionLayouts] = useState<ThemeLayout[]>([]);
    const [availablePageLayouts, setAvailablePageLayouts] = useState<ThemeLayout[]>([]);
    const [collectionFrontmatter, setCollectionFrontmatter] = useState<CollectionFrontmatter>({ title: '' });
    const [formSchema, setFormSchema] = useState<RJSFSchema | null>(null);

    // --- Memoized Selectors ---
    const collectionNode = useMemo(() => {
        return site?.manifest.structure.find(node => node.path === collectionPath);
    }, [site, collectionPath]);

    // --- Effects ---
    useEffect(() => {
        if (site && collectionNode) {
            setSelectedCollectionLayout(collectionNode.layout);
            setSelectedItemLayout(collectionNode.itemLayout as string || 'page');
            
            setCollectionFrontmatter({
                ...collectionNode,
                title: collectionNode.title,
                description: collectionNode.description as string || '',
            });

             getAvailableLayouts(site.manifest.theme.name, site.manifest.theme.type).then(layouts => {
                setAvailableCollectionLayouts(layouts.filter(l => l.type === 'collection'));
                setAvailablePageLayouts(layouts.filter(l => l.type === 'page'));
            });
        }
    }, [collectionNode, site]);

    useEffect(() => {
        async function loadSchema() {
            if (site && selectedCollectionLayout) {
                const schemaData = await getLayoutSchema(site.manifest.theme.name, site.manifest.theme.type, selectedCollectionLayout);
                setFormSchema(schemaData?.schema || null);
            }
        }
        loadSchema();
    }, [selectedCollectionLayout, site]);

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
                        ...collectionFrontmatter,
                        layout: selectedCollectionLayout,
                        itemLayout: selectedItemLayout,
                    };
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
                            {collectionNode.children.map((item: StructureNode) => {
                                // CORRECTED: Generate the link from the full relative path to handle nested content correctly.
                                const relativeContentPath = item.path.replace(/^content\//, '').replace(/\.md$/, '');
                                return (
                                    <li key={item.path}>
                                        <Link href={`/edit/${siteId}/content/${relativeContentPath}`} className="flex items-center p-2 rounded-md hover:bg-muted transition-colors">
                                            <FileText className="h-4 w-4 mr-3 text-muted-foreground" />
                                            <span className="font-medium">{item.title || item.slug}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No items in this collection yet.</p>
                    )}
                </div>
            </main>

            <aside className="w-80 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
                <h2 className="text-lg font-semibold border-b pb-2">Collection Settings</h2>
                
                <div>
                    <Label htmlFor="collection-layout-select">Listing Page Layout</Label>
                    <Select value={selectedCollectionLayout} onValueChange={setSelectedCollectionLayout}>
                        <SelectTrigger id="collection-layout-select"><SelectValue placeholder="Select a layout..." /></SelectTrigger>
                        <SelectContent>
                            {availableCollectionLayouts.map(layout => (
                              <SelectItem key={layout.id} value={layout.id}>{layout.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div>
                    <Label htmlFor="item-layout-select">Default Layout for Items</Label>
                    <Select value={selectedItemLayout} onValueChange={setSelectedItemLayout}>
                        <SelectTrigger id="item-layout-select"><SelectValue placeholder="Select a layout..." /></SelectTrigger>
                        <SelectContent>
                            {availablePageLayouts.map(layout => (
                              <SelectItem key={layout.id} value={layout.id}>{layout.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">This layout will be used for all new items created in this collection.</p>
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