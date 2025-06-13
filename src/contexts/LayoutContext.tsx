'use client';

import { createContext, useContext, useState, ReactNode, useMemo } from 'react'; // Import useMemo

interface LayoutContextType {
  setLeftSidebar: (content: ReactNode) => void;
  setRightSidebar: (content: ReactNode) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

interface LayoutProviderProps {
  children: (slots: { leftSidebar: ReactNode; rightSidebar: ReactNode }) => ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [leftSidebarContent, setLeftSidebarContent] = useState<ReactNode>(null);
  const [rightSidebarContent, setRightSidebarContent] = useState<ReactNode>(null);

  // --- START OF FIX ---
  // Memoize the context value so the function references don't change on every render
  const value = useMemo(() => ({
    setLeftSidebar: setLeftSidebarContent,
    setRightSidebar: setRightSidebarContent,
  }), []); // Empty dependency array means this object is created only once
  // --- END OF FIX ---

  return (
    <LayoutContext.Provider value={value}>
      {children({ leftSidebar: leftSidebarContent, rightSidebar: rightSidebarContent })}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}