// src/app/page.tsx
'use client';

import Link from 'next/link';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit3, Eye, Trash2, FilePlus2, ExternalLink } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function HomePageDashboard() {
  const sites = useAppStore((state) => state.sites);
  const deleteSiteAndState = useAppStore((state) => state.deleteSiteAndState);
  const isInitialized = useAppStore((state) => state.isInitialized);

  const handleDeleteSite = async (siteId: string, siteTitle: string) => {
    try {
      await deleteSiteAndState(siteId);
      toast.success(`Site "${siteTitle}" has been deleted.`);
    } catch (error) {
      toast.error(`Failed to delete site "${siteTitle}".`);
      console.error("Error deleting site:", error);
    }
  };

  if (!isInitialized) {
    return (
        <div className="flex items-center justify-center h-full">
            <p>Loading sites...</p>
        </div>
    );
  }

  // CORRECTED: Filter the sites array to only include sites that have a valid manifest.
  // This prevents runtime errors if stale or malformed data is loaded from localStorage.
  const validSites = sites.filter(site => site && site.manifest);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-foreground">My Signum Sites (Local)</h1>
        <Button asChild size="lg">
          <Link href="/create-site">
            <FilePlus2 className="mr-2 h-5 w-5" /> Create New Site
          </Link>
        </Button>
      </div>

      {validSites.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Sites Yet!</h2>
          <p className="text-muted-foreground mb-4">
            You haven&apos;t created any sites. Click Create New Site to get started.
          </p>
          <Button asChild>
            <Link href="/create-site">
                <PlusCircle className="mr-2 h-4 w-4" /> Start Creating
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {validSites.map((site) => (
            <div 
                key={site.siteId} 
                className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow flex flex-col justify-between"
            >
              <div>
                <h2 className="text-xl font-semibold text-card-foreground mb-2 truncate" title={site.manifest.title}>
                  {site.manifest.title || "Untitled Site"}
                </h2>
                <p className="text-sm text-muted-foreground mb-1 line-clamp-2" title={site.manifest.description}>
                  {site.manifest.description || 'No description provided.'}
                </p>
                <p className="text-xs text-muted-foreground mb-4 break-all" title={site.siteId}>
                  ID: {site.siteId}
                </p>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row sm:justify-start gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none">
                  <Link href={`/${site.siteId}`} target="_blank" rel="noopener noreferrer">
                    <Eye className="mr-2 h-4 w-4" /> View
                  </Link>
                </Button>
                <Button variant="default" size="sm" asChild className="flex-1 sm:flex-none">
                  <Link href={`/edit/${site.siteId}`}>
                     <Edit3 className="mr-2 h-4 w-4" /> Edit
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="flex-1 sm:flex-none">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the site
                        &quot;{site.manifest.title || 'this site'}&quot; and all its content from your local storage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteSite(site.siteId, site.manifest.title || 'Untitled Site')}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      >
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
       <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>Signum Local Client v0.1.0</p>
        <p>
          <Link href="https://github.com/your-repo/signum-client" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            View on GitHub <ExternalLink className="inline-block ml-1 h-3 w-3" />
          </Link>
        </p>
      </footer>
    </div>
  );
}