// src/components/publishing/MarkdownEditor.tsx
'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Crepe } from "@milkdown/crepe";
import { Editor } from '@milkdown/core';
import { getMarkdown } from '@milkdown/utils';

// Import styles. The CSS will automatically handle light/dark mode.
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "@milkdown/crepe/theme/frame-dark.css";

interface MarkdownEditorProps {
  initialValue: string;
}

// Define the API that the editor will expose to its parent component.
export interface MarkdownEditorRef {
  getMarkdown: () => string;
}

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  ({ initialValue }, ref) => {
    const editorRootRef = useRef<HTMLDivElement>(null);
    // --- FIX: Create a ref to hold the actual Editor instance, not the Crepe factory ---
    const editorInstanceRef = useRef<Editor | null>(null);
    const crepeInstanceRef = useRef<Crepe | null>(null);

    // This hook exposes the 'getMarkdown' function to the parent component via the ref.
    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        // FIX: Interact with the stored Editor instance and its action system.
        if (!editorInstanceRef.current) {
            console.warn("getMarkdown called before editor was ready.");
            return '';
        }
        // The Milkdown core API uses an action system. We call the `getMarkdown` utility
        // through the editor's action context to get the content.
        return editorInstanceRef.current.action(getMarkdown());
      },
    }));

    useEffect(() => {
      if (!editorRootRef.current) return;

      if (crepeInstanceRef.current) {
        crepeInstanceRef.current.destroy();
        crepeInstanceRef.current = null;
        editorInstanceRef.current = null;
      }

      const crepe = new Crepe({
        root: editorRootRef.current,
        defaultValue: initialValue,
      });

      crepeInstanceRef.current = crepe;
      
      crepe.create()
        .then((editor) => {
          // Store the resolved editor instance in our ref for later use.
          editorInstanceRef.current = editor;
        })
        .catch((error: unknown) => {
            console.error("Failed to create Milkdown editor:", error);
        });

      return () => {
        if (crepeInstanceRef.current) {
          crepeInstanceRef.current.destroy();
          crepeInstanceRef.current = null;
          editorInstanceRef.current = null;
        }
      };
    }, [initialValue]);

    return (
      <div
        ref={editorRootRef}
        className="prose prose-neutral dark:prose-invert max-w-none 
                   p-4 border rounded-md shadow-sm bg-background
                   min-h-[calc(100%-50px)] w-full
                   focus-within:ring-1 focus-within:ring-ring"
      />
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;