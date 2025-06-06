// src/app/(publishing)/edit/[siteId]/collection/[collectionName]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
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

export default function EditCollectionPage() {
    const params = useParams();
    const router = useRouter();
    const siteId = params.siteId as string;
    const collectionName = params.collectionName as string;

    const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
    const updateSiteConfig = useAppStore(state => state.updateSiteConfig);

    const collectionPath = `content/${collectionName}`;

    const collectionData = useMemo(() => {
        if (!site) return null;
        const collectionConfig = site.config.collections?.find(c => c.path === collectionName);
        const items = site.contentFiles.filter(f => 
            f.path.startsWith(`${collectionPath}/`) && !f.path.endsWith('/index.md')
        );
        return { config: collectionConfig, items };
    }, [site, collectionName, collectionPath]);

    // Form state
    const [navLabel, setNavLabel] = useState('');
    const [description, setDescription] = useState('');
    const [sortBy, setSortBy] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc');
    
    useEffect(() => {
        if (collectionData?.config) {
            setNavLabel(collectionData.config.nav_label || '');
            setDescription(collectionData.config.description || '');
            setSortBy(collectionData.config.sort_by || 'date');
            setSortOrder(collectionData.config.sort_order || 'desc');
        }
    }, [collectionData]);
    
    const handleSaveChanges = async () => {
        if (!site || !collectionData?.config) {
            toast.error("Cannot save, collection configuration not found.");
            return;
        }

        const newCollections = (site.config.collections || []).map(c => {
            if (c.path === collectionName) {
                return {
                    ...c,
                    nav_label: navLabel.trim() || collectionName,
                    description: description.trim(),
                    sort_by: sortBy,
                    sort_order: sortOrder as 'asc' | 'desc',
                };
            }
            return c;
        });
        
        const newSiteConfig = { ...site.config, collections: newCollections };
        await updateSiteConfig(siteId, newSiteConfig);

        toast.success(`Collection "${collectionName}" updated successfully!`);
    };
    
    if (!site || !collectionData?.config) {
        return <div>Loading collection data or collection not found...</div>;
    }

    const title = navLabel || collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

    return (
        <div className="flex flex-row h-full gap-6">
            <main className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Editing Collection: {title}</h1>
                    <Button asChild>
                        <Link href={`/edit/${siteId}/content/${collectionName}/_new`}>
                            <PlusCircle className="mr-2 h-4 w-4" /> New Item
                        </Link>
                    </Button>
                </div>
                <div className="flex-grow p-4 border rounded-lg bg-background overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-3">Items in this Collection</h2>
                    {collectionData.items.length > 0 ? (
                        <ul className="space-y-2">
                            {collectionData.items.map(item => (
                                <li key={item.path}>
                                    <Link href={`/edit/${siteId}/content/${item.path.replace('content/', '').replace('.md', '')}`} className="flex items-center p-2 rounded-md hover:bg-muted transition-colors">
                                        <FileText className="h-4 w-4 mr-3 text-muted-foreground" />
                                        <span className="font-medium">{item.frontmatter.title || item.slug}</span>
                                        <span className="text-sm text-muted-foreground ml-auto">{item.frontmatter.date}</span>
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
                    <Label htmlFor="navLabel">Navigation Label</Label>
                    <Input id="navLabel" value={navLabel} onChange={e => setNavLabel(e.target.value)} placeholder="e.g., Blog Posts" />
                    <p className="text-xs text-muted-foreground mt-1">How this collection appears in the site menu.</p>
                </div>
                <div>
                    <Label htmlFor="description">Listing Page Description</Label>
                    <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="A short description for the top of the collection page." rows={4} />
                </div>
                 <div>
                    <Label>Sort Items By</Label>
                    <div className="flex gap-2 mt-1">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="title">Title</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortOrder} onValueChange={setSortOrder}>
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