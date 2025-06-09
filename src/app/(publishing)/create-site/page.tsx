// src/app/(publishing)/create-site/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { LocalSiteData, ParsedMarkdownFile, MarkdownFrontmatter, StructureNode } from '@/types';
import { Button } from '@/components/ui/button';
import { generateSiteId } from '@/lib/utils';
import { toast } from "sonner";
import { getLayoutSchema, type ThemeInfo } from '@/lib/themeEngine';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// CORRECTED: Define the available CORE themes as a hardcoded constant.
// This is the single source of truth for this page.
const CORE_THEMES: ThemeInfo[] = [
  { id: 'default', name: 'Default Theme', type: 'core' },
  // { id: 'docs', name: 'Docs Theme', type: 'core' }, // Add the docs theme here when ready
];

export default function CreateSitePage() {
  const router = useRouter();
  const addSite = useAppStore((state) => state.addSite);

  // --- State Hooks ---
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // CORRECTED: Initialize state directly from the constant. No useEffect needed.
  const [selectedThemeInfo, setSelectedThemeInfo] = useState<ThemeInfo | null>(CORE_THEMES[0] || null);

  // --- Event Handlers ---
  const handleSubmit = async () => {
    if (!siteTitle.trim() || !selectedThemeInfo) {
      toast.error('Site title and a theme are required.');
      return;
    }
    setIsLoading(true);

    const newSiteId = generateSiteId(siteTitle);
    const homepageLayoutId = 'page'; // The homepage is always a standard page for new sites.

    // 1. Fetch the 'page' layout's schema from the selected theme to get default frontmatter.
    const layoutSchemaData = await getLayoutSchema(selectedThemeInfo.id, selectedThemeInfo.type, homepageLayoutId);
    const schemaProperties = layoutSchemaData?.itemSchema?.properties || {};

    const defaultFrontmatter: MarkdownFrontmatter = {
        title: 'Welcome to your new site!',
    };

    for (const [key, prop] of Object.entries(schemaProperties)) {
        if (typeof prop === 'object' && prop !== null && 'default' in prop && defaultFrontmatter[key] === undefined) {
            defaultFrontmatter[key] = prop.default;
        }
    }
     if (!defaultFrontmatter.date) {
        defaultFrontmatter.date = new Date().toISOString().split('T')[0];
    }

    // 2. Create the default index.md file content
    const defaultIndexBody = `# Welcome to ${siteTitle}\n\nThis is your new site's homepage. Start editing!`;
    const defaultIndexFile: ParsedMarkdownFile = {
        slug: 'index',
        path: 'content/index.md',
        frontmatter: defaultFrontmatter,
        content: defaultIndexBody,
    };
    
    // 3. Create the initial structure node for the site manifest
    const indexStructureNode: StructureNode = {
        type: 'page',
        title: 'Home',
        path: 'content/index.md',
        slug: 'index',
        navOrder: 0,
        layout: homepageLayoutId,
    };

    // 4. Construct the final data object
    const newSiteData: LocalSiteData = {
      siteId: newSiteId,
      manifest: {
        siteId: newSiteId,
        generatorVersion: 'SignumClient/1.2.0',
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        theme: {
          name: selectedThemeInfo.id,
          type: selectedThemeInfo.type,
          config: {},
        },
        structure: [indexStructureNode],
      },
      contentFiles: [defaultIndexFile],
    };

    try {
      await addSite(newSiteData);
      toast.success(`Site "${siteTitle}" created successfully!`);
      router.push(`/edit/${newSiteId}/content/index`);
    } catch (error) {
      console.error("Error creating site:", error);
      toast.error("Failed to create site.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Create a New Site</h1>
            <Button onClick={() => router.push('/')} variant="outline">Cancel</Button>
        </div>

        <div className="space-y-4 p-6 border rounded-lg">
            <h2 className="text-lg font-semibold">Site Details</h2>
            <div>
                <Label htmlFor="site-title">Site Title</Label>
                <Input
                    id="site-title"
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    placeholder="My Awesome Project"
                    required
                    className="mt-1"
                />
            </div>
            <div>
                <Label htmlFor="site-description">Site Description (Optional)</Label>
                <Textarea
                    id="site-description"
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    placeholder="A short and catchy description of your new site."
                    rows={3}
                    className="mt-1"
                />
            </div>
            <div>
                <Label htmlFor="theme-select">Theme</Label>
                <Select 
                    value={selectedThemeInfo?.id || ''} 
                    onValueChange={(themeId) => {
                        const theme = CORE_THEMES.find(t => t.id === themeId);
                        if(theme) setSelectedThemeInfo(theme);
                    }} 
                >
                    <SelectTrigger id="theme-select" className="mt-1">
                        <SelectValue placeholder="Select a theme..." />
                    </SelectTrigger>
                    <SelectContent>
                        {CORE_THEMES.map(theme => (
                            <SelectItem key={theme.id} value={theme.id}>
                                {theme.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">
                    Choose the overall design for your site. You can change this later on the Appearance page.
                </p>
            </div>
        </div>

        <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isLoading || !siteTitle.trim() || !selectedThemeInfo} size="lg">
                {isLoading ? 'Creating...' : 'Create Site'}
            </Button>
        </div>
      </div>
    </div>
  );
}