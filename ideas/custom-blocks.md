Specification: The Signum Dynamic Block System
Version: 1.0
Status: Future Development Idea

1. Introduction & Goals

The Dynamic Block System is a proposed feature to significantly enhance the power and reusability of Signum themes and layouts. It allows developers to create custom, data-driven components that can be inserted directly into content by users via a simple editor interface.

Primary Goals:

Empower Theme/Layout Developers: Allow developers to create reusable components that can fetch and display site-wide data (e.g., a list of recent posts, a gallery of images from a specific folder).
Simplify for Content Creators: Provide a simple, "no-code" experience for users to insert complex components into their pages using a familiar slash menu and configuration forms.
Maintain Architectural Integrity: Keep a clear separation between the real-time editing environment and the build-time rendering pipeline, ensuring performance and security.
Leverage Existing Infrastructure: Reuse the existing JSON Schema for configuration and Handlebars for templating, providing a consistent development experience.

2. System Architecture Overview
The system operates in three distinct stages: Declaration, Editing, and Rendering. It uses a text-based Shortcode as an intermediary to bridge the gap between the editor's block-based structure and the final rendered HTML.

3. Stage 1: Block Declaration
A developer declares a custom block within a layout's layout.json file by adding a customBlocks array.

3.1. customBlocks Array in layout.json
Each object in the customBlocks array represents one new available block and adheres to the CustomBlockDefinition interface.

{
  "name": "Homepage Layout",
  "type": "page",
  "partials": { "latestPostsCard": "partials/card.hbs" },
  "customBlocks": [
    {
      "id": "latestPostsBlock",
      "name": "Latest Posts",
      "icon": "list", 
      "description": "Displays a list of recent posts from a collection.",
      "template": "partials/latest-posts.hbs",
      "schema": {
        "title": "Latest Posts Options",
        "type": "object",
        "properties": {
          "header": { "type": "string", "title": "Block Header", "default": "From the Blog" },
          "sourceCollection": { "type": "string", "title": "Source Collection Slug" },
          "count": { "type": "integer", "title": "Number of Posts", "default": 3 }
        },
        "required": ["sourceCollection"]
      }
    }
  ]
}
Use code with caution.
Json
3.2. CustomBlockDefinition Interface
id (string, required): A unique, machine-readable identifier for the block (e.g., latestPostsBlock). This ID must be unique within the layout.
name (string, required): A human-friendly name displayed in the editor's slash menu (e.g., "Latest Posts").
icon (string, optional): The name of a Lucide icon to display in the slash menu.
description (string, optional): A brief explanation of what the block does, shown as a tooltip in the editor.
template (string, required): The path to the Handlebars template file used to render the block's final HTML. The path is relative to the layout's root directory.
schema (JSONSchema, required): A standard JSON Schema object that defines the configurable properties (props) for this block. This schema will be used to automatically generate a configuration form within the editor.
3.3. Block Template (.hbs)
The developer creates a standard Handlebars template. This template will receive a data context containing:

All the props configured by the user in the editor.
Any data fetched by the rendering engine based on those props (e.g., an array of posts).
Example: partials/latest-posts.hbs

<section class="my-8">
    <h2 class="text-2xl font-bold mb-4">{{header}}</h2>
    {{#if posts}}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {{#each posts}}
                {{!-- The 'latestPostsCard' partial is also defined in this layout --}}
                {{> latestPostsCard this}}
            {{/each}}
        </div>
    {{else}}
        <p class="text-gray-500">No posts found in collection '{{sourceCollection}}'.</p>
    {{/if}}
</section>
Use code with caution.
Handlebars
4. Stage 2: Editing Experience
The Signum editor must be updated to discover and manage these custom blocks.

4.1. Dynamic Registration with Blocknote
When the editor loads a page, it will parse the page's associated layout.json.
It will iterate through the customBlocks array.
For each definition, it will use the Blocknote BlockSpec API to dynamically create and register a new block type. The id from the definition will be used as the block's type in Blocknote's internal state.
4.2. Editor UI
Slash Menu: The name and icon from the definition will be used to create a new entry in the editor's slash command menu.
Placeholder Rendering: When a user inserts a dynamic block, it will not render a live preview. Instead, it will render a standard React component within the editor that acts as a placeholder. This placeholder will:
Display the block's name and icon.
Render a configuration form using the existing SchemaDrivenForm component, passing it the schema from the block's definition.
The form will manage the block's props object in the Blocknote document state.
4.3. Serialization to Markdown (The Shortcode Bridge)
This is the critical link between the editor and the renderer.

The Blocknote-to-Markdown serialization process will be modified.
When the serializer encounters a custom block (e.g., one with type: "latestPostsBlock"), it will not attempt to convert it to standard Markdown.
Instead, it will generate a self-contained Shortcode: a single line of text that encodes the block's type and its configured props.
Shortcode Format:
[[SIGNUM_BLOCK type="[id]" props='[json_string]']]

Example:
The block configured in the UI will be serialized into the .md file as:
[[SIGNUM_BLOCK type="latestPostsBlock" props='{"header":"From the Blog","sourceCollection":"blog","count":3}']]

The props object is stringified and enclosed in single quotes to ensure the entire string can be parsed reliably.

5. Stage 3: Rendering & Exporting
The themeEngine and siteExporter will be updated to process these shortcodes during the site build.

5.1. Shortcode Pre-processor
A new pre-processing step will be added to the themeEngine.render() function.
This step will run before the main content string is passed to the marked library.
It will use a regular expression to find all [[SIGNUM_BLOCK ...]] shortcodes in the content.
5.2. Shortcode Execution
For each shortcode found, the pre-processor will execute the following logic:

Parse: Extract the type and props attributes from the shortcode string. The props JSON string will be parsed back into an object.
Lookup: Find the corresponding CustomBlockDefinition in the current layout's layout.json using the type as the id. This provides the path to the Handlebars template.
Fetch Data: This is the "dynamic" step. The processor will execute data-fetching logic based on the block's type and props.
For a latestPostsBlock, it would query the site's full contentFiles array, filter by the sourceCollection prop, sort by date, and limit by the count prop.
Prepare Context: It will create a data context for the Handlebars template by merging the fetched data (e.g., a posts array) with the props from the shortcode.
Render Partial: It will render the block's Handlebars template with the prepared data context. This generates the final HTML snippet for the block.
Replace: It will replace the original shortcode text in the main content string with the newly rendered HTML snippet.
5.3. Final Render
After the pre-processor has run and replaced all shortcodes, the modified content string—now a mix of Markdown and pre-rendered HTML—is passed to the marked sanitizer and parser, and the rest of the rendering pipeline continues as normal. The siteExporter requires no changes, as it simply calls the updated themeEngine.