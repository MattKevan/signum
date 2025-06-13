'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/useAppStore';

// --- Component Imports ---
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeftSidebar from '@/components/publishing/LeftSidebar';
import PrimaryContentFields from '@/components/publishing/PrimaryContentFields';
import GroupedFrontmatterForm from '@/components/publishing/GroupedFrontmatterFields';

// --- Type, Util, and Config Imports ---
import { toast } from 'sonner';
import { FileText, PlusCircle, Save } from 'lucide-react';
import type { StructureNode, LayoutInfo, MarkdownFrontmatter, LocalSiteData } from '@/types';
import { getAvailableLayouts, getLayoutManifest, type LayoutManifest } from '@/lib/configHelpers';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

// A helper type for the stable data we need for the sidebar
type StableSiteDataForSidebar = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

const CollectionSettingsSidebar = ({
    collectionNodeData,
    availableLayouts,
    layoutManifest,
    hasChanges,
    onLayoutChange,
    onPrimaryFieldsChange,
    onFormChange,
    onSaveChanges
}: {
    collectionNodeData: StructureNode,
    availableLayouts: LayoutInfo[],
    layoutManifest: LayoutManifest | null,
    hasChanges: boolean,
    onLayoutChange: (newLayoutPath: string) => void,
    onPrimaryFieldsChange: (data: Partial<MarkdownFrontmatter>) => void,
    onFormChange: (data: Partial<StructureNode>) => void,
    onSaveChanges: () => void,
}) => {
    const { title, description, ...otherFields } = collectionNodeData;
    const primaryFields = {
        title: typeof title === 'string' ? title : '',
        description: typeof description === 'string' ? description : '',
    };
    return (
        <div className="flex h-full flex-col p-4">
            <div className="flex-grow space-y-6">
                <h2 className="text-lg font-semibold border-b pb-3">Collection Settings</h2>
                <div className="space-y-4">
                    <PrimaryContentFields
                        frontmatter={primaryFields}
                        onFrontmatterChange={onPrimaryFieldsChange}
                        showDescription={true}
                    />
                </div>
                <div className="border-t pt-4 space-y-4">
                    <div>
                        <Label htmlFor="layout-select">Collection Layout</Label>
                        <Select value={collectionNodeData.layout} onValueChange={onLayoutChange}>
                            <SelectTrigger id="layout-select" className="mt-1">
                                <SelectValue placeholder="Select a layout..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLayouts.map(layout => (
                                    <SelectItem key={layout.path} value={layout.path}>{layout.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {layoutManifest?.layoutSchema ? (
                        <GroupedFrontmatterForm
                            schema={layoutManifest.layoutSchema}
                            uiSchema={layoutManifest.uiSchema}
                            formData={otherFields}
                            onFormChange={onFormChange}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground pt-4">This layout has no additional settings.</p>
                    )}
                </div>
            </div>
            <div className="mt-auto pt-4">
                <Button onClick={onSaveChanges} disabled={!hasChanges} className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    {hasChanges ? 'Save Settings' : 'Settings up to date'}
                </Button>
            </div>
        </div>
    );
};

export default function EditCollectionPage() {
    const params = useParams();
    const router = useRouter();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;
    
    // --- Store and Context Hooks ---
    const { setLeftSidebar, setRightSidebar } = useLayout();
    const setLeftAvailable = useUIStore((state) => state.sidebar.setLeftAvailable);
    const setRightAvailable = useUIStore((state) => state.sidebar.setRightAvailable);
    
    // --- START OF FIX: Select stable data individually ---
    const manifest = useAppStore(state => state.getSiteById(siteId)?.manifest);
    const layoutFiles = useAppStore(state => state.getSiteById(siteId)?.layoutFiles);
    const themeFiles = useAppStore(state => state.getSiteById(siteId)?.themeFiles);
    const { updateManifest } = useAppStore.getState();
    // --- END OF FIX ---

    // --- State Management ---
    const collectionPath = `content/${collectionName}`;
    const [collectionNodeData, setCollectionNodeData] = useState<StructureNode | null>(null);
    const [layoutManifest, setLayoutManifest] = useState<LayoutManifest | null>(null);
    const [availableLayouts, setAvailableLayouts] = useState<LayoutInfo[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    const originalCollectionNode = useMemo(() => {
        // --- FIX: Use the individually selected `manifest` ---
        return manifest?.structure.find((node: StructureNode) => node.path === collectionPath);
    }, [manifest?.structure, collectionPath]);

    // --- Handlers (wrapped in useCallback for stability) ---
    const handleFormChange = useCallback((data: Partial<StructureNode>) => {
        setCollectionNodeData(prev => prev ? { ...prev, ...data } : null);
        setHasChanges(true);
    }, []);

    const handlePrimaryFieldsChange = useCallback((data: Partial<MarkdownFrontmatter>) => {
        setCollectionNodeData(prev => prev ? { ...prev, ...data } : null);
        setHasChanges(true);
    }, []);

    const handleLayoutChange = useCallback((newLayoutPath: string) => {
        setCollectionNodeData(prev => prev ? { 
            ...prev, 
            layout: newLayoutPath,
            itemLayout: DEFAULT_PAGE_LAYOUT_PATH
        } : null);
        setHasChanges(true);
    }, []);

    const handleSaveChanges = useCallback(async () => {
        if (!manifest || !collectionNodeData) {
            toast.error("Cannot save, data not found.");
            return;
        }
        // --- FIX: Use the individually selected `manifest` and type `node` ---
        const newStructure = manifest.structure.map((node: StructureNode) =>
            node.path === collectionPath ? collectionNodeData : node
        );
        const newManifest = { ...manifest, structure: newStructure };
        try {
            await updateManifest(siteId, newManifest);
            setHasChanges(false);
            toast.success(`Collection "${collectionNodeData.title}" updated successfully!`);
        } catch (error) {
            toast.error(`Failed to update collection: ${(error as Error).message}`);
        }
    }, [manifest, collectionNodeData, collectionPath, siteId, updateManifest]);

    // --- Effects ---
    useEffect(() => {
        if (originalCollectionNode) {
            setCollectionNodeData(originalCollectionNode);
            setHasChanges(false);
        } else if (manifest) {
            toast.error(`Collection "${collectionName}" not found.`);
            router.push(`/sites/${siteId}/edit`);
        }
    }, [originalCollectionNode, manifest, collectionName, siteId, router]);
    
    useEffect(() => {
        if(manifest) {
            const allLayouts = getAvailableLayouts(manifest);
            setAvailableLayouts(allLayouts.filter((l: LayoutInfo) => l.type === 'collection'));
        }
    }, [manifest]);

    useEffect(() => {
        async function loadSchema() {
            if (manifest && layoutFiles && themeFiles && collectionNodeData?.layout) {
                const siteForAssets: StableSiteDataForSidebar = { manifest, layoutFiles, themeFiles };
                const loadedManifest = await getLayoutManifest(siteForAssets, collectionNodeData.layout);
                setLayoutManifest(loadedManifest);
            }
        }
        loadSchema();
    }, [collectionNodeData?.layout, manifest, layoutFiles, themeFiles]);

    useEffect(() => {
        setLeftAvailable(true);
        setLeftSidebar(<LeftSidebar />);
        if (collectionNodeData) {
            setRightAvailable(true);
            setRightSidebar(
                <CollectionSettingsSidebar
                    collectionNodeData={collectionNodeData}
                    availableLayouts={availableLayouts}
                    layoutManifest={layoutManifest}
                    hasChanges={hasChanges}
                    onLayoutChange={handleLayoutChange}
                    onPrimaryFieldsChange={handlePrimaryFieldsChange}
                    onFormChange={handleFormChange}
                    onSaveChanges={handleSaveChanges}
                />
            );
        } else {
            setRightAvailable(false);
            setRightSidebar(null);
        }
        return () => {
            setLeftAvailable(false);
            setRightAvailable(false);
            setLeftSidebar(null);
            setRightSidebar(null);
        };
    // --- FIX: Added all missing function dependencies ---
    }, [collectionNodeData, availableLayouts, layoutManifest, hasChanges, handleLayoutChange, handlePrimaryFieldsChange, handleFormChange, handleSaveChanges, setLeftAvailable, setRightAvailable, setLeftSidebar, setRightSidebar]);
    
    // --- Render Logic ---
    if (!manifest || !collectionNodeData) {
        return <div className="p-6">Loading collection data...</div>;
    }

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex shrink-0 items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Editing Collection: {originalCollectionNode?.title}</h1>
                <Button asChild>
                    <Link href={`/sites/${siteId}/edit/content/${collectionName}/_new`}>
                        <PlusCircle className="mr-2 h-4 w-4" /> New Item
                    </Link>
                </Button>
            </div>
            <div className="flex-grow rounded-lg bg-background p-4 border overflow-y-auto">
                <h2 className="text-lg font-semibold mb-3">Items in this Collection</h2>
                {collectionNodeData.children && collectionNodeData.children.length > 0 ? (
                    <ul className="space-y-2">
                        {collectionNodeData.children.map((item: StructureNode) => {
                            const relativePath = item.path.replace(/^content\//, '').replace(/\.md$/, '');
                            return (
                                <li key={item.path}>
                                    <Link href={`/sites/${siteId}/edit/content/${relativePath}`} className="flex items-center rounded-md p-2 transition-colors hover:bg-muted">
                                        <FileText className="mr-3 h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{item.title || item.slug}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="text-center text-muted-foreground py-8">No items have been added to this collection yet.</p>
                )}
            </div>
        </div>
    );
}