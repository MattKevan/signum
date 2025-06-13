// src/hooks/useContentEditorState.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import type { MarkdownFrontmatter } from '@/types';
import { findNodeByPath } from '@/lib/fileTreeUtils';
import * as localSiteFs from '@/lib/localSiteFs';
import { parseMarkdownString } from '@/lib/markdownParser';
import { NEW_FILE_SLUG_MARKER, DEFAULT_PAGE_LAYOUT_PATH } from '@/config/editorConfig';
import { toast } from 'sonner';

/**
 * Defines the possible loading states of the content editor.
 * - `initializing`: The initial state or when navigating to a new page.
 * - `loading_content`: The state when the component is waiting for site-wide content files to be loaded into the store.
 * - `ready`: The editor has all necessary data and can be rendered.
 * - `not_found`: The requested content file or its manifest entry could not be found.
 */
export type EditorStatus = 'initializing' | 'loading_content' | 'ready' | 'not_found';

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
 * A custom hook that orchestrates the data loading and state management
 * for the main content editor (`EditContentPage`). It handles lazy-loading,
 * file fetching, parsing, and provides a clean status and data payload to the UI,
 * preventing race conditions and loading freezes.
 *
 * This hook *reacts* to the state of the `useAppStore`. It expects that another
 * component (like `SiteLoaderLayout`) is responsible for *commanding* the store
 * to load the site data via the `loadSite` action.
 *
 * @param {string} siteId The unique identifier of the site being edited.
 * @param {string[]} slugSegments An array of URL segments that identify the content file.
 * @returns {object} An object containing the current status, the editor's state data,
 *          and other relevant information for the UI.
 */
export function useContentEditorState(siteId: string, slugSegments: string[]) {
  // Subscribe to the entire site object from the store.
  // Zustand's shallow comparison will trigger a re-render when the object is updated (e.g., when `contentFiles` is added).
  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));

  const [status, setStatus] = useState<EditorStatus>('initializing');
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  // Memoize the calculation of the mode and file path from URL segments.
  const { isNewFileMode, currentFilePath } = useMemo(() => {
    const isNewIntent = slugSegments.includes(NEW_FILE_SLUG_MARKER);
    let path = '';
    if (isNewIntent) {
      // For a new file, the path is the parent directory.
      const newMarkerIndex = slugSegments.indexOf(NEW_FILE_SLUG_MARKER);
      const parentSlug = newMarkerIndex > 0 ? slugSegments.slice(0, newMarkerIndex).join('/') : '';
      path = parentSlug ? `content/${parentSlug}` : 'content';
    } else {
      // For an existing file, construct the full file path.
      const pathParts = slugSegments.length > 0 ? slugSegments.join('/') : 'index';
      path = `content/${pathParts}.md`;
    }
    return { isNewFileMode: isNewIntent, currentFilePath: path };
  }, [slugSegments]);


  /**
   * The main state machine effect. It runs whenever the site data or URL changes.
   * It follows a clear sequence of checks to determine the editor's state.
   */
  useEffect(() => {
    console.group(`[useContentEditorState] State Machine Triggered`);
    console.log(`> Path: "${currentFilePath}", Mode: ${isNewFileMode ? 'New File' : 'Edit File'}`);

    // Always reset state on re-run to ensure a clean loading sequence.
    setStatus('initializing');
    setEditorState(null);

    const processContent = async () => {
      // --- Guard 1: Is the site object (with manifest) loaded in the store? ---
      if (!site?.manifest) {
        console.warn(`> WAITING: Site object or manifest for "${siteId}" not yet available in store.`);
        console.groupEnd();
        return;
      }
      console.log('> CHECK PASSED: Manifest is loaded.');

      // --- Guard 2: Are the site's content files loaded in the store? ---
      if (!site.contentFiles) {
        console.warn('> WAITING: Content files for this site are not yet loaded. Setting status to "loading_content".');
        setStatus('loading_content'); // This is the state the UI shows "Loading Site Content..."
        console.groupEnd();
        return;
      }
      console.log('> CHECK PASSED: Content files are loaded.');

      // --- Data is ready, proceed with processing ---
      console.log('> PROCESSING: Preparing editor state...');

      if (isNewFileMode) {
        // Handle the creation of a new, unsaved file.
        const parentNode = findNodeByPath(site.manifest.structure, currentFilePath);
        setEditorState({
          layoutPath: parentNode?.itemLayout || DEFAULT_PAGE_LAYOUT_PATH,
          frontmatter: { title: '', date: new Date().toISOString().split('T')[0], status: 'draft' },
          bodyContent: '# Start writing...',
          slug: '',
        });
        setStatus('ready');
        console.log('%c> SUCCESS: Editor state set for a new file.', 'color: green');
      } else {
        // Handle loading an existing file.
        const fileNode = findNodeByPath(site.manifest.structure, currentFilePath);
        const rawContent = await localSiteFs.getContentFileRaw(siteId, currentFilePath);

        if (fileNode && rawContent !== null) {
          const { frontmatter, content } = parseMarkdownString(rawContent);
          setEditorState({
            frontmatter,
            bodyContent: content,
            layoutPath: fileNode.layout,
            slug: fileNode.slug,
          });
          setStatus('ready');
          console.log('%c> SUCCESS: Editor state set from loaded file.', 'color: green');
        } else {
          toast.error(`Content not found at path: ${currentFilePath}`);
          setStatus('not_found');
          console.error(`%c> FAILURE: Could not find node or content for path "${currentFilePath}".`, 'color: red');
        }
      }
    };

    processContent();
    console.groupEnd();

  // This dependency array ensures the effect re-runs whenever the URL changes or the site data is updated in the store.
  }, [site, siteId, currentFilePath, isNewFileMode]);

  return {
    /** The current loading status of the editor. */
    status,
    /** The data required by the editor UI, available when status is 'ready'. */
    editorState,
    /** A function to allow the UI to update the editor's state (e.g., on title change). */
    setEditorState,
    /** A boolean indicating if the editor is for a new, unsaved file. */
    isNewFileMode,
    /** The full path of the content being edited or the parent path for a new file. */
    currentFilePath,
  };
}