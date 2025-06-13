// src/app/layout.tsx
'use client'; 

import { useEffect, useState, Suspense } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import './globals.css'; 
import { Toaster } from "@/components/ui/sonner"; 
import { ThemeProvider } from "@/components/core/ThemeProvider";
import { useInitialiseUIStore } from '@/hooks/useInitialiseUIStore';

function AppLoadingIndicator() {
  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground">
      <div className="flex flex-col items-center">
        <svg className="animate-spin h-8 w-8 text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg">Loading Signum...</p>
      </div>
    </div>
  ); 
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useInitialiseUIStore();
  const initialize = useAppStore(state => state.initialize);
  const isInitialized = useAppStore(state => state.isInitialized);
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true); 
    // Initialize the app state from storage only once
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]); 

  // Show the loading indicator only on the client and before initialization is complete
  const showLoading = clientMounted && !isInitialized;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Signum - Decentralized Publishing</title>
      </head>
      <body className="h-full">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
          {showLoading ? (
            <AppLoadingIndicator />
          ) : (
         
                <Suspense fallback={<AppLoadingIndicator />}>
                  {children}
                </Suspense>
              
          )}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}