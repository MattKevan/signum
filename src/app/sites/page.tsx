// src/app/sites/page.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import {
  FilePlus2,
  Leaf,
  Upload,
  Eye,
  Edit3,
  Archive,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/core/components/ui/alert-dialog";
import { toast } from "sonner";
import { importSiteFromZip, exportSiteBackup } from '@/core/services/siteBackup.service';
import { saveAllImageAssetsForSite } from '@/core/services/localFileSystem.service';
import { LocalSiteData } from '@/types';
import { slugify } from '@/lib/utils';

export default function HomePageDashboard() {
  const { sites, getSiteById, addSite, updateSiteSecrets, loadSite, deleteSiteAndState } = useAppStore();
  const [isImporting, setIsImporting] = useState(false);
  const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<(LocalSiteData & { imageAssetsToSave?: Record<string, Blob> }) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Finishes the import process by saving the data to the store and storage.
   * This is called either directly for a new site or after overwrite confirmation.
   */
  const finishImport = useCallback(async (data: LocalSiteData & { imageAssetsToSave?: Record<string, Blob> }) => {
    try {
      // --- FIX: Separate the binary data from the serializable data ---
      // The `imageAssetsToSave` property is transient and must not be passed
      // to the main `addSite` action, as it will cause a serialization error.
      const { imageAssetsToSave, ...siteDataToSave } = data;

      // 1. Save the core site data (manifest, content, etc.) which is JSON-serializable.
      await addSite(siteDataToSave);
      
      // 2. Save secrets to their dedicated store.
      if(siteDataToSave.secrets) {
        await updateSiteSecrets(siteDataToSave.siteId, siteDataToSave.secrets);
      }
      
      // 3. Save the image Blobs to their dedicated binary storage.
      if(imageAssetsToSave) {
        await saveAllImageAssetsForSite(siteDataToSave.siteId, imageAssetsToSave);
      }
      
      toast.success(`Site "${data.manifest.title}" imported successfully!`);
    } catch (error) {
      console.error("Error finishing site import:", error);
      toast.error(`Failed to save imported site: ${(error as Error).message}`);
    }
  }, [addSite, updateSiteSecrets]);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast.info("Importing site from backup...");

    try {
      const data = await importSiteFromZip(file);
      const existingSite = getSiteById(data.siteId);

      if (existingSite) {
        setImportedData(data);
        setIsOverwriteDialogOpen(true);
      } else {
        await finishImport(data);
      }
    } catch (error) {
      console.error("Error during site import:", error);
      toast.error(`Import failed: ${(error as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsImporting(false);
    }
  };

  const handleOverwriteConfirm = async () => {
    if (importedData) await finishImport(importedData);
    setIsOverwriteDialogOpen(false);
    setImportedData(null);
  };
  
  const handleExportBackup = async (siteId: string) => {
    toast.info("Preparing site backup...");
    try {
        await loadSite(siteId);
        const siteToExport = getSiteById(siteId);
        if (!siteToExport) throw new Error("Could not load site data for export.");
        const blob = await exportSiteBackup(siteToExport);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${slugify(siteToExport.manifest.title || 'signum-backup')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success("Site backup downloaded!");
    } catch (error) {
        console.error("Failed to export site:", error);
        toast.error(`Export failed: ${(error as Error).message}`);
    }
  };

  const handleDeleteSite = async (siteId: string, siteTitle: string) => {
    try {
      await deleteSiteAndState(siteId);
      toast.success(`Site "${siteTitle}" has been deleted.`);
    } catch (error) {
      toast.error(`Failed to delete site "${siteTitle}".`);
      console.error("Error deleting site:", error);
    }
  };

  const validSites = sites.filter(site => site && site.manifest);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Leaf className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold text-foreground hidden sm:inline">Signum</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <Upload className="mr-2 h-4 w-4" /> {isImporting ? 'Importing...' : 'Import site'}
            </Button>
            <Button asChild>
              <Link href="/create-site"><FilePlus2 className="mr-2 h-4 w-4" /> Create new site</Link>
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">My sites</h1>
        {validSites.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Sites Yet!</h2>
            <p className="text-muted-foreground mb-4">Click &quot;Create New Site&quot; or &quot;Import Site&quot; to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {validSites.map((site) => (
              <div key={site.siteId} className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground mb-2 truncate" title={site.manifest.title}>
                    {site.manifest.title || "Untitled Site"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2" title={site.manifest.description}>
                    {site.manifest.description || 'No description provided.'}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button variant="default" size="sm" asChild>
                    <Link href={`/sites/${site.siteId}/edit`}><Edit3 className="mr-2 h-4 w-4" /> Edit</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link href={`/sites/${site.siteId}/view`} target="_blank" rel="noopener noreferrer"><Eye className="mr-2 h-4 w-4" /> View Live Preview</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportBackup(site.siteId)}><Archive className="mr-2 h-4 w-4" /> Export backup</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e: Event) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete site
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete &quot;{site.manifest.title}&quot; and cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSite(site.siteId, site.manifest.title)} className="bg-destructive hover:bg-destructive/90">Yes, delete site</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".zip" className="hidden" />

      <AlertDialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Site Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              A site with the ID &quot;{importedData?.siteId}&quot; already exists. Do you want to overwrite it with the data from the backup file?
              <br/><br/>
              <strong>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportedData(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm} className="bg-destructive hover:bg-destructive/90">Overwrite</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}