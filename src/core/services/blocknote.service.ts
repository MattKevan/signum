// src/core/services/blocknote.service.ts
import { Block, BlockNoteEditor } from '@blocknote/core';

/**
 * Converts a Markdown string into an array of Blocknote `Block` objects.
 * This works by creating a headless editor and using the `tryParseMarkdownToBlocks`
 * instance method, as described in the official Blocknote documentation.
 *
 * @param markdown The Markdown string to convert.
 * @returns A promise that resolves to an array of Blocks.
 */
export async function markdownToBlocks(markdown: string): Promise<Block[]> {
  // 1. Create a temporary, "headless" editor instance.
  const editor = await BlockNoteEditor.create();
  
  // 2. Use the editor's `tryParseMarkdownToBlocks` method to perform the conversion.
  // This is the correct method according to the documentation.
  const blocks = await editor.tryParseMarkdownToBlocks(markdown);
  
  return blocks;
}

/**
 * Converts an array of Blocknote `Block` objects into a Markdown string.
 * This works by creating a headless editor pre-populated with the blocks
 * and then using its instance method to serialize them to Markdown.
 *
 * @param blocks The array of Blocks to convert.
 * @returns A promise that resolves to a Markdown string.
 */
export async function blocksToMarkdown(blocks: Block[]): Promise<string> {
  // 1. Create a temporary, "headless" editor with the blocks as initial content.
  // We need to do this so we have an instance to call the method on.
  const editor = await BlockNoteEditor.create({
    initialContent: blocks,
  });
  
  // 2. Use the editor's `blocksToMarkdownLossy` instance method for the conversion.
  // The documentation confirms this is the correct method.
  const markdown = await editor.blocksToMarkdownLossy();

  return markdown;
}