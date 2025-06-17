// src/components/core/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Import useRouter
import { Leaf, Home, Settings, Globe } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input'; // Import Input
import React, { useState } from 'react';

// ... (NavLink component remains the same) ...
const NavLink: React.FC<{ href: string; label: string; icon?: React.ReactNode; }> = ({ href, label, icon }) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Button  className={`justify-start ${isActive ? 'bg-accent text-accent-foreground' : ''}`}>
      <Link href={href} className="flex items-center space-x-2">
        {icon}
        <span>{label}</span>
      </Link>
    </Button>
  );
};


export default function Navbar() {
  const router = useRouter();
  const [remoteUrl, setRemoteUrl] = useState('');

  const handleBrowseRemoteSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (remoteUrl.trim()) {
      try {
        const url = new URL(remoteUrl.trim()); // Basic URL validation
        // We need a way to signify this is a remote URL to our browsing pages.
        // Option 1: Special prefix for siteId, e.g., "remote::http://localhost:8080"
        // Option 2: A different route, e.g., /browse/remote?url=...
        // Option 3: Pass state via router.push (can be complex with SSR/layouts)

        // Let's use Option 1: Prefix the siteId with "remote@" or similar marker
        // and encode the URL. The browsing page will then decode it.
        const encodedUrl = encodeURIComponent(url.origin); // Use origin (scheme + hostname + port)
        router.push(`/remote@${encodedUrl}`); // Navigate to /remote@http%3A%2F%2Flocalhost%3A8080
        setRemoteUrl(''); // Clear input
      } catch (error) {
        alert("Invalid URL entered.");
        console.error("Invalid URL:", error);
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center space-x-2">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-foreground hidden sm:inline">Signum</span>
        </Link>
        
        {/* Remote Site URL Input */}
        <form onSubmit={handleBrowseRemoteSite} className="flex-grow max-w-xl flex items-center gap-2">
          <div className="relative w-full">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="Enter remote Signum site URL (e.g., http://localhost:8080)"
              className="pl-9" // Padding for the icon
            />
          </div>
          <Button type="submit">Browse</Button>
        </form>
        
        <nav className="hidden md:flex items-center space-x-1">
          <NavLink href="/" label="Dashboard" icon={<Home className="h-4 w-4" />} />
          {/* ... other links ... */}
        </nav>

        <div className="md:hidden">
          <Button  >
            <Settings className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
}