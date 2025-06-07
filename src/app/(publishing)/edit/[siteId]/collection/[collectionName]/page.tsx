// src/app/(publishing)/edit/[siteId]/collection/[collectionName]/page.tsx
'use client';

import { useParams,  } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { useCallback, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { FileText, PlusCircle } from 'lucide-react';
import { StructureNode } from '@/types'; // Import StructureNode

export default function EditCollectionPage() {
    const params = useParams();
    //const router = useRouter();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;

    const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
    const updateManifest = useAppStore(state => state.updateManifest);

    const collectionPath = `content/${collectionName}`;

    const collectionNode = useMemo(() => {
        if (!site) return null;
        return site.manifest.structure.find(node => node.path === collectionPath);
    }, [site, collectionPath]);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    useEffect(() => {
        if (collectionNode) {
            setTitle(collectionNode.title || '');
            setDescription(collectionNode.description || '');
            setSortBy(collectionNode.sortBy || 'date');
            setSortOrder(collectionNode.sortOrder || 'desc');
        }
    }, [collectionNode]);
    
    const handleSaveChanges = async () => {
        if (!site || !collectionNode) {
            toast.error("Cannot save, collection configuration not found.");
            return;
        }

        // Create a new structure array with the updated node
        const newStructure = site.manifest.structure.map(node => {
            if (node.path === collectionPath) {
                return {
                    ...node,
                    title: title.trim(),
                    description: description.trim(),
                    sortBy,
                    sortOrder,
                };
            }
            return node;
        });
        
        const newManifest = { ...site.manifest, structure: newStructure };
        await updateManifest(siteId, newManifest);

        toast.success(`Collection "${collectionName}" updated successfully!`);
    };
    
    if (!site || !collectionNode) {
        return <div>Loading collection data or collection not found...</div>;
    }

    const displayTitle = title || collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

    return (
        <div className="flex flex-row h-full gap-6">
            <main className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Editing Collection: {displayTitle}</h1>
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
                        <p className="text-muted-foreground text-center py-8">No items in this collection yet. Click &quot;New Item&quot; to start.</p>
                    )}
                </div>
            </main>

            <aside className="w-80 border-l bg-muted/20 p-4 space-y-6 overflow-y-auto h-full shrink-0">
                <h2 className="text-lg font-semibold border-b pb-2">Collection Settings</h2>
                <div>
                    <Label htmlFor="title">Display Title</Label>
                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Blog Posts" />
                    <p className="text-xs text-muted-foreground mt-1">How this collection appears in the site menu and on its page.</p>
                </div>
                <div>
                    <Label htmlFor="description">Listing Page Description</Label>
                    <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="A short description for the top of the collection page." rows={4} />
                </div>
                 <div>
                    <Label>Sort Items By</Label>
                    <div className="flex gap-2 mt-1">
                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'title')}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="title">Title</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="desc">Descending</SelectItem>
                                <SelectItem value="asc">Ascending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={handleSaveChanges} className="w-full">Save Collection Settings</Button>
            </aside>
        </div>
    );
}