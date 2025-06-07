'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { LocalSiteData, ParsedMarkdownFile, MarkdownFrontmatter, StructureNode } from '@/types';
import { Button } from '@/components/ui/button';
import { generateSiteId } from '@/lib/utils';
import { toast } from "sonner";
import { getAvailableLayouts, getLayoutSchema, type ThemeLayout } from '@/lib/themeEngine';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function CreateSitePage() {
  const router = useRouter();
  const addSite = useAppStore((state) => state.addSite);

  // --- State Hooks ---
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availablePageLayouts, setAvailablePageLayouts] = useState<ThemeLayout[]>([]);
  const [selectedLayout, setSelectedLayout] = useState('');

  // --- Effects ---
  useEffect(() => {
    // We'll hardcode the "default" theme for now, but this is the single
    // place it's defined. In the future, this could come from user settings.
    const currentTheme = 'default';

    async function loadLayouts() {
      const allLayouts = await getAvailableLayouts(currentTheme);
      const pageLayouts = allLayouts.filter(l => l.type === 'page');
      setAvailablePageLayouts(pageLayouts);

      // Automatically select the first available page layout.
      if (pageLayouts.length > 0) {
        setSelectedLayout(pageLayouts[0].id);
      }
    }
    loadLayouts();
  }, []);


  // --- Event Handlers ---
  const handleSubmit = async () => {
    if (!siteTitle.trim() || !selectedLayout) {
      toast.error('Site title and a homepage layout are required.');
      return;
    }
    setIsLoading(true);

    const currentTheme = 'default';
    const newSiteId = generateSiteId(siteTitle);

    // 1. Fetch the chosen layout's schema to get default frontmatter values.
    const layoutSchemaData = await getLayoutSchema(currentTheme, selectedLayout);
    const schemaProperties = layoutSchemaData?.schema?.properties || {};

    const defaultFrontmatter: MarkdownFrontmatter = {
        title: 'Welcome to your new site!', // This is the H1 on the page
    };

    for (const [key, prop] of Object.entries(schemaProperties)) {
        if (typeof prop === 'object' && prop !== null && 'default' in prop && defaultFrontmatter[key] === undefined) {
            defaultFrontmatter[key] = prop.default;
        }
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
        title: 'Home', // This is the display name in the editor's file tree
        path: 'content/index.md',
        slug: 'index',
        navOrder: 0,
        layout: selectedLayout,
    };

    // 4. Construct the final data object
    const newSiteData: LocalSiteData = {
      siteId: newSiteId,
      manifest: {
        siteId: newSiteId,
        generatorVersion: 'SignumClient/0.7.0',
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        theme: {
          name: currentTheme,
          config: {}, // Appearance config will be set later on the config page
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
            <Button onClick={() => router.push('/')} variant="outline">
              Cancel
            </Button>
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
                <Label htmlFor="homepage-layout">Homepage Layout</Label>
                <Select value={selectedLayout} onValueChange={setSelectedLayout} disabled={availablePageLayouts.length === 0}>
                    <SelectTrigger id="homepage-layout" className="mt-1">
                        <SelectValue placeholder="Select a layout..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availablePageLayouts.map(layout => (
                            <SelectItem key={layout.id} value={layout.id}>
                                {layout.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">
                    Determines the fields and appearance of your main landing page.
                </p>
            </div>
        </div>

        <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isLoading || !siteTitle.trim() || !selectedLayout} size="lg">
                {isLoading ? 'Creating...' : 'Create Site'}
            </Button>
        </div>
      </div>
    </div>
  );
}