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
import { getAvailableLayouts, getLayoutManifest, type LayoutInfo, type LayoutManifest } from '@/lib/themeEngine';
import PrimaryContentFields from '@/components/publishing/PrimaryContentFields';
import GroupedFrontmatterForm from '@/components/publishing/GroupedFrontmatterFields';
//import { RJSFSchema } from '@rjsf/utils';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

export default function EditCollectionPage() {
    const params = useParams();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;

    const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
    const updateManifest = useAppStore(state => state.updateManifest);
    const collectionPath = `content/${collectionName}`;

    // --- State Hooks ---
    const [collectionNodeData, setCollectionNodeData] = useState<StructureNode | null>(null);
    const [layoutManifest, setLayoutManifest] = useState<LayoutManifest | null>(null);
    const [availableLayouts, setAvailableLayouts] = useState<LayoutInfo[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // --- Memoized Selectors ---
    const originalCollectionNode = useMemo(() => {
        return site?.manifest.structure.find(node => node.path === collectionPath);
    }, [site, collectionPath]);

    // --- Effects ---

    useEffect(() => {
        if (originalCollectionNode) {
            setCollectionNodeData(originalCollectionNode);
            setHasChanges(false);
        }
    }, [originalCollectionNode]);
    
    useEffect(() => {
        if(site) {
            const allLayouts = getAvailableLayouts(site.manifest);
            setAvailableLayouts(allLayouts.filter(l => l.type === 'collection'));
        }
    }, [site]);

    useEffect(() => {
        async function loadSchema() {
            if (site && collectionNodeData?.layout) {
                const manifest = await getLayoutManifest(site, collectionNodeData.layout);
                setLayoutManifest(manifest);
            }
        }
        loadSchema();
    }, [collectionNodeData?.layout, site]);

    // --- Event Handlers ---

    // This handler receives data from the schema-driven form for "other" fields
    const handleFormChange = (data: Partial<StructureNode>) => {
        setCollectionNodeData(prev => prev ? { ...prev, ...data } : null);
        setHasChanges(true);
    };

    // This handler specifically receives data from the PrimaryContentFields component
    const handlePrimaryFieldsChange = (data: { title?: string; description?: string }) => {
        setCollectionNodeData(prev => prev ? { ...prev, ...data } : null);
        setHasChanges(true);
    };

    const handleLayoutChange = (newLayoutPath: string) => {
        setCollectionNodeData(prev => prev ? { 
            ...prev, 
            layout: newLayoutPath,
            itemLayout: DEFAULT_PAGE_LAYOUT_PATH 
        } : null);
        setHasChanges(true);
    }

    const handleSaveChanges = async () => {
        if (!site || !collectionNodeData) {
            toast.error("Cannot save, data not found.");
            return;
        }

        const newStructure = site.manifest.structure.map(node =>
            node.path === collectionPath ? collectionNodeData : node
        );
        
        const newManifest = { ...site.manifest, structure: newStructure };
        
        try {
            await updateManifest(siteId, newManifest);
            setHasChanges(false);
            toast.success(`Listing "${collectionNodeData.title}" updated successfully!`);
        } catch (error) {
            toast.error(`Failed to update listing: ${(error as Error).message}`);
        }
    };
    
    if (!site || !collectionNodeData) {
        return <div className="p-6">Loading listing data...</div>;
    }

    // FIX: Destructure the properties and ensure they are the correct type for child components.
    const { title, description, ...otherFields } = collectionNodeData;
    const primaryFields = {
        title: typeof title === 'string' ? title : '',
        description: typeof description === 'string' ? description : '',
    };

    return (
        <div className="flex flex-row h-full gap-6">
            <main className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Editing Listing: {originalCollectionNode?.title}</h1>
                    <Button asChild>
                        <Link href={`/edit/${siteId}/content/${collectionName}/_new`}>
                            <PlusCircle className="mr-2 h-4 w-4" /> New Item
                        </Link>
                    </Button>
                </div>
                <div className="flex-grow p-4 border rounded-lg bg-background overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-3">Items in this Listing</h2>
                    {collectionNodeData.children && collectionNodeData.children.length > 0 ? (
                        <ul className="space-y-2">
                            {collectionNodeData.children.map((item: StructureNode) => {
                                const relativePath = item.path.replace(/^content\//, '').replace(/\.md$/, '');
                                return (
                                    <li key={item.path}>
                                        <Link href={`/edit/${siteId}/content/${relativePath}`} className="flex items-center p-2 rounded-md hover:bg-muted transition-colors">
                                            <FileText className="h-4 w-4 mr-3 text-muted-foreground" />
                                            <span className="font-medium">{item.title || item.slug}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No items have been added to this listing yet.</p>
                    )}
                </div>
            </main>

            <aside className="w-96 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
                <div className="space-y-4">
                     <PrimaryContentFields
                        frontmatter={primaryFields}
                        onFrontmatterChange={handlePrimaryFieldsChange}
                        showDescription={true}
                    />
                </div>
                
                <div className="border-t pt-4 space-y-4">
                    <div>
                        <Label htmlFor="layout-select">Listing Layout</Label>
                        <Select value={collectionNodeData.layout} onValueChange={handleLayoutChange}>
                            <SelectTrigger id="layout-select" className="mt-1">
                                <SelectValue placeholder="Select a layout..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLayouts.map(layout => (
                                    <SelectItem key={layout.id} value={layout.path}>
                                        {layout.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {layoutManifest?.layoutSchema ? (
                        <GroupedFrontmatterForm
                            schema={layoutManifest.layoutSchema}
                            uiSchema={layoutManifest.uiSchema}
                            formData={otherFields}
                            onFormChange={handleFormChange}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground pt-4">This layout has no additional settings.</p>
                    )}
                </div>

                <Button onClick={handleSaveChanges} disabled={!hasChanges} className="w-full">
                    {hasChanges ? 'Save Listing Settings' : 'Settings up to date'}
                </Button>
            </aside>
        </div>
    );
}