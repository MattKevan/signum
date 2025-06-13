// src/hooks/useContentEditorState.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { MarkdownFrontmatter } from '@/types';
import { findNodeByPath } from '@/lib/fileTreeUtils';
import * as localSiteFs from '@/lib/localSiteFs';
import { parseMarkdownString } from '@/lib/markdownParser';
import { NEW_FILE_SLUG_MARKER, DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { toast } from 'sonner';

/**
 * Defines the possible loading states of the content editor.
 * - `initializing`: The initial state or when navigating to a new page.
 * - `loading_content`: The state when lazy-loading site-wide content files for the first time.
 * - `ready`: The editor has all necessary data and can be rendered.
 * - `not_found`: The requested content file could not be found.
 * - `error`: An unexpected error occurred.
 */
export type EditorStatus = 'initializing' | 'loading_content' | 'ready' | 'not_found' | 'error';

/**
 * Represents the complete state required by the content editor UI to render a page.
 * This is the data payload that is delivered when the status becomes 'ready'.
 */
export interface EditorState {
  frontmatter: MarkdownFrontmatter;
  bodyContent: string;
  layoutPath: string;
  slug: string;
}

/**

 * A custom hook that orchestrates the entire data loading and state management
 * for the main content editor (`EditContentPage`). It handles lazy-loading,
 * file fetching, parsing, and provides a clean status and data payload to the UI,
 * preventing race conditions and loading freezes.
 *
 * @param siteId The unique identifier of the site being edited.
 * @param slugSegments An array of URL segments that identify the content file.
 * @returns An object containing the current status, the editor's state data,
 *          and other relevant information for the UI.
 */
export function useContentEditorState(siteId: string, slugSegments: string[]) {
  const loadContentForSite = useAppStore(state => state.loadContentForSite);
  const siteManifest = useAppStore(useCallback(state => state.getSiteById(siteId)?.manifest, [siteId]));
  const siteContentFiles = useAppStore(useCallback(state => state.getSiteById(siteId)?.contentFiles, [siteId]));

  const [status, setStatus] = useState<EditorStatus>('initializing');
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isNewFileMode, setIsNewFileMode] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState('');
  
  // A ref to act as a lock, preventing re-entrant calls to the async lazy-load function.
  const isLoadingContent = useRef(false);


  /**
   * Effect 1: This is now the ONLY effect. It is a single, cohesive state machine.
   * It handles path calculation, state resets, and data loading in a clear, sequential manner.
   */
  useEffect(() => {
    console.group(`[Effect] State Machine Triggered`);

    // --- Step 1: Calculate Path and Mode ---
    // This happens synchronously at the start of the effect.
    console.log('Input slugSegments:', slugSegments);
    const isNewIntent = slugSegments.includes(NEW_FILE_SLUG_MARKER);
    setIsNewFileMode(isNewIntent);

    let newPath = '';
    if (isNewIntent) {
      const newMarkerIndex = slugSegments.indexOf(NEW_FILE_SLUG_MARKER);
      const parentSlug = newMarkerIndex > 0 ? slugSegments.slice(0, newMarkerIndex).join('/') : '';
      newPath = parentSlug ? `content/${parentSlug}` : 'content';
    } else {
      const pathParts = slugSegments.length > 0 ? slugSegments.join('/') : 'index';
      newPath = `content/${pathParts}.md`;
    }
    setCurrentFilePath(newPath);
    console.log(`Calculated Path: "${newPath}", Mode: ${isNewIntent ? 'New File' : 'Edit File'}`);

    // --- Step 2: Reset State for New Navigation ---
    // This ensures we show a loading screen on every path change.
    setStatus('initializing');
    setEditorState(null);
    isLoadingContent.current = false; // Reset lock

    const loadAndProcessContent = async () => {
      // --- Step 3: Guard against missing prerequisites ---
      // If the manifest isn't loaded yet, we can't do anything. Exit and wait for a re-run.
      if (!siteManifest) {
        console.warn('WAITING: Manifest is not yet available.');
        console.groupEnd();
        return;
      }
      console.log('CHECK: Manifest is loaded.');

      // --- Step 4: Handle Lazy-Loading ---
      if (!siteContentFiles) {
        if (isLoadingContent.current) {
          console.warn('WAITING: Lazy-load is already in progress.');
          console.groupEnd();
          return;
        }
        
        console.log('%cACTION: Content files not loaded. Triggering lazy-load...', 'color: orange;');
        isLoadingContent.current = true;
        setStatus('loading_content');
        await loadContentForSite(siteId);
        // Exit. The effect will re-run when `siteContentFiles` is populated.
        console.groupEnd();
        return;
      }
      
      console.log('CHECK: Content files are loaded.');
      isLoadingContent.current = false;

      // --- Step 5: Process the data ---
      console.log(`PROCESSING: path "${newPath}"`);
      if (isNewIntent) {
        const parentNode = findNodeByPath(siteManifest.structure, newPath);
        setEditorState({
          layoutPath: parentNode?.itemLayout || DEFAULT_PAGE_LAYOUT_PATH,
          frontmatter: { title: '', date: new Date().toISOString().split('T')[0], status: 'draft' },
          bodyContent: '# Start writing...',
          slug: '',
        });
        setStatus('ready');
        console.log('%cSUCCESS: Editor state set for new file.', 'color: green;');
      } else {
        const fileNode = findNodeByPath(siteManifest.structure, newPath);
        const rawContent = await localSiteFs.getContentFileRaw(siteId, newPath);
        
        console.log('Lookup (Manifest Node):', fileNode);
        console.log('Lookup (Raw Content):', rawContent ? 'Found' : 'Not Found');

        if (fileNode && rawContent !== null) {
          const { frontmatter, content } = parseMarkdownString(rawContent);
          setEditorState({
            frontmatter,
            bodyContent: content,
            layoutPath: fileNode.layout,
            slug: fileNode.slug,
          });
          setStatus('ready');
          console.log('%cSUCCESS: Editor state set from loaded file.', 'color: green;');
        } else {
          toast.error(`Content not found at path: ${newPath}`);
          setStatus('not_found');
          console.error(`%cFAILURE: Could not find node or content for path "${newPath}".`, 'color: red;');
        }
      }
    };

    loadAndProcessContent();
    console.groupEnd();

  // The dependency array now correctly models what should trigger a full re-evaluation.
  }, [slugSegments, siteManifest, siteContentFiles, siteId, loadContentForSite]);

  return { status, editorState, setEditorState, isNewFileMode, currentFilePath };
}