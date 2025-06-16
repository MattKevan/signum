// src/app/sites/[siteId]/edit/collection/[collectionName]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { EditorProvider, useEditor } from '@/features/editor/contexts/EditorContext';
import { useAutosave } from '@/core/hooks/useAutosave';
import { useUIStore } from '@/core/state/uiStore';
import { useAppStore } from '@/core/state/useAppStore';
import Link from 'next/link';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import LeftSidebar from '@/components/publishing/LeftSidebar';
import PrimaryContentFields from '@/features/editor/components/PrimaryContentFields';
import { toast } from 'sonner';
import { FileText, PlusCircle } from 'lucide-react';
import type { StructureNode, MarkdownFrontmatter } from '@/types';
import { getAvailableLayouts, LayoutManifest } from '@/core/services/configHelpers.service';
import ThreeColumnLayout from '@/components/layout/ThreeColumnLayout';

/**
 * A memoized sub-component that renders the right sidebar UI for editing collection settings.
 * This prevents it from re-rendering unnecessarily when the main page content changes.
 */
const CollectionSettingsSidebar = React.memo(function CollectionSettingsSidebar({
    collectionNodeData,
    availableLayouts,
    onLayoutChange,
    onPrimaryFieldsChange,
}: {
    collectionNodeData: StructureNode,
    availableLayouts: LayoutManifest[],
    onLayoutChange: (newLayoutPath: string) => void,
    onPrimaryFieldsChange: (data: Partial<MarkdownFrontmatter>) => void,
}) {
    // Extract only the fields this component cares about for its own state
    const primaryFields = {
        title: typeof collectionNodeData.title === 'string' ? collectionNodeData.title : '',
        description: typeof collectionNodeData.description === 'string' ? collectionNodeData.description : '',
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
                        <Label htmlFor="item-layout-select">Default Item Layout</Label>
                        <Select value={collectionNodeData.itemLayout} onValueChange={onLayoutChange}>
                            <SelectTrigger id="item-layout-select" className="mt-1">
                                <SelectValue placeholder="Select a layout..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLayouts.map(layout => (
                                    <SelectItem key={layout.name} value={layout.name}>{layout.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground pt-2">
                          This layout will be the default for new items created in this collection.
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground pt-4">This collection is an organizational folder. Its appearance on the site is determined by the &quot;View Pages&quot; that display its content.</p>
                </div>
            </div>
        </div>
    );
});
CollectionSettingsSidebar.displayName = 'CollectionSettingsSidebar';


/**
 * The internal implementation of the collection editor page.
 * It assumes it is rendered within an EditorProvider.
 */
function EditCollectionPageInternal() {
    const params = useParams();
    const router = useRouter();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;
    
    // --- Context and Store Hooks ---
    const { hasUnsavedChanges, setHasUnsavedChanges, registerSaveAction } = useEditor();
    const { 
        setLeftSidebarContent, 
        setRightSidebarContent,
        leftSidebarContent,
        rightSidebarContent
    } = useUIStore((state) => state.sidebar);
    
    const site = useAppStore(state => state.getSiteById(siteId));
    const updateManifest = useAppStore(state => state.updateManifest);

    // --- Component State ---
    const [isDataReady, setIsDataReady] = useState(false);
    const [collectionNodeData, setCollectionNodeData] = useState<StructureNode | null>(null);
    const [availableLayouts, setAvailableLayouts] = useState<LayoutManifest[]>([]);

    const collectionPath = `content/${collectionName}`;
    const originalCollectionNode = useMemo(() => 
        site?.manifest.structure.find((node: StructureNode) => node.path === collectionPath && node.type === 'collection'), 
        [site?.manifest, collectionPath]
    );
    
    useEffect(() => {
        if (site && originalCollectionNode) {
            setCollectionNodeData(originalCollectionNode);
            setHasUnsavedChanges(false);
            setIsDataReady(true);
        } else if (site && !isDataReady && !originalCollectionNode) {
            toast.error(`Collection "${collectionName}" not found.`);
            router.push(`/sites/${siteId}/edit`);
        }
    }, [site, originalCollectionNode, collectionName, siteId, router, setHasUnsavedChanges, isDataReady]);


    // --- Handlers (Memoized for performance) ---
    const handlePrimaryFieldsChange = useCallback((data: Partial<MarkdownFrontmatter>) => {
        setCollectionNodeData(prev => prev ? { ...prev, ...data } : null);
        setHasUnsavedChanges(true);
    }, [setHasUnsavedChanges]);

    const handleLayoutChange = useCallback((newLayoutPath: string) => {
        setCollectionNodeData(prev => prev ? { ...prev, itemLayout: newLayoutPath } : null);
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
        if(site) {
            getAvailableLayouts(site, 'item').then(layouts => {
                setAvailableLayouts(layouts);
            });
        }
    }, [site]);

    useEffect(() => {
        setLeftSidebarContent(<LeftSidebar />);
        if (collectionNodeData) {
            setRightSidebarContent(
                <CollectionSettingsSidebar
                    collectionNodeData={collectionNodeData}
                    availableLayouts={availableLayouts}
                    onLayoutChange={handleLayoutChange}
                    onPrimaryFieldsChange={handlePrimaryFieldsChange}
                />
            );
        } else {
            setRightSidebarContent(null);
        }
        return () => {
            setLeftSidebarContent(null);
            setRightSidebarContent(null);
        };
    }, [collectionNodeData, availableLayouts, handleLayoutChange, handlePrimaryFieldsChange, setLeftSidebarContent, setRightSidebarContent]);
    
    
    if (!isDataReady || !collectionNodeData) {
        return <div className="p-6 flex justify-center items-center h-full"><p>Loading Collection...</p></div>;
    }

    return (
        <ThreeColumnLayout
            leftSidebar={leftSidebarContent}
            rightSidebar={rightSidebarContent}
        >
            <div className="h-full flex flex-col p-6">
                <div className="flex shrink-0 items-center justify-between mb-4">
                    <h1 className="text-3xl font-bold truncate pr-4">Managing: {originalCollectionNode?.title}</h1>
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
        </ThreeColumnLayout>
    );
}

/**
 * Final exported page component that wraps the internal implementation
 * with the necessary EditorProvider context.
 */
export default function EditCollectionPage() {
    return (
        <EditorProvider>
            <EditCollectionPageInternal />
        </EditorProvider>
    );
}