// src/app/sites/layout.tsx
'use client';

export default function SitesDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // This layout establishes the main application view with the narrow sidebar
    <div className="flex flex-row h-full">
      
      
      {/* The content for this section (e.g., the grid of sites from /sites/page.tsx) renders here */}
      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
}