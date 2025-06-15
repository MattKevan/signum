// src/app/(publishing)/create-site/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import { LocalSiteData, ParsedMarkdownFile, MarkdownFrontmatter, StructureNode, ThemeInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { generateSiteId } from '@/lib/utils';
import { toast } from "sonner";
import { getLayoutManifest } from '@/lib/configHelpers';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GENERATOR_VERSION, CORE_THEMES, DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';

export default function CreateSitePage() {
  const router = useRouter();
  const addSite = useAppStore((state) => state.addSite);

  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const availableThemes = useMemo(() => CORE_THEMES, []);
  const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(availableThemes[0] || null);

  const handleSubmit = async () => {
    if (!siteTitle.trim() || !selectedTheme) {
      toast.error('Site title and a theme are required.');
      return;
    }
    setIsLoading(true);

    const newSiteId = generateSiteId(siteTitle);
    const homepageLayoutPath = DEFAULT_PAGE_LAYOUT_PATH;

    // FIXED: 'defaultFrontmatter' is never reassigned, so it should be a const.
    const defaultFrontmatter: MarkdownFrontmatter = {
        title: 'Welcome to your new site!',
        date: new Date().toISOString().split('T')[0],
    };

    // FIXED: Create a complete mock LocalSiteData object to satisfy the type system.
    const mockSiteData: LocalSiteData = { 
        siteId: 'mock-id', 
        contentFiles: [], 
        layoutFiles: [], 
        themeFiles: [], 
        manifest: { 
            siteId: 'mock-id',
            title: 'mock',
            description: 'mock',
            generatorVersion: GENERATOR_VERSION,
            structure: [],
            theme: { 
                name: selectedTheme.path, 
                config: {} 
            } 
        } 
    };
    
    const layoutManifest = await getLayoutManifest(mockSiteData, homepageLayoutPath);
    
    if (layoutManifest?.pageSchema.properties) {
        for (const [key, prop] of Object.entries(layoutManifest.pageSchema.properties)) {
            if (typeof prop === 'object' && prop !== null && 'default' in prop && defaultFrontmatter[key] === undefined) {
                defaultFrontmatter[key] = prop.default as unknown;
            }
        }
    }

    const defaultIndexFile: ParsedMarkdownFile = {
        slug: 'index',
        path: 'content/index.md',
        frontmatter: defaultFrontmatter,
        content: `# Welcome to ${siteTitle}\n\nThis is your new site's homepage. You can start editing it now.`,
    };
    
    const indexStructureNode: StructureNode = {
        type: 'page',
        title: 'Home',
        path: 'content/index.md',
        slug: 'index',
        navOrder: 0,
        layout: homepageLayoutPath,
    };

    const newSiteData: LocalSiteData = {
      siteId: newSiteId,
      manifest: {
        siteId: newSiteId,
        generatorVersion: GENERATOR_VERSION,
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        theme: {
          name: selectedTheme.path,
          config: {},
        },
        structure: [indexStructureNode],
      },
      contentFiles: [defaultIndexFile],
      themeFiles: [],
      layoutFiles: [],
    };

    try {
      await addSite(newSiteData);
      toast.success(`Site "${siteTitle}" created successfully!`);
      router.push(`/sites/${newSiteId}/edit/content/index`);
    } catch (error) {
      toast.error(`Failed to create site: ${(error as Error).message}`);
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
                    value={selectedTheme?.path || ''} 
                    onValueChange={(themePath) => {
                        const theme = availableThemes.find(t => t.path === themePath);
                        if (theme) setSelectedTheme(theme);
                    }} 
                >
                    <SelectTrigger id="theme-select" className="mt-1">
                        <SelectValue placeholder="Select a theme..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableThemes.map(theme => (
                            <SelectItem key={theme.path} value={theme.path}>
                                {theme.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">
                    Choose the overall design for your site. You can change this later.
                </p>
            </div>
        </div>

        <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isLoading || !siteTitle.trim() || !selectedTheme} size="lg">
                {isLoading ? 'Creating...' : 'Create Site'}
            </Button>
        </div>
      </div>
    </div>
  );
}