// src/components/publishing/MarkdownEditor.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea'; // Assuming shadcn/ui Textarea

interface MarkdownEditorProps {
  initialValue: string; // The full raw markdown string (frontmatter + body)
  onChange: (value: string) => void;
  // Add other props like onSave, etc., if needed later
}

export default function MarkdownEditor({ initialValue, onChange }: MarkdownEditorProps) {
  // Use local state to manage the editor's content to avoid re-rendering
  // the entire page on every keystroke if onChange prop causes parent re-renders.
  // However, for controlled components, passing value directly from parent state is also common.
  // Let's keep it simple for now and assume parent handles debouncing or performance if needed.
  const [currentValue, setCurrentValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local state if initialValue prop changes (e.g., when a different file is loaded)
  useEffect(() => {
    setCurrentValue(initialValue);
  }, [initialValue]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    setCurrentValue(newValue);
    onChange(newValue); // Propagate change to parent immediately
  };

  // Optional: Add keyboard shortcuts like Tab for indentation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      // Insert tab character (or spaces)
      const tab = '  '; // Use 2 spaces for a tab, adjust as needed
      const newValue = currentValue.substring(0, start) + tab + currentValue.substring(end);
      
      setCurrentValue(newValue);
      onChange(newValue); // Propagate change

      // Move cursor after inserted tab
      // Needs a slight delay for the state update to reflect in the DOM
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + tab.length;
        }
      }, 0);
    }
  };

  return (
    <Textarea
      ref={textareaRef}
      value={currentValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown} // Add tab support
      placeholder={
`---
title: Your Post Title
date: YYYY-MM-DD 
# Add other frontmatter fields here, e.g.:
# tags: ["tag1", "tag2"]
# summary: "A brief summary of your post."
# draft: false
---

# Your Main Heading

Start writing your Markdown content here. 
Use standard Markdown syntax.

- Create lists
- **Bold text**
- *Italic text*
- [Links](https://example.com)
- \`Inline code\`

\`\`\`javascript
// Code blocks
function hello() {
  console.log("Hello, Signum!");
}
\`\`\`
`}
      className="w-full flex-1 font-mono text-sm min-h-[calc(100vh-250px)] 
                 p-4 border rounded-md shadow-sm 
                 focus-visible:ring-1 focus-visible:ring-ring" 
      // Adjust min-h as needed based on your layout's header/footer/button heights
      // Added some basic styling matching typical input fields
    />
  );
}