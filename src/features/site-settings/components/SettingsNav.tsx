'use-client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TbUserCircle, TbPalette } from 'react-icons/tb';
import { cn } from '@/lib/utils';

// This is the navigation component for the settings area.
export default function SettingsNav() {
  const pathname = usePathname();
  const siteId = pathname.split('/')[2];

  const navItems = [
    { href: `/sites/${siteId}/settings`, title: 'Site Details', icon: TbUserCircle },
    { href: `/sites/${siteId}/settings/appearance`, title: 'Appearance', icon: TbPalette },
    // Add more settings links here as needed
  ];

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="px-2 text-lg font-semibold tracking-tight">Settings</h2>
      <nav className="mt-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}