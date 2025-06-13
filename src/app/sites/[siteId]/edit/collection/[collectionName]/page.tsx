// src/app/sites/[siteId]/edit/collection/[collectionName]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { useAutosave } from '@/hooks/useAutosave';
import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/useAppStore';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeftSidebar from '@/components/publishing/LeftSidebar';
import PrimaryContentFields from '@/components/publishing/PrimaryContentFields';
import GroupedFrontmatterForm from '@/components/publishing/GroupedFrontmatterFields';
import { toast } from 'sonner';
import { FileText, PlusCircle } from 'lucide-react';
import type { StructureNode, LayoutInfo, MarkdownFrontmatter, LocalSiteData } from '@/types';
import { getAvailableLayouts, getLayoutManifest, type LayoutManifest } from '@/lib/configHelpers';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

type StableSiteDataForSidebar = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

// This sub-component renders the right sidebar UI for editing collection settings.
const CollectionSettingsSidebar = ({
    collectionNodeData,
    availableLayouts,
    layoutManifest,
    onLayoutChange,
    onPrimaryFieldsChange,
    onFormChange,
}: {
    collectionNodeData: StructureNode,
    availableLayouts: LayoutInfo[],
    layoutManifest: LayoutManifest | null,
    onLayoutChange: (newLayoutPath: string) => void,
    onPrimaryFieldsChange: (data: Partial<MarkdownFrontmatter>) => void,
    onFormChange: (data: Partial<StructureNode>) => void,
}) => {
    // Extract fields that are handled by dedicated components vs. the generic form.
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
        </div>
    );
};

export default function EditCollectionPage() {
    const params = useParams();
    const router = useRouter();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;
    
    const { hasUnsavedChanges, setHasUnsavedChanges, registerSaveAction, setLeftSidebar, setRightSidebar } = useEditor();
    const { setLeftAvailable, setRightAvailable } = useUIStore((state) => state.sidebar);
    
    const site = useAppStore(state => state.getSiteById(siteId));
    const loadContentForSite = useAppStore((state) => state.loadContentForSite);
    const { updateManifest } = useAppStore.getState();

    // State to manage the loading process and prevent rendering until data is ready.
    const [isDataReady, setIsDataReady] = useState(false);
    const [collectionNodeData, setCollectionNodeData] = useState<StructureNode | null>(null);
    const [layoutManifest, setLayoutManifest] = useState<LayoutManifest | null>(null);
    const [availableLayouts, setAvailableLayouts] = useState<LayoutInfo[]>([]);

    const collectionPath = `content/${collectionName}`;
    const originalCollectionNode = useMemo(() => {
        if (!site?.manifest) return undefined;
        return site.manifest.structure.find((node: StructureNode) => node.path === collectionPath);
    }, [site?.manifest, collectionPath]);
    
    // Effect 1: The main data orchestrator. It triggers lazy-loading and sets the initial state.
    useEffect(() => {
        async function loadData() {
            if (!site) return; // Wait for the manifest to be loaded first.

            // *** THE KEY FIX ***
            // If content isn't loaded, trigger the load and wait for the hook to re-run.
            if (!site.contentFiles) {
                await loadContentForSite(siteId);
                return; // Let the hook re-run after the store updates with content.
            }

            // At this point, contentFiles are guaranteed to be loaded.
            if (originalCollectionNode) {
                setCollectionNodeData(originalCollectionNode);
                setHasUnsavedChanges(false);
                setIsDataReady(true); // Data is ready, we can now render.
            } else if (site.contentFiles) {
                // If content is loaded but we still can't find the node, it's a 404.
                toast.error(`Collection "${collectionName}" not found.`);
                router.push(`/sites/${siteId}/edit`);
            }
        }
        loadData();
    }, [site, originalCollectionNode, collectionName, siteId, router, loadContentForSite, setHasUnsavedChanges]);

    const handleFormChange = useCallback((data: Partial<StructureNode>) => {
        setCollectionNodeData(prev => prev ? { ...prev, ...data } : null);
        setHasUnsavedChanges(true);
    }, [setHasUnsavedChanges]);

    const handlePrimaryFieldsChange = useCallback((data: Partial<MarkdownFrontmatter>) => {
        setCollectionNodeData(prev => prev ? { ...prev, ...data } : null);
        setHasUnsavedChanges(true);
    }, [setHasUnsavedChanges]);

    const handleLayoutChange = useCallback((newLayoutPath: string) => {
        setCollectionNodeData(prev => prev ? { ...prev, layout: newLayoutPath, itemLayout: DEFAULT_PAGE_LAYOUT_PATH } : null);
        setHasUnsavedChanges(true);
    }, [setHasUnsavedChanges]);

    const handleSaveChanges = useCallback(async () => {
        if (!site?.manifest || !collectionNodeData) {
            throw new Error("Cannot save, data not found.");
        }
        const newStructure = site.manifest.structure.map((node: StructureNode) =>
            node.path === collectionPath ? collectionNodeData : node
        );
        const newManifest = { ...site.manifest, structure: newStructure };
        
        await updateManifest(siteId, newManifest);
        toast.success(`Collection "${collectionNodeData.title}" updated successfully!`);
    }, [site?.manifest, collectionNodeData, collectionPath, siteId, updateManifest]);

    useEffect(() => {
        registerSaveAction(handleSaveChanges);
    }, [handleSaveChanges, registerSaveAction]);
    
    useAutosave<StructureNode | null>({
        dataToSave: collectionNodeData,
        hasUnsavedChanges,
        isSaveable: !!collectionNodeData,
        onSave: handleSaveChanges,
    });
    
    useEffect(() => {
        if(site?.manifest) {
            const allLayouts = getAvailableLayouts(site.manifest);
            setAvailableLayouts(allLayouts.filter((l: LayoutInfo) => l.type === 'collection'));
        }
    }, [site?.manifest]);

    useEffect(() => {
        async function loadSchema() {
            if (site?.manifest && site.layoutFiles && site.themeFiles && collectionNodeData?.layout) {
                const siteForAssets: StableSiteDataForSidebar = { manifest: site.manifest, layoutFiles: site.layoutFiles, themeFiles: site.themeFiles };
                const loadedManifest = await getLayoutManifest(siteForAssets, collectionNodeData.layout);
                setLayoutManifest(loadedManifest);
            }
        }
        loadSchema();
    }, [collectionNodeData?.layout, site?.manifest, site?.layoutFiles, site?.themeFiles]);

    // This effect manages setting the sidebars. It depends on `collectionNodeData` which is only set when ready.
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
                    onLayoutChange={handleLayoutChange}
                    onPrimaryFieldsChange={handlePrimaryFieldsChange}
                    onFormChange={handleFormChange}
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
    }, [collectionNodeData, availableLayouts, layoutManifest, handleLayoutChange, handlePrimaryFieldsChange, handleFormChange, setLeftAvailable, setRightAvailable, setLeftSidebar, setRightSidebar]);
    
    // --- RENDER GUARD ---
    // This is the crucial fix. We show a loading state until `isDataReady` is true.
    if (!isDataReady || !collectionNodeData) {
        return <div className="p-6 flex justify-center items-center h-full"><p>Loading Collection Content...</p></div>;
    }

    // Main component render, safe to access all data now.
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