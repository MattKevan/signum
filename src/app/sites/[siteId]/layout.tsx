// src/app/sites/[siteId]/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TbEdit, TbSettings } from "react-icons/tb";
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { ReactNode } from 'react';

/**
 * The root layout for a single site's backend.
 * This component provides the persistent vertical toolbar for navigating
 * between main sections like 'Edit' and 'Settings'.
 */
export default function SingleSiteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const siteId = pathname.split('/')[2];

  const isEditorActive = pathname.startsWith(`/sites/${siteId}/edit`);
  const isSettingsActive = pathname.startsWith(`/sites/${siteId}/settings`);

  const navItems = [
    { href: `/sites/${siteId}/edit`, title: 'Edit', icon: TbEdit, isActive: isEditorActive },
    { href: `/sites/${siteId}/settings`, title: 'Settings', icon: TbSettings, isActive: isSettingsActive },
  ];

  return (
    <div className="flex h-screen flex-col lg:flex-row">
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

      {/* The rest of the page (which will be another layout like EditSiteLayout) renders here. */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {children}
      </main>
    </div>
  );
}