// src/components/publishing/MarkdownEditor.tsx
'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Crepe } from "@milkdown/crepe";
import { Ctx } from '@milkdown/ctx'; // Import Ctx for typing the listener callback

// Import only the necessary theme styles
import '@milkdown/crepe/theme/common/prosemirror.css';
import '@milkdown/crepe/theme/common/reset.css';
import '@milkdown/crepe/theme/frame.css';
import '@milkdown/crepe/theme/frame-dark.css';

interface MarkdownEditorProps {
  initialValue: string;
  onContentChange: (markdown: string) => void;
}

export interface MarkdownEditorRef {
  getMarkdown: () => string;
}

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  ({ initialValue, onContentChange }, ref) => {
    const editorRootRef = useRef<HTMLDivElement>(null);
    const crepeInstanceRef = useRef<Crepe | null>(null);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!crepeInstanceRef.current) return '';
        return crepeInstanceRef.current.getMarkdown();
      },
    }));

    useEffect(() => {
      if (!editorRootRef.current) return;

      if (crepeInstanceRef.current) {
        crepeInstanceRef.current.destroy();
        crepeInstanceRef.current = null;
      }
      
      const crepe = new Crepe({
        root: editorRootRef.current,
        defaultValue: initialValue,
      });

      crepeInstanceRef.current = crepe;
      
      crepe.create()
        .then(() => {
          // Use the .on() method from the Crepe instance.
          // The `api` object passed to this callback is the ListenerManager.
          crepe.on((api) => {
            // FIXED: Use the 'markdownUpdated' method, which exists on the ListenerManager.
            // This is the most direct and efficient way to get markdown changes.
            api.markdownUpdated((_ctx: Ctx, markdown: string, prevMarkdown: string) => {
              if (markdown !== prevMarkdown) {
                onContentChange(markdown);
              }
            });
          });
        })
        .catch((error: unknown) => {
            console.error("Failed to create Milkdown editor:", error);
        });

      return () => {
        if (crepeInstanceRef.current) {
          crepeInstanceRef.current.destroy();
          crepeInstanceRef.current = null;
        }
      };
    }, [initialValue, onContentChange]);

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