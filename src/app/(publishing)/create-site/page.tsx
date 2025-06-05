// src/app/(publishing)/create-site/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { SiteConfigFile, LocalSiteData, ParsedMarkdownFile, MarkdownFrontmatter } from '@/types';
import SiteConfigForm from '@/components/publishing/SiteConfigForm';
import { Button } from '@/components/ui/button';
import { generateSiteId } from '@/lib/utils';
import { toast } from "sonner";

export default function CreateSitePage() {
  const router = useRouter();
  const addSite = useAppStore((state) => state.addSite);

  const [siteConfig, setSiteConfig] = useState<SiteConfigFile>({
    title: '',
    description: '',
    author: '',
    // Initialize new style properties with defaults
    font_family: 'sans-serif',
    theme: 'light',
    primary_color: '#007AFF',
    collections: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleConfigChange = (newConfig: SiteConfigFile) => {
    setSiteConfig(newConfig);
  };

  const handleSubmit = async () => {
    if (!siteConfig.title.trim()) {
      toast.error('Site title is required.');
      return;
    }
    setIsLoading(true);

    const newSiteId = generateSiteId(siteConfig.title);
    const defaultIndexFrontmatter: MarkdownFrontmatter = { title: 'Welcome' };
    const defaultIndexBody = `# Welcome to ${siteConfig.title}\n\nThis is your new site's homepage. Start editing!`;
    
    const defaultIndexFile: ParsedMarkdownFile = {
        slug: 'index',
        path: 'content/index.md',
        frontmatter: defaultIndexFrontmatter,
        content: defaultIndexBody,
    };

    // Construct the config for newSiteData using the spread of siteConfig from state
    // This ensures all fields, including the new top-level style fields, are included.
    const newSiteData: LocalSiteData = {
      siteId: newSiteId,
      config: {
        ...siteConfig, // Spread all current form values
        title: siteConfig.title.trim(), // Ensure title is trimmed
        description: siteConfig.description.trim(), // Ensure description is trimmed
        author: siteConfig.author?.trim() || '', // Handle optional author
        // Ensure collections is an array if not set by form for some reason
        collections: siteConfig.collections || [], 
      },
      contentFiles: [defaultIndexFile],
    };

    try {
      await addSite(newSiteData);
      toast.success(`Site "${siteConfig.title}" created locally!`);
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
      <SiteConfigForm initialConfig={siteConfig} onConfigChange={handleConfigChange} />
      <Button onClick={handleSubmit} disabled={isLoading} className="mt-6 w-full sm:w-auto">
        {isLoading ? 'Creating...' : 'Create Site Locally'}
      </Button>
    </div>
  );
}