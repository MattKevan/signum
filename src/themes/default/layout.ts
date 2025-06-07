// src/themes/default/layout.ts
import { Manifest, NavLinkItem, ThemeConfig } from '@/types';
import { ThemeEngine } from './engine';

let isThemeEngineInitialized = false;

/**
 * This is now the single entry point for rendering a page with the theme.
 * It prepares the data context and calls the ThemeEngine.
 */
export async function renderPageLayout(
  manifest: Manifest,
  themeConfig: ThemeConfig['config'],
  pageTitle: string,
  navLinks: NavLinkItem[],
  mainContentHtml: string,
): Promise<string> { // Return a promise as rendering is now async
  
  if (!isThemeEngineInitialized) {
    await ThemeEngine.initializePartials();
    isThemeEngineInitialized = true;
  }

  // Create the complete data context for Handlebars
  const context = {
    manifest,
    themeConfig,
    pageTitle,
    navLinks,
    mainContentHtml,
    year: new Date().getFullYear(),
  };

  return ThemeEngine.render(context);
}