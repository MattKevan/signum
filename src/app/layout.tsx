// src/app/layout.tsx
'use client'; 

import { useEffect, useState, Suspense } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Navbar from '@/components/core/Navbar'; 
import Footer from '@/components/core/Footer';   
import './globals.css'; 
import { Toaster } from "@/components/ui/sonner"; 
import { ThemeProvider } from "@/components/core/ThemeProvider"; 

// Loading component to show during initialization or suspense
function AppLoadingIndicator() { // CORRECTED: Ensure it returns JSX
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
  ); // <<< MISSING RETURN WAS HERE
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialize = useAppStore(state => state.initialize);
  const isInitialized = useAppStore(state => state.isInitialized);
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true); 
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]); 

  const showLoading = clientMounted && !isInitialized;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Signum - Decentralized Publishing</title>
        {/* Ensure no stray characters or whitespace directly in <head> */}
      </head>
      <body>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
          <div className="flex flex-col min-h-screen bg-background text-foreground">
            {showLoading ? (
              <AppLoadingIndicator /> // Now correctly used
            ) : (
              <>
                <Navbar />
                <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8"> 
                  <Suspense fallback={<AppLoadingIndicator />}>
                    {children}
                  </Suspense>
                </main>
                <Footer />
              </>
            )}
          </div>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}