// src/themes/default/engine.ts (NEW FILE)
import Handlebars from 'handlebars';

// A simple cache to hold compiled templates
const templateCache: { [key: string]: Handlebars.TemplateDelegate } = {};

/**
 * Fetches and compiles a Handlebars template. Caches the result.
 * @param path The path to the .hbs template file (e.g., /themes/default/layout.hbs)
 * @returns A compiled Handlebars template function.
 */
async function getTemplate(path: string): Promise<Handlebars.TemplateDelegate> {
  if (templateCache[path]) {
    return templateCache[path];
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${path}`);
  }
  const templateString = await response.text();
  const compiledTemplate = Handlebars.compile(templateString);
  templateCache[path] = compiledTemplate;
  return compiledTemplate;
}

/**
 * The main ThemeEngine that orchestrates the rendering process.
 */
export const ThemeEngine = {
  /**
   * Loads all partial templates and registers them with Handlebars.
   * This should be called once when the theme is initialized.
   */
  async initializePartials() {
    // List of partials to register. The key is the name used in templates (e.g., {{> head}})
    const partialsToRegister: { [key: string]: string } = {
      head: '/themes/default/partials/head.hbs',
      header: '/themes/default/partials/header.hbs',
      footer: '/themes/default/partials/footer.hbs',
      '_nav-item': '/themes/default/partials/_nav-item.hbs', // A recursive partial for navigation
    };

    for (const name in partialsToRegister) {
      const path = partialsToRegister[name];
      const template = await getTemplate(path); // This also caches the partial's template
      Handlebars.registerPartial(name, template);
    }
  },

  /**
   * Renders a complete page using the main layout template and a data context.
   * @param data The context object containing all necessary data (manifest, themeConfig, etc.)
   * @returns The fully rendered HTML string.
   */
  async render(data: object): Promise<string> {
    const layoutTemplate = await getTemplate('/themes/default/layout.hbs');
    return layoutTemplate(data);
  },
};