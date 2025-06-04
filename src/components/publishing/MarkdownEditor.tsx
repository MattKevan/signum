// src/components/publishing/MarkdownEditor.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (bodyContent: string) => void;
}

export default function MarkdownEditor({ initialValue, onChange }: MarkdownEditorProps) {
  const [currentValue, setCurrentValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Only update if initialValue truly differs from currentValue to avoid cursor jumps
    // This is important if parent re-renders frequently but initialValue for editor hasn't changed
    if (initialValue !== currentValue) {
      setCurrentValue(initialValue);
    }
  }, [initialValue, currentValue]); // Added currentValue back as per ESLint, condition handles loops

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    setCurrentValue(newValue);
    onChange(newValue); 
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const { selectionStart, selectionEnd } = target;
      const tab = '  ';
      
      const newValue = currentValue.substring(0, selectionStart) + tab + currentValue.substring(selectionEnd);
      
      setCurrentValue(newValue);
      onChange(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + tab.length;
        }
      }, 0);
    }
  };

  return (
    <Textarea
      ref={textareaRef}
      value={currentValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={
`# Your Main Heading

Start writing your Markdown content here.`}
      className="w-full flex-1 font-mono text-sm min-h-[calc(100%-50px)] 
                 p-4 border rounded-md shadow-sm 
                 focus-visible:ring-1 focus-visible:ring-ring"
      // Adjusted min-height assuming parent provides fixed height for overall editor area
    />
  );
}