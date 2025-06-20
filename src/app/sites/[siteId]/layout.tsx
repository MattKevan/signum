// src/app/sites/[siteId]/layout.tsx
'use client';

import { useEffect, ReactNode } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useAppStore } from '@/core/state/useAppStore';
import Link from 'next/link';
import Image from 'next/image';
import { TbEdit, TbSettings } from "react-icons/tb";
import { cn } from '@/lib/utils';

/**
 * The root layout for a single site's backend.
 * This component serves a dual purpose:
 * 1. **Visual Layout:** It provides the persistent vertical toolbar for navigating
 *    between main sections like 'Edit' and 'Settings'.
 * 2. **Data Loader & Context Setter:** It uses a `useEffect` hook to trigger the
 *    loading of the active site's data and sets the `activeSiteId` in the
 *    global store, making it available to all child components.
 */
export default function SingleSiteLayout({ children }: { children: ReactNode }) {
  // --- Part 1: Get router and state management hooks ---
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  const loadSiteAction = useAppStore(state => state.loadSite);
  const setActiveSiteIdAction = useAppStore(state => state.setActiveSiteId);

  // --- Part 2: The Data Loading Logic (from the previous loader component) ---
  // This effect runs whenever the siteId from the URL changes.
  useEffect(() => {
    if (siteId) {
      // Trigger the loading of this site's data from storage.
      loadSiteAction(siteId);
      // Announce to the rest of the app which site is currently active.
      setActiveSiteIdAction(siteId);
    }
    
    // Cleanup function: When the user navigates away from this site's
    // section, clear the activeSiteId to prevent stale data display elsewhere.
    return () => {
      setActiveSiteIdAction(null);
    };
  }, [siteId, loadSiteAction, setActiveSiteIdAction]);

  // --- Part 3: The Visual Rendering Logic (from your provided code) ---

  // Determine which navigation link is currently active based on the URL path.
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

      {/* The rest of the page (which will be another layout like ThreeColumnLayout) renders here. */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {children}
      </main>
    </div>
  );
}