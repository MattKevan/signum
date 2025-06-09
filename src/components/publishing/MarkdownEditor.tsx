// src/components/publishing/MarkdownEditor.tsx
'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Crepe } from "@milkdown/crepe";
import { Editor } from '@milkdown/core';
import { getMarkdown } from '@milkdown/utils'; // docChanged is not needed

// Import styles
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "@milkdown/crepe/theme/frame-dark.css";

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
    const editorInstanceRef = useRef<Editor | null>(null);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editorInstanceRef.current) return '';
        return editorInstanceRef.current.action(getMarkdown());
      },
    }));

    useEffect(() => {
      if (!editorRootRef.current) return;
      let editor: Editor | null = null;

      Crepe.create({
        root: editorRootRef.current,
        defaultValue: initialValue,
      })
      .then((instance) => {
        editor = instance;
        editorInstanceRef.current = instance;
        
        // FIXED: Use the modern listener API and ignore unused parameters with underscores.
        instance.listener.updated((_ctx, _doc, _prevDoc) => {
            const markdown = instance.action(getMarkdown());
            onContentChange(markdown);
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to create Milkdown editor:", error);
      });

      return () => {
        if (editor) {
            editor.destroy();
            editor = null;
            editorInstanceRef.current = null;
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