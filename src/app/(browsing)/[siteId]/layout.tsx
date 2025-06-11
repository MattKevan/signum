// src/app/(browsing)/[siteId]/layout.tsx
'use client';

// Most imports can be removed as this layout is now just a shell.
import Link from 'next/link';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';

export default function SiteBrowsingLayout({ children }: { children: React.ReactNode; }) {
  // The complex logic for fetching data and building nav links is now handled by the page component.
  // This layout can be a simple pass-through or contain a minimal "back to dashboard" frame.
  const isInitialized = useAppStore(state => state.isInitialized);

  if (!isInitialized) {
    return <div className="p-4 text-center">Initializing...</div>;
  }

  return (
    <div className='flex-grow flex-col h-screen bg-background overflow-hidden'>
      {/* This top-level navbar is part of the Signum App UI, not the browsed site's UI */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className=" flex h-14 items-center justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to Signum Dashboard</Link>
          </Button>
        </div>
      </header>
      {/* The page component will render the full themed site below this bar */}
      {children}
    </div>
  );
}