// src/app/page.tsx
'use client';

import Link from 'next/link';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit3, Eye, Trash2, FilePlus2, Leaf } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function HomePageDashboard() {
  const sites = useAppStore((state) => state.sites);
  const deleteSiteAndState = useAppStore((state) => state.deleteSiteAndState);

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
                  <Button asChild variant="ghost">
                    <Link href="/sites">Dashboard</Link>
                  </Button>
                </div>
              </header>
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-foreground">My Signum Sites</h1>
        <Button asChild size="lg">
          <Link href="/create-site">
            <FilePlus2 className="mr-2 h-5 w-5" /> Create New Site
          </Link>
        </Button>
      </div>

      {validSites.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Sites Yet!</h2>
          <p className="text-muted-foreground mb-4">Click &quot;Create New Site&quot; to get started.</p>
          <Button asChild>
            <Link href="/create-site">
                <PlusCircle className="mr-2 h-4 w-4" /> Start Creating
            </Link>
          </Button>
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
              <div className="mt-4 flex flex-wrap justify-start gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/sites/${site.siteId}/`} target="_blank" rel="noopener noreferrer">
                    <Eye className="mr-2 h-4 w-4" /> View
                  </Link>
                </Button>
                <Button variant="default" size="sm" asChild>
                  <Link href={`/sites/${site.siteId}/edit`}>
                     <Edit3 className="mr-2 h-4 w-4" /> Edit
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete &quot;{site.manifest.title || 'this site'}&quot; from local storage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteSite(site.siteId, site.manifest.title || 'Untitled Site')}>
                        Yes, delete site
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}