// src/components/core/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, Home, Settings } from 'lucide-react'; // Using Leaf as a placeholder logo
import { Button } from '@/components/ui/button';

interface NavLinkProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ href, label, icon }) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href)); // More robust active check

  return (
    <Button variant="ghost" asChild className={`justify-start ${isActive ? 'bg-accent text-accent-foreground' : ''}`}>
      <Link href={href} className="flex items-center space-x-2">
        {icon}
        <span>{label}</span>
      </Link>
    </Button>
  );
};

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-foreground">Signum</span>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-2">
          <NavLink href="/" label="Dashboard" icon={<Home className="h-4 w-4" />} />
          {/* Future global links */}
          {/* <NavLink href="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} /> */}
          {/* <NavLink href="/help" label="Help" icon={<HelpCircle className="h-4 w-4" />} /> */}
        </nav>

        <div className="md:hidden">
          {/* Mobile Menu Trigger (to be implemented later if needed) */}
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" /> {/* Placeholder for a menu icon */}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
}