// src/app/sites/[siteId]/layout.tsx
'use client';

import { useEffect, ReactNode, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import Link from 'next/link';
import Image from 'next/image';
import { TbEdit, TbSettings } from "react-icons/tb";
import { cn } from '@/core/libraries/utils';

/**
 * The root layout for a single site's backend.
 * This component provides the persistent vertical toolbar and, crucially, manages
 * the loading of the active site's data into the global store.
 *
 */
export default function SingleSiteLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  // --- State and Action Hooks ---
  // Select the specific data and actions needed from the store.
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const loadSite = useAppStore(state => state.loadSite);
  const setActiveSiteId = useAppStore(state => state.setActiveSiteId);

  useEffect(() => {
    // Always set the active site ID when this layout is mounted.
    if (siteId) {
      setActiveSiteId(siteId);
    }
    
    // Only call `loadSite` if the siteId is present AND the site's core content
    // (`contentFiles`) has not yet been loaded into the store.
    if (siteId && (!site || !site.contentFiles)) {
      console.log(`[SiteLayout] Site data for ${siteId} not found in memory. Loading from storage.`);
      loadSite(siteId);
    }

    // Cleanup function: When the user navigates away, clear the activeSiteId.
    return () => {
      setActiveSiteId(null);
    };
  // The dependency array ensures this logic re-evaluates if the siteId changes
  // or if the site object itself is replaced in the store.
  }, [siteId, site, loadSite, setActiveSiteId]);

  // --- Visual Rendering Logic ---
  const isEditorActive = pathname.startsWith(`/sites/${siteId}/edit`);
  const isSettingsActive = pathname.startsWith(`/sites/${siteId}/settings`);

  const navItems = [
    { href: `/sites/${siteId}/edit`, title: 'Edit', icon: TbEdit, isActive: isEditorActive },
    { href: `/sites/${siteId}/settings`, title: 'Settings', icon: TbSettings, isActive: isSettingsActive },
  ];

  return (
    <div className="flex h-screen flex-col lg:flex-row bg-muted/20">
      <aside className="fixed inset-x-0 bottom-0 z-30 flex h-16 w-full shrink-0 border-t bg-background lg:static lg:inset-y-0 lg:left-0 lg:h-full lg:w-[60px] lg:border-r lg:border-t-0">
        <nav className="flex w-full items-center justify-center gap-4 px-2 lg:flex-col lg:justify-start lg:pb-5">
          <Link
            href="/sites"
            title="Dashboard"
            className='lg:flex hidden flex-col items-center w-[60px] h-[60px] border-b'
          >
            <Image src="/signum.svg" width={34} height={34} alt="Signum Logo" className='m-auto'/>
          </Link>
          
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                item.isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <item.icon className="size-6" />
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {children}
      </main>
    </div>
  );
}