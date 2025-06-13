// src/contexts/EditorContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useRef, useCallback } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'no_changes';

interface EditorContextType {
  setLeftSidebar: (content: ReactNode) => void;
  setRightSidebar: (content: ReactNode) => void;
  saveState: SaveState;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  triggerSave: () => Promise<void>;
  registerSaveAction: (saveFn: () => Promise<void>) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

interface EditorProviderProps {
  children: (slots: { leftSidebar: ReactNode; rightSidebar: ReactNode }) => ReactNode;
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
  
  // --- FIX: Wrap triggerSave in useCallback to stabilize its reference ---
  // This function will now only be re-created if `hasUnsavedChanges` changes.
  const triggerSave = useCallback(async () => {
    // The ref ensures we always call the LATEST registered save function.
    if (saveActionRef.current && hasUnsavedChanges) {
      setSaveState('saving');
      try {
        await saveActionRef.current();
        setSaveState('saved');
        setHasUnsavedChanges(false);
        // Revert to 'no_changes' state after a delay to show feedback.
        setTimeout(() => setSaveState('no_changes'), 2000);
      } catch (error) {
        console.error("Save failed:", error);
        setSaveState('idle'); // Revert to idle on error to allow another save attempt.
      }
    }
  }, [hasUnsavedChanges]); // Dependency: hasUnsavedChanges. `set...` functions are stable.

  // --- FIX: Add the now-stable `triggerSave` to the dependency array ---
  const contextValue = useMemo(() => ({
    setLeftSidebar: setLeftSidebarContent,
    setRightSidebar: setRightSidebarContent,
    saveState: hasUnsavedChanges ? 'idle' : saveState,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    triggerSave,
    registerSaveAction,
  }), [saveState, hasUnsavedChanges, registerSaveAction, triggerSave]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children({ leftSidebar: leftSidebarContent, rightSidebar: rightSidebarContent })}
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