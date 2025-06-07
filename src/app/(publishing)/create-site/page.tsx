// src/app/(publishing)/create-site/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { LocalSiteData, ParsedMarkdownFile, MarkdownFrontmatter, Manifest } from '@/types'; // Import Manifest
import SiteConfigForm from '@/components/publishing/SiteConfigForm';
import { Button } from '@/components/ui/button';
import { generateSiteId } from '@/lib/utils';
import { toast } from "sonner";

export default function CreateSitePage() {
  const router = useRouter();
  const addSite = useAppStore((state) => state.addSite);

  // Initialize a default, new Manifest object
  const [manifest, setManifest] = useState<Manifest>({
    siteId: '', // Will be generated on submit
    generatorVersion: 'SignumClient/0.5.0',
    title: '',
    description: '',
    author: '',
    theme: {
      name: 'default',
      config: {
        font_family: 'sans-serif',
        color_scheme: 'light',
        primary_color: '#007AFF',
      },
    },
    structure: [], // Starts empty
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleManifestChange = (newManifest: Manifest) => {
    setManifest(newManifest);
  };

  const handleSubmit = async () => {
    if (!manifest.title.trim()) {
      toast.error('Site title is required.');
      return;
    }
    setIsLoading(true);

    const newSiteId = generateSiteId(manifest.title);
    
    // Create the default index.md file
    const defaultIndexFrontmatter: MarkdownFrontmatter = { title: 'Welcome' };
    const defaultIndexBody = `# Welcome to ${manifest.title}\n\nThis is your new site's homepage. Start editing!`;
    const defaultIndexFile: ParsedMarkdownFile = {
        slug: 'index',
        path: 'content/index.md',
        frontmatter: defaultIndexFrontmatter,
        content: defaultIndexBody,
    };
    
    // Create the initial structure node for the index file
    const indexStructureNode = {
        type: 'page' as const,
        title: 'Welcome',
        path: 'content/index.md',
        slug: 'index',
        navOrder: 0,
    };

    // Construct the final data to be saved
    const newSiteData: LocalSiteData = {
      siteId: newSiteId,
      manifest: {
        ...manifest,
        siteId: newSiteId, // Add the generated ID to the manifest
        title: manifest.title.trim(),
        description: manifest.description.trim(),
        structure: [indexStructureNode], // Add the root index page to the structure
      },
      contentFiles: [defaultIndexFile],
    };

    try {
      await addSite(newSiteData);
      toast.success(`Site "${manifest.title}" created locally!`);
      router.push(`/edit/${newSiteId}/config`);
    } catch (error) {
      console.error("Error creating site:", error);
      toast.error("Failed to create site. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Create New Site</h1>
        <Button onClick={() => router.push('/')} variant="outline">
          Back to Dashboard
        </Button>
      </div>
      <SiteConfigForm 
        initialManifest={manifest} 
        onManifestChange={handleManifestChange} 
      />
      <Button onClick={handleSubmit} disabled={isLoading} className="mt-6 w-full sm:w-auto">
        {isLoading ? 'Creating...' : 'Create Site Locally'}
      </Button>
    </div>
  );
}