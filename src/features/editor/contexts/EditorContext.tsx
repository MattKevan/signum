// src/contexts/EditorContext.tsx
'use client';
import { toast } from 'sonner';

import { createContext, useContext, useState, ReactNode, useMemo, useRef, useCallback } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'no_changes';

interface EditorContextType {
  setLeftSidebar: (content: ReactNode) => void;
  setRightSidebar: (content: ReactNode) => void;
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  triggerSave: () => Promise<void>;
  registerSaveAction: (saveFn: () => Promise<void>) => void;
}

export const EditorContext = createContext<EditorContextType | undefined>(undefined);

interface EditorProviderProps {
  children: ReactNode; 
}

export function EditorProvider({ children }: EditorProviderProps) {
  const [leftSidebarContent, setLeftSidebarContent] = useState<ReactNode>(null);
  const [rightSidebarContent, setRightSidebarContent] = useState<ReactNode>(null);
  const [saveState, setSaveState] = useState<SaveState>('no_changes');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveActionRef = useRef<(() => Promise<void>) | null>(null);

  const registerSaveAction = useCallback((saveFn: () => Promise<void>) => {
    saveActionRef.current = saveFn;
  }, []);
  
  const triggerSave = useCallback(async () => {
    if (saveActionRef.current) { // Allow manual save even if no changes (for "new file" mode)
      setSaveState('saving');
      try {
        await saveActionRef.current();
        setSaveState('saved');
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveState('no_changes'), 2000);
      } catch (error) {
        console.error("Save failed:", error);
        toast.error((error as Error).message || "Failed to save.");
        setSaveState('idle'); 
      }
    }
  }, []);

  const contextValue = useMemo(() => ({
    setLeftSidebar: setLeftSidebarContent,
    setRightSidebar: setRightSidebarContent,
    // Determine saveState based on hasUnsavedChanges
    saveState: hasUnsavedChanges ? 'idle' : saveState,
    // --- EXPOSE THE SETTER FUNCTION ---
    setSaveState,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    triggerSave,
    registerSaveAction,
  }), [saveState, hasUnsavedChanges, registerSaveAction, triggerSave]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}