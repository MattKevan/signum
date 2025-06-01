// src/app/(publishing)/create-site/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { SiteConfigFile, LocalSiteData, ParsedMarkdownFile, MarkdownFrontmatter } from '@/types';
import SiteConfigForm from '@/components/publishing/SiteConfigForm';
import { Button } from '@/components/ui/button';
import { generateSiteId } from '@/lib/utils';
import { toast } from "sonner"; // For notifications

export default function CreateSitePage() {
  const router = useRouter();
  const addSite = useAppStore((state) => state.addSite); // Get specific action

  const [siteConfig, setSiteConfig] = useState<SiteConfigFile>({
    title: '',
    description: '',
    // Initialize other optional fields if necessary
    // style_hints: { font_family: 'sans-serif', theme: 'light' },
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

    // Create a default index.md
    const defaultIndexFrontmatter: MarkdownFrontmatter = { title: 'Welcome' };
    const defaultIndexBody = `# Welcome to ${siteConfig.title}\n\nThis is your new site's homepage. Start editing!`;
    
    const defaultIndexFile: ParsedMarkdownFile = {
        slug: 'index', // slug derived from filename (index.md)
        path: 'content/index.md',
        frontmatter: defaultIndexFrontmatter,
        content: defaultIndexBody,
    };

    const newSiteData: LocalSiteData = {
      siteId: newSiteId,
      config: { // Ensure all required fields from SiteConfigFile are present
        title: siteConfig.title.trim(),
        description: siteConfig.description.trim(),
        author: siteConfig.author?.trim() || '', // Handle optional author
        style_hints: siteConfig.style_hints || {}, // Ensure style_hints is an object
      },
      contentFiles: [defaultIndexFile],
    };

    try {
      await addSite(newSiteData); // This action in store now calls localSiteFs.saveSite
      toast.success(`Site "${siteConfig.title}" created locally!`);
      router.push(`/edit/${newSiteId}`); // Navigate to the editor for the new site
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