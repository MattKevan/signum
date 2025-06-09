// src/lib/themeEngine.ts
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import { PageResolutionResult, PageType } from './pageResolver';
import { LocalSiteData, Manifest, NavLinkItem, ParsedMarkdownFile, StructureNode, ThemeConfig } from '@/types';
import { generateNavLinks } from './navigationUtils';

import baseSchemaFile from '@/config/base.schema.json';

// --- Type Definitions for this module ---

export interface ThemeInfo {
  id: string;
  name: string;
  type: 'core' | 'contrib';
}

export interface ThemeLayout {
  id: string;
  name: string;
  type: 'page' | 'collection';
}

export interface LayoutSchema {
  schema: RJSFSchema;
  uiSchema?: UiSchema;
  itemSchema?: RJSFSchema;
  itemUiSchema?: UiSchema;
}

interface SchemaFile {
    schema: RJSFSchema;
    uiSchema?: UiSchema;
}
interface ThemeManifestFile {
    layouts: string[];
    partials?: { [key: string]: string };
    appearanceSchema?: RJSFSchema;
}

interface TemplateContext {
    manifest: Manifest;
    themeConfig: ThemeConfig['config'];
    navLinks: NavLinkItem[];
    year: number;
    pageTitle: string;
    body: string;
    frontmatter?: ParsedMarkdownFile['frontmatter'];
    contentHtml?: string;
    collectionNode?: StructureNode;
    items?: ParsedMarkdownFile[];
}

// --- Caching and Private Helpers ---
const templateCache: { [key: string]: Handlebars.TemplateDelegate } = {};
const jsonCache: { [key: string]: object } = {};
let lastRegisteredTheme = '';
// CORRECTED: Use a simple boolean flag at the module level.
let helpersHaveBeenRegistered = false;

async function getJsonFile<T extends object>(path: string): Promise<T | null> {
  if (jsonCache[path]) {
    return jsonCache[path] as T;
  }
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const data = await response.json();
    jsonCache[path] = data;
    return data as T;
  } catch {
    return null;
  }
}

async function getTemplate(path: string): Promise<Handlebars.TemplateDelegate> {
  if (templateCache[path]) return templateCache[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Template not found: ${path}`);
  const source = await res.text();
  const template = Handlebars.compile(source);
  templateCache[path] = template;
  return template;
}

function registerHelpers() {
    // CORRECTED: Check the simple boolean flag. This is cleaner and type-safe.
    if (helpersHaveBeenRegistered) return;
    
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    Handlebars.registerHelper('formatDate', (date: string | Date) => {
        try {
            const d = new Date(date);
            return new Intl.DateTimeFormat('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }).format(d);
        } catch {
            return String(date);
        }
    });
    // Set the flag after registration.
    helpersHaveBeenRegistered = true;
}


async function registerPartials(themeId: string, themeType: 'core' | 'contrib') {
    const themeIdentifier = `${themeType}-${themeId}`;
    if (lastRegisteredTheme === themeIdentifier) return;

    const partialNames = Object.keys(Handlebars.partials);
    partialNames.forEach(name => Handlebars.unregisterPartial(name));

    const themePath = `/themes/${themeType}/${themeId}`;
    const themeManifest = await getJsonFile<ThemeManifestFile>(`${themePath}/theme.json`);
    
    const partialsToRegister = themeManifest?.partials || {};

    for (const name in partialsToRegister) {
        try {
            const path = partialsToRegister[name as keyof typeof partialsToRegister];
            const templateString = await fetch(path).then(res => res.text());
            Handlebars.registerPartial(name, templateString);
        } catch (e) {
            console.warn(`Could not register partial: ${name} from path ${partialsToRegister[name as keyof typeof partialsToRegister]}`, e);
        }
    }
    lastRegisteredTheme = themeIdentifier;
}


function mergeSchemas(base: SchemaFile, extension: SchemaFile | null): SchemaFile {
    if (!extension) return base;

    const mergedSchema: RJSFSchema = {
        ...base.schema,
        ...extension.schema,
        properties: {
            ...(base.schema.properties || {}),
            ...(extension.schema.properties || {}),
        },
    };
    if (extension.schema.required) {
        mergedSchema.required = [...new Set([...(base.schema.required || []), ...extension.schema.required])];
    }

    const mergedUiSchema: UiSchema = {
        ...base.uiSchema,
        ...extension.uiSchema,
    };

    return { schema: mergedSchema, uiSchema: mergedUiSchema };
}


// --- Public API ---

export async function getAvailableThemes(): Promise<ThemeInfo[]> {
    const coreThemesPromise = getJsonFile<Omit<ThemeInfo, 'type'>[]>(`/themes/core/themes.json`);
    const contribThemesPromise = getJsonFile<Omit<ThemeInfo, 'type'>[]>(`/themes/contrib/themes.json`);

    const [coreThemes, contribThemes] = await Promise.all([coreThemesPromise, contribThemesPromise]);

    const allThemes: ThemeInfo[] = [];

    if (coreThemes) {
        allThemes.push(...coreThemes.map(t => ({ ...t, type: 'core' as const })));
    }
    if (contribThemes) {
        allThemes.push(...contribThemes.map(t => ({ ...t, type: 'contrib' as const })));
    }
    
    allThemes.sort((a, b) => a.name.localeCompare(b.name));

    return allThemes;
}

export async function getThemeAppearanceSchema(themeId: string, themeType: 'core' | 'contrib'): Promise<RJSFSchema | null> {
    const themeManifest = await getJsonFile<ThemeManifestFile>(`/themes/${themeType}/${themeId}/theme.json`);
    return themeManifest?.appearanceSchema || null;
}


export async function getLayoutSchema(themeId: string, themeType: 'core' | 'contrib', layoutId: string): Promise<LayoutSchema | null> {
  const layoutPath = `/themes/${themeType}/${themeId}/layouts/${layoutId}`;

  const coreBaseSchema = baseSchemaFile as SchemaFile;

  const mainLayoutSchemaFile = await getJsonFile<SchemaFile>(`${layoutPath}/schema.json`);
  const itemLayoutSchemaFile = await getJsonFile<SchemaFile>(`${layoutPath}/item.schema.json`);

  let finalItemSchema: SchemaFile | null = null;
  
  if (itemLayoutSchemaFile) {
    finalItemSchema = mergeSchemas(coreBaseSchema, itemLayoutSchemaFile);
  } else {
    finalItemSchema = coreBaseSchema;
  }

  const primarySchema = mainLayoutSchemaFile || finalItemSchema;

  if (!primarySchema) {
    return null;
  }

  return {
    schema: primarySchema.schema,
    uiSchema: primarySchema.uiSchema,
    itemSchema: finalItemSchema?.schema,
    itemUiSchema: finalItemSchema?.uiSchema,
  };
}

export async function getAvailableLayouts(themeId: string, themeType: 'core' | 'contrib'): Promise<ThemeLayout[]> {
  const themePath = `/themes/${themeType}/${themeId}/theme.json`;
  const themeManifest = await getJsonFile<ThemeManifestFile>(themePath);

  if (!themeManifest || !Array.isArray(themeManifest.layouts)) {
    console.error(`Theme manifest not found or invalid for theme: ${themeId}`);
    return [];
  }

  const layouts: ThemeLayout[] = [];

  for (const layoutId of themeManifest.layouts) {
    const schemaData = await getLayoutSchema(themeId, themeType, layoutId);
    if (!schemaData) {
      console.warn(`Layout "${layoutId}" in theme "${themeId}" is missing its required schema files.`);
      continue;
    }

    const isCollection = !!schemaData.itemSchema;
    
    const relevantSchema = isCollection ? schemaData.schema : schemaData.itemSchema;
    
    layouts.push({
      id: layoutId,
      name: relevantSchema?.title || layoutId.charAt(0).toUpperCase() + layoutId.slice(1),
      type: isCollection ? 'collection' : 'page',
    });
  }
  return layouts;
}

export async function render(
    siteData: LocalSiteData, 
    resolution: PageResolutionResult,
    siteRootPath: string
): Promise<string> {
  const themeId = siteData.manifest.theme.name;
  const themeType = siteData.manifest.theme.type;
  const themePath = `/themes/${themeType}/${themeId}`;

  registerHelpers();
  await registerPartials(themeId, themeType);
  
  const baseTemplate = await getTemplate(`${themePath}/base.hbs`);
  const navLinks = generateNavLinks(siteData, { isStaticExport: false, siteRootPath });

  let bodyHtml = '<h1>Error</h1><p>Could not render content.</p>';
  let pageTitle = 'Error';

  const context: Partial<TemplateContext> = {
      manifest: siteData.manifest,
      themeConfig: siteData.manifest.theme.config,
      navLinks,
      year: new Date().getFullYear(),
  };

  switch(resolution.type) {
    case PageType.SinglePage: {
        const layoutTemplatePath = `${themePath}/layouts/${resolution.layout}/item.hbs`;
        const layoutTemplate = await getTemplate(layoutTemplatePath);
        
        pageTitle = resolution.pageTitle;
        context.frontmatter = resolution.contentFile.frontmatter;
        context.contentHtml = await marked.parse(resolution.contentFile.content);
        bodyHtml = layoutTemplate(context);
        break;
    }
    case PageType.Collection: {
        const layoutTemplatePath = `${themePath}/layouts/${resolution.layout}/index.hbs`;
        const layoutTemplate = await getTemplate(layoutTemplatePath);
        
        pageTitle = resolution.pageTitle;
        context.collectionNode = resolution.collectionNode;
        context.items = resolution.items.map(item => ({
            ...item,
            contentHtml: marked.parse(item.content)
        }));
        bodyHtml = layoutTemplate(context);
        break;
    }
    case PageType.NotFound: {
        pageTitle = 'Not Found';
        bodyHtml = `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
        break;
    }
  }

  context.body = bodyHtml;
  context.pageTitle = pageTitle;

  return baseTemplate(context as TemplateContext);
}