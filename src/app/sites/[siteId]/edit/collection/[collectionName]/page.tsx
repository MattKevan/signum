// src/app/sites/[siteId]/edit/collection/[collectionName]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useEditor } from '@/features/editor/contexts/EditorContext';
import { useAutosave } from '@/core/hooks/useAutosave';
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeftSidebar from '@/components/publishing/LeftSidebar';
import PrimaryContentFields from '@/features/editor/components/PrimaryContentFields';
import GroupedFrontmatterForm from '@/components/publishing/GroupedFrontmatterFields';
import { toast } from 'sonner';
import { FileText, PlusCircle } from 'lucide-react';
import type { StructureNode, LayoutInfo, MarkdownFrontmatter, LocalSiteData } from '@/types';
import { getAvailableLayouts, getLayoutManifest, type LayoutManifest } from '@/lib/configHelpers';
import { DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

type StableSiteDataForSidebar = Pick<LocalSiteData, 'manifest' | 'layoutFiles' | 'themeFiles'>;

/**
 * A sub-component that renders the right sidebar UI for editing collection settings.
 * It is memoized to prevent re-renders unless its specific props change.
 */
const CollectionSettingsSidebar = React.memo(function CollectionSettingsSidebar({
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
}) {
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
});


/**
 * The main page component for editing a collection's settings and viewing its items.
 * It relies on the parent `SiteLoaderLayout` to command the loading of site data
 * and reacts to that data becoming available in the `useAppStore`.
 */
export default function EditCollectionPage() {
    const params = useParams();
    const router = useRouter();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;
    
    // --- Context and Store Hooks ---
    const { hasUnsavedChanges, setHasUnsavedChanges, registerSaveAction, setLeftSidebar, setRightSidebar } = useEditor();
    const { setLeftAvailable, setRightAvailable } = useUIStore((state) => state.sidebar);
    
    // Subscribe to the site data. This component will re-render when the data is loaded by the parent layout.
    const site = useAppStore(state => state.getSiteById(siteId));
    const updateManifest = useAppStore(state => state.updateManifest);

    // --- Component State ---
    const [isDataReady, setIsDataReady] = useState(false);
    const [collectionNodeData, setCollectionNodeData] = useState<StructureNode | null>(null);
    const [layoutManifest, setLayoutManifest] = useState<LayoutManifest | null>(null);
    const [availableLayouts, setAvailableLayouts] = useState<LayoutInfo[]>([]);

    const collectionPath = `content/${collectionName}`;

    const originalCollectionNode = useMemo(() => {
        if (!site?.manifest) return undefined;
        return site.manifest.structure.find((node: StructureNode) => node.path === collectionPath);
    }, [site?.manifest, collectionPath]);
    
    /**
     * This is the main data orchestrator effect. It *reacts* to the `site` data from the store.
     * It does NOT command data loading.
     */
    useEffect(() => {
        // Guard 1: Wait for the site manifest to be loaded by the parent layout.
        if (!site?.manifest) {
            console.log(`[EditCollectionPage] Waiting for site manifest for ${siteId}...`);
            return;
        }

        // Guard 2: Wait for the site content to be loaded by the parent layout.
        if (!site.contentFiles) {
            console.log(`[EditCollectionPage] Waiting for site content files for ${siteId}...`);
            // The UI will show a loading indicator because isDataReady is false.
            return;
        }

        // --- Data is now guaranteed to be loaded ---
        console.log(`[EditCollectionPage] All required site data is loaded for ${siteId}.`);
        if (originalCollectionNode) {
            setCollectionNodeData(originalCollectionNode);
            setHasUnsavedChanges(false);
            setIsDataReady(true); // Data is ready, we can now render the full UI.
        } else {
            // If content is loaded but we still can't find the node, it's a 404.
            toast.error(`Collection "${collectionName}" not found.`);
            router.push(`/sites/${siteId}/edit`);
        }
    }, [site, originalCollectionNode, collectionName, siteId, router, setHasUnsavedChanges]);


    // --- Handlers (Memoized for performance) ---
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
            throw new Error("Cannot save, essential data not found.");
        }
        const newStructure = site.manifest.structure.map((node: StructureNode) =>
            node.path === collectionPath ? collectionNodeData : node
        );
        const newManifest = { ...site.manifest, structure: newStructure };
        
        await updateManifest(siteId, newManifest);
        //toast.success(`Collection "${collectionNodeData.title}" updated successfully!`);
    }, [site?.manifest, collectionNodeData, collectionPath, siteId, updateManifest]);

    // --- Effect for registering save action and autosave ---
    useEffect(() => {
        registerSaveAction(handleSaveChanges);
    }, [handleSaveChanges, registerSaveAction]);
    
    useAutosave<StructureNode | null>({
        dataToSave: collectionNodeData,
        hasUnsavedChanges,
        isSaveable: !!collectionNodeData,
        onSave: handleSaveChanges,
    });
    
    // --- Effects for loading schemas and setting up sidebars ---
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
    // This is the crucial fix. We show a loading state until isDataReady is true.
    if (!isDataReady || !collectionNodeData) {
        return <div className="p-6 flex justify-center items-center h-full"><p>Loading Collection...</p></div>;
    }

    // --- Main Component Render ---
    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex shrink-0 items-center justify-between mb-4">
                <h1 className="text-3xl font-bold truncate pr-4">Editing: {originalCollectionNode?.title}</h1>
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