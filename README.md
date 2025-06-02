# Signum

Signum is a decentralised publishing platform where users retain complete ownership of their content and identity. It's designed to be as simple as possible to get started, while providing robust curation and moderation tools.

Content is primarily structured as plain text files with minimal formatting (Markdown, YAML). The Signum client is responsible for fetching, rendering, and presenting this content, offering the primary rich user experience. Published sites can be viewed in a basic form in a standard web browser, potentially with client-side rendering scripts or minimal server-generated HTML for SEO and accessibility. Social graph features, such as follows and curations, are managed through user-owned static files, which are processed client-side in an RSS-like fashion for updates.

## Core principles:

* User ownership: content and identity belong entirely to users.
* Privacy by design: No tracking, analytics, or surveillance in the core protocol or default published outputs.
* Simplicity first: Content creation in Markdown; client application handles presentation complexity.
* Content-first, client-rendered: Core content is structured text; the client application provides rich presentation and interactivity.
* Open and decentralized: No vendor lock-in, utilizing open protocols and formats.

## 1. Platform Architecture Overview

### 1.1 System Components

The Signum ecosystem comprises three main areas: user clients, hosting infrastructure, and an optional discovery network.

**User clients (Desktop/Web/Mobile):**

These applications are central to the Signum experience. They handle content creation via a text editor, configuration management, preparation of content bundles, publishing to hosting providers, content rendering, and client-side processing of social graph data (follows, blocks, curations) with RSS-like updates for feeds.

**Hosting infrastructure (stores content bundles):** 

Any basic HTTP server should be able to host a Signum site. Storage and resource usage should be minimal. This could be first-party hosting (e.g., signum.org), user self-hosting via FTP), or Git-backed hosting like GitHub Pages, Netlify, or Vercel. This infrastructure stores the static site bundles published by users.

**Discovery network (optional):**

These consists of distributed indexers that users can optionally announce their sites to. They are solely for content and site discovery (e.g., search by keyword/tag, identifying trending content based on site updates), not for social graph aggregation. Indexers will be an open standard, enabling anyone to host their own. Potentially indexers focusing on specific types of content (publications) could be created.

### 1.2 Data Flow

**Content Authoring:** The user creates content in Markdown and manages associated YAML files (site configuration, follows, blocks, curations, likes) using the client application.

**Content bundle preparation:** The client assembles a content bundle. This includes the Markdown files, all  configuration files, an rss.xml feed for content updates, and a manifest.json file detailing the bundle's structure and last update timestamps. Optionally, a minimal HTML wrapper and a client-side viewer script can be included in the bundle for basic web browser accessibility. 

The site format should be so simple that anyone could write an entire site by hand with minimal technical knowledge. The client is just an easier interface for doing this.

**Publishing:** The user uploads this content bundle to their chosen hosting provider. 

**Content consumption & social interaction (primarily via Signum client):** Users can view Signum sites in the client app. The client application then renders the Markdown content for display, applying any styling hints defined in the site's config file. It also processes the social files to build and maintain a local, personalized social graph and aggregated content feed. Signum clients periodically fetch updates from sites the user follows.

While Signum has basic follow/block abd curation features, it's a publishing platform first and foremost, not an ActivityPub/ATProto alternative.

**Basic Web viewing:** If a content bundle includes the optional web-viewer components, standard web browsers can access a minimal, client-side rendered view of the content or display pre-generated HTML metadata for SEO.

**Discovery network (optional):** The user can choose to announce their site's existence or updates to one or more indexers, making their content discoverable to a wider audience.

### 2. Technical specifications

## 2.1 Content format specification

A Signum site is published as a "content bundle", a structured collection of text files.

**Directory structure:** The root directory of a content bundle typically contains the main configuration, social interaction files (follows.yaml, blocks.yaml, curations.yaml, likes.yaml), a content/ subdirectory for Markdown articles, a manifest.json file, an rss.xml feed, and an optional web-viewer/ directory for basic browser access. The content/ directory will house index.md for the homepage, other pages such as about.md, and collection subdirectories (often posts/) for chronological entries. The web-viewer/ directory, if present, would contain a minimal index.html, a viewer.js script, and a basic style.css. These would be generated by the client and not user-editable.

**Site configuration (site.yaml):** This file contains the site's title, description, author information, a global lastUpdated timestamp for the entire bundle, and optional style_hints. Style hints might include preferences for font family (e.g., serif, sans-serif), theme (light, dark), and a primary highlight color. It also contains content_timestamps for different sections (e.g., posts, follows) which are used by manifest.json.

**Content format (Markdown + YAML frontmatter):** Content is written in standard Markdown. Each file can include a frontmatter block for metadata such as title, publication date, update date, tags, a summary, draft status etc. Content files can not contain embedded HTML or JavaScript to maintain security and simplicity.

**Social config files (follows.yaml, blocks.yaml, curations.yaml, likes.yaml):** These are simple YAML lists. For example, follows.yaml would list Site IDs or URLs, potentially with an alias or category. These files are public and are fetched by clients to build local social graphs. (Need to check for performance when these files get very long).

**Manifest (manifest.json):** This JSON file acts as a table of contents for the content bundle. It lists all significant files (content, social configs) and their last modification timestamps. This allows clients to efficiently determine what has changed since the last fetch.

**RSS Feed (rss.xml):** A standard RSS/Atom feed generated from the site's posts or other listable content. It includes item titles, links (which could point to raw Markdown files, Signum client URIs, or web-viewer URLs), publication dates, and summaries. This is essential for client feed readers and can aid in SEO.

### 2.2 Hosting architecture

The client application will feature a standardised interface for interacting with various hosting providers. This HostingAdapter interface will define methods for authentication, uploading a site's content bundle, retrieving site status, and deleting a site.

Built-in adapters will include:

* First-Party Hosting: A service potentially offered by Signum, offering free subdomains and premium custom domain options.
* Self-Host FTP/SFTP: For universal compatibility with traditional web hosting.
* Git-Based Hosts: Adapters for services like GitHub Pages.
* Static Hosting Platforms: Adapters for Netlify, Vercel, AWS S3, Cloudflare Pages, etc.
  
It's important that hosting providers are configured to serve files with appropriate caching headers (e.g., ETag, Last-Modified) to support efficient client polling for updates.

### 2.3 Social Features System (Client-Centric)

Social features in Signum are managed and experienced primarily within the client application.

**Following system:** Users define sites they follow in their follows.yaml file. Client applications fetch these files from followed sites (and potentially "sites of followed sites" up to a defined depth) to construct a local social graph. Blocking a site (via blocks.yaml) filters content from that site out of the user's view.

**Content likes (public bookmarks):** When a user "likes" a piece of content, its URL is added to their public likes.yaml file. This acts as a public bookmark. Other users' clients can discover these likes by fetching the likes.yaml file from the liker's site. There is no central aggregation of like counts. The allow_likes field in a post's frontmatter signals the author's consent for their content to be listed in this manner.

**Curation lists:** Users can create public collections of content links with optional notes in their curations.yaml file. Clients can fetch and display these lists, enabling cross-site content discovery based on user taste.

**Distributed moderation:** Moderation is primarily user-controlled via their personal blocks.yaml file. Clients use this list to filter content from their feeds. Optionally, clients may allow users to import or consult blocks.yaml files from other sites, trusted community members or designated "moderator" sites. There is no central moderation authority; indexers, if used, would focus on spam/abuse detection from a site discovery perspective to maintain the quality of their search results.

2.1 Cryptographic Identity System
User identity is based on Ed25519 elliptic curve cryptography. Each user generates a unique key pair (public and private key). The Site ID is derived by applying a SHA256 hash to the public key. Authentication into the client can be achieved via Passkeys (WebAuthn) or a BIP39-compliant seed phrase. All updates to a user's site configuration or content manifest should be cryptographically signed to ensure authenticity and integrity when fetched by other clients or indexers.

Security features include provisions for hardware-backed key storage where available, social recovery mechanisms through trusted contacts (defined by the user), and multiple backup options such as encrypted seed phrases and passkey synchronization. The system avoids traditional passwords and centralized account databases.


## 3. Client implementation

### 3.1 Technology stack

The primary client application will likely be a web application, with potential for future desktop (e.g., via Tauri) and mobile (e.g., via React Native) versions. Key technologies include:

* Frontend Framework: A modern JavaScript framework like Next.js (with App Router) or similar.
* Programming Language: TypeScript for type safety.
* Styling: A utility-first CSS framework like Tailwind CSS or similar.
* PWA Capabilities: To enable features like offline access and background synchronization for feed updates.
* Local Storage: IndexedDB for storing user identity data, site content bundles, cached content from followed sites, and the locally constructed social graph.
* Core Libraries: Libraries for cryptography, Markdown processing and rendering, YAML parsing, date utilities, and state management. An RSS/Atom feed parsing library will also be necessary.

### 3.2 Application architecture

The client application will have a modular structure. Key architectural components include:

* Content management service: Manages local creation and editing of Markdown content and YAML configuration files.
* Site bundle service: Assembles the site bundle, generates manifest.json and rss.xml, and optionally prepares the web-viewer/ components.
* Publishing service: Interacts with hosting adapters to upload content bundles.
* Content rendering engine: Parses and renders content for display within the client, applying style hints from site.yaml.
* Social graph & feed management service: Periodically fetches updates (manifests, RSS feeds, raw content files, social YAMLs) from followed sites, processes this data to build/update the local social graph, and aggregates content into a personalized feed for the user.
* UI components: A comprehensive set of React components (or equivalent) for user interface elements, layout, site management views, content editing, and social feature interactions.

### 3.3 Key components

* Markdown Editor: A user-friendly editor with live preview, syntax highlighting, image upload/management capabilities (storing images within the content bundle), a formatting toolbar, and draft auto-saving.
* Bundle Preparer: This component replaces a traditional "site generator." It collects all user-authored Markdown and YAML files, generates the manifest.json and rss.xml files, and, if configured, creates the minimal web-viewer/ directory with its static assets. It does not pre-render all Markdown to HTML for the main bundle; rendering is primarily a client-side concern for the Signum application.
* Hosting management: Allows users to configure and manage multiple hosting adapters, track deployment status, and monitor basic usage if the adapter provides such information.
* Feed aggregator, Social Graph Builder, and Content Renderer: This is a core part of the client. It handles the periodic fetching of data from other Signum sites, reconstructs the social graph locally, and renders fetched Markdown content according to client capabilities and site-specific style hints.

## 4. Hosting Infrastructure
   
### 4.1 First-party hosting (Signum)

A potential first-party hosting option provided by Signum would offer:

* Free subdomains (e.g., username.signum.org).
* Premium options for custom domains.
* Global CDN distribution, optimized for serving static content bundles efficiently with appropriate cache control headers.
* Automatic SSL certificates.
* A defined uptime SLA.
* Authentication for publishing to this service would be based on Ed25519 signature verification, aligning with the platform's principles. API endpoints would exist for site registration/authentication, deployment of content bundles, site status checks, and site deletion.

### 4.2 Self-hosting options

Users have complete freedom to host their content bundles on any infrastructure that can serve static files.

* FTP/SFTP Deployment: The client can support direct uploads to standard web hosts.
* Static Site Hosts: Integration with platforms like GitHub Pages, Netlify, Vercel, AWS S3, Cloudflare Pages, etc., via their respective APIs or Git-based workflows.
* Docker Self-Hosting: Users can deploy a simple static file server (like Nginx) in a Docker container to serve their content bundle.

## 5. Discovery and indexing (Content/Site Focused)

### 5.1 Indexer network

The discovery network is an optional layer designed to help users find Signum sites and content.

**Purpose:** Primarily for content and site discovery through search (keywords, tags) and identifying trending content based on site update frequency or content signals (not social metrics). Indexers may also perform basic spam and abuse detection on announced sites to maintain index quality. Indexers do not aggregate social graphs, follows, or likes.

**Architecture:** The network consists of multiple independent indexers. Clients can be configured to use one or more indexers, with support for fallback and redundancy. This avoids a single point of failure for content discovery, though core publishing and client-side social features function independently of indexers.

**API Specification:** Indexers will expose a simple API, likely including endpoints to:
* Announce a site or site update (providing site URL, metadata, tags, and potentially a signature for verification).
* Search for sites/content by keywords or tags.
* Retrieve a list of trending content (based on non-social signals).

5.2 Privacy-Preserving Discovery

Data collection by indexers is designed to be privacy-preserving:

Data Collection: Indexers only collect publicly available site metadata (from site.yaml or announced data) and the text of public content for search indexing purposes.
Verification: Cryptographically signed site announcements can be used by indexers to verify the authenticity of the source.
Anonymity: No personal user information (beyond what users voluntarily make public on their sites) is required by indexers.
User Control: Users control their participation by choosing whether or not to announce their site to any indexers.
Search features provided by indexers would include full-text search of indexed public content, tag-based filtering, and author/site discovery based on public site metadata.
6. Security Model
6.1 Threat Model
Signum aims to protect against:

Content tampering (via cryptographic signatures on site announcements and verification by clients).
Identity spoofing (due to unforgeable Ed25519 keys).
Platform lock-in (users own their keys and content bundles, which are based on open formats).
Surveillance (no central tracking of browsing/reading habits within the core protocol; published sites are static and tracker-free by default).
Censorship (facilitated by distributed hosting options and client-side social graph construction).
Signum does not inherently protect against:

Hosting provider takedowns (though content can be re-hosted elsewhere).
Sophisticated government-level censorship or network attacks.
Compromise of the user's client device or private keys.
A potential new vector exists if the optional web-viewer/viewer.js (if included in user-published bundles and user-modifiable) has vulnerabilities; this would affect users viewing via a standard browser. This risk is mitigated if viewer.js is a standardized, non-user-modifiable script provided by the Signum client during bundle preparation.

6.2 Security Features
Cryptographic Integrity: All significant site updates can be reflected in a signed site.yaml or manifest, allowing clients to verify the authenticity of site structure and content pointers. Clients can perform signature verification on loaded data. Hashes from the manifest can be used for tamper detection of cached content. Key derivation uses secure methods like PBKDF2.
Privacy Protection: No JavaScript is included in user-authored published content by default. No third-party resources are embedded by default. The core platform and default published sites do not use cookies or tracking mechanisms. Users can choose to publish anonymously by managing the link between their cryptographic key and their real-world identity. Social graph data (like follows.yaml) is public if published but is processed client-side, avoiding central aggregation of social connections.
Backup and Recovery: Multiple backup methods for cryptographic keys (encrypted seed phrase, passkey sync) are planned. Social recovery options, allowing users to designate trusted contacts to help regain access, will be explored.
7. Development Roadmap
All features are currently in the planning stage. The development will proceed in phases:

7.1 Phase 1: Core Platform (Planned)
Identity and key management (Ed25519, seed phrases, Passkeys).
Basic site content creation (local Markdown/YAML editing within the client).
Markdown editor with preview.
Content Bundle Preparation (Markdown, YAML, basic manifest.json, rss.xml).
First-party hosting integration (for content bundles).
Self-hosting via FTP (for content bundles).
Basic client-side rendering of Markdown content.
7.2 Phase 2: Social Features & Enhanced Client (Planned)
Client-side Follow system (editing follows.yaml, client parsing of followed sites' data).
Client-side Curation lists (editing curations.yaml, client parsing).
Client-side Content "Like" system (public bookmarking via likes.yaml, client interpretation).
Client-side feed aggregation and "sites+n" graph traversal logic.
Advanced client-side rendering engine with support for site.yaml style hints.
Implementation of optional web-viewer/ generation for basic browser accessibility.
Basic discovery features via indexers (site announcement, simple search).
Client-side distributed moderation tools (interpreting blocks.yaml).
7.3 Phase 3: Advanced Features & Ecosystem (Planned)
Mobile client application (e.g., React Native) with efficient background sync and native rendering.
Desktop client application (e.g., Tauri) with robust background sync and high-performance rendering.
Advanced hosting adapters (GitHub Pages, Netlify, S3, etc.).
Import tools for migrating content from platforms like WordPress or Medium.
Collaboration features for multi-author sites (still resulting in a single content bundle).
Advanced theming and customization options within the client.
Enhanced indexer capabilities (more sophisticated search, content-based trending).
7.4 Phase 4: Long-Term Growth & Sustainability (Planned)
Support for third-party client development.
A plugin or extension system for clients.
Potential for enterprise hosting solutions or features.
A comprehensive Developer API and SDK.
Exploration of non-intrusive monetization options for creators, aligned with platform principles.
8. Implementation Guide
8.1 Getting Started (Future)
Once initial versions are available, getting started will involve:

Installing Node.js (latest LTS version) and npm/yarn.
Using a modern web browser with Web Crypto API support.
Basic familiarity with Git for contributing or using Git-based hosting.
Instructions would involve cloning the client repository, installing dependencies, and running development or build scripts.
8.2 Configuration
The client application will be configurable via environment variables and a TypeScript configuration file.

Environment Variables: For setting URLs of first-party APIs, default indexer URLs, and upload size limits.
Client Configuration File (e.g., signum.config.ts): For detailed settings related to API timeouts/retries, indexer preferences, default hosting adapter, editor preferences (autosave, image sizes), feed behavior (fetch interval, traversal depth), client rendering defaults, and content bundle preparation options (e.g., whether to include the web-viewer by default).
8.3 Deployment Options (For Users Publishing Sites)
Users will deploy their Signum content bundles using:

First-Party Hosting: Via the Signum client interface.
Vercel/Netlify: By connecting their Git repository (where the client might push the bundle).
Self-Hosted Docker: By building a Docker image that serves the static content bundle.
Traditional FTP/SFTP: Uploading the bundle directory to a web server.
9. API Reference (Conceptual)
This section outlines the conceptual APIs. Detailed specifications will be developed.

9.1 Client API (Internal Services)
Internal client services will manage:

Identity Management: Creating new identities, importing from seed phrases.
Site Management: Creating new local site structures, loading existing ones, listing all managed sites.
Content Management: Creating, updating, and listing posts/pages (Markdown files) and managing YAML files within a site's local bundle.
Content Bundle Preparation: Triggering the generation of manifest.json, rss.xml, and the optional web-viewer/.
Publishing: Initiating the upload of a content bundle using a selected hosting adapter.
Social & Feed Management: Adding/removing follows/blocks (modifying local YAMLs, triggering bundle regeneration), publicly "liking" content, fetching updates from followed sites, and providing an aggregated, rendered feed to the UI.
9.2 Hosting API (Example: First-Party Service)
A first-party hosting service would expose RESTful endpoints for:

POST /v1/auth: Site registration and authentication using cryptographic signatures.
POST /v1/deploy: Site deployment, accepting a payload containing the site ID, content hash, timestamp, and the content bundle itself (e.g., a map of file paths to base64 encoded content). Expected response would confirm success and provide the deployment URL.
GET /v1/sites/{id}: To retrieve site status.
DELETE /v1/sites/{id}: For site deletion.
9.3 Discovery API (Example: Indexer Service)
Indexer services would expose RESTful endpoints for:

POST /v1/announce: To allow clients to announce a new site or an update to an existing site. The payload would include site URL, title, description, tags, last update timestamp, RSS feed URL, and an optional cryptographic signature of the payload for verification.
GET /v1/sites/search: To search for sites or content based on query parameters (e.g., keywords, tags, limits). The response would be a list of matching sites/content with relevant metadata.
GET /v1/content/trending: To get a list of currently trending content, based on non-social signals processed by the indexer.
10. Contributing and Community
Signum aims to be an open, community-driven project.

10.1 Development Guidelines (Future)
Once development begins, guidelines will be established, covering:

Code Standards: Use of TypeScript, ESLint/Prettier for formatting, Jest (or similar) for testing.
Error Handling: Comprehensive error handling and reporting.
Accessibility: Adherence to WCAG 2.1 (or later) standards for the client application.
Contribution Process: Standard fork, feature branch, test, pull request, code review, and merge workflow via a platform like GitHub.
10.2 Community Resources (Future)
Resources will be developed as the project matures:

Documentation: Developer documentation, API references, user guides at a dedicated docs site (e.g., docs.signum.org).
Community Forum: For discussions, feature requests, and user support (e.g., community.signum.org).
GitHub Repository: The central location for code, issue tracking, and contributions.
Support Channels: GitHub Issues for bug reports and technical queries, a Discord server or similar for real-time chat, and a dedicated email for security-related disclosures.
11. Legal and Compliance
11.1 Privacy Policy
A detailed privacy policy will be drafted, emphasizing:

Minimal Data Collection: The platform is designed to collect minimal user data. Cryptographic identities are pseudonymous by default.
User Control: Users control all content they publish, including their public social YAML files. Client applications manage social graph construction locally and do not send this graph to a central server for processing related to the user's direct experience.
GDPR Compliance: The platform will aim for GDPR compliance, including rights to erasure (users can delete their sites and keys), data portability (users can export their content bundles), consent management for optional features, and transparent data practices.
11.2 Content Policy
A content policy or community guidelines will be established, outlining:

User Responsibility: Users are responsible for the content they publish and must comply with applicable local laws and respect intellectual property rights.
Platform Liability: Due to its decentralized nature and focus on user ownership, the platform itself (as an entity, if one exists) will have limited liability for user-generated content. Procedures for DMCA compliance and reporting illegal content will be defined, particularly for any first-party hosting services.
Moderation: Moderation is primarily user-driven (via blocks.yaml). Indexers or first-party services may implement policies against spam or illegal content for services they directly provide. Appeal and dispute resolution processes will be considered.
12. Technical FAQ
12.1 Common Questions
Q: How does Signum differ from traditional publishing platforms?
A: Signum users own their content (as Markdown/YAML files) and identity via cryptographic keys. The Signum client application is the primary interface, rendering content and building social feeds by fetching data from other users' static content bundles. Indexers are optional and only for content discovery, not social graph management.

Q: How is content displayed if sites are just Markdown/YAML?
A: The primary way to experience Signum content is through the Signum client application (web, desktop, mobile). The client fetches the raw Markdown and YAML files, then renders them into a rich, viewable format, applying any style hints provided by the site owner in site.yaml. For basic web browser access without the client app, sites can optionally include a minimal HTML shell and a JavaScript viewer that fetches and renders the Markdown on the fly.

Q: What happens if the Signum organization or first-party services disappear?
A: The protocol and content formats are open. Users retain their cryptographic identity and their content bundles. Alternative clients, indexers, and hosting solutions can be developed and used by the community. There is no inherent lock-in to a central Signum entity.

Q: Can I migrate content from platforms like WordPress or Medium?
A: Tools for importing content from major platforms are planned for future development. Content would be converted to Markdown format, preserving metadata and structure where possible.

Q: How secure is the cryptographic system?
A: Signum will use Ed25519, a widely respected and secure elliptic curve cryptography system. All cryptographic operations will rely on well-tested, standard libraries. User keys are managed by the client and stored securely using platform capabilities (e.g., OS keychain, browser Web Crypto API).

Q: What about performance and SEO for published sites?
A: The Signum client application will be optimized for performance in fetching and rendering content. For sites viewed directly on the web (outside the Signum client), performance will depend on the efficiency of the optional web-viewer/ script and standard static file serving. SEO is addressed through rss.xml, manifest.json, site.yaml metadata, and the potential for the web-viewer/index.html to contain pre-rendered metadata or be crawlable by search engines. The best user experience and richest features are within the Signum client.

Q: How do follows and social feeds work without a central server for social data?
A: When you follow a site, its ID is added to your public follows.yaml file within your content bundle. Your Signum client (and clients of others who might view your follows) fetches this file, along with follows.yaml files from sites they follow (up to a certain depth, "sites+n"). The client also fetches RSS feeds (rss.xml) and Markdown content from these sites. It then locally combines all this information, renders it, and builds your personalized content feed and social graph. Updates are fetched periodically by the client, similar to how an RSS reader works.

Q: How are "likes" handled?
A: "Liking" a post in Signum means adding its URL to your public likes.yaml file. This acts as a public bookmark or endorsement. Other users' clients can see your likes if they fetch your likes.yaml as part of their social graph traversal. There are no centrally aggregated "like counts" displayed on posts, as this would require central tracking or significantly more complex client-side aggregation. The allow_likes tag in a post's metadata simply means the author consents to their content being listed in others' likes.yaml files.

12.2 Troubleshooting (Future Considerations)
Common issues might include:

Seed phrase lost/Key compromise: Social recovery (if configured) would be the primary recourse; otherwise, identity tied to those keys may be unrecoverable.
Publishing failures: Issues with hosting adapter configuration, network connectivity, or hosting provider limits.
Content not syncing/Feed not updating: Problems with client network connectivity, malformed manifest.json or rss.xml on target sites, client fetch intervals, or errors during client-side parsing.
Performance issues in client: May occur if following a very large number of sites or with a deep "sites+n" traversal configuration. Client settings for fetch frequency or traversal depth might need adjustment.
Debug information would be available through browser console logs, network request inspection in developer tools, IndexedDB content inspection, and potentially dedicated logging within the client application.
Conclusion
Signum aims to offer a novel approach to online publishing, placing paramount importance on user ownership, data portability, privacy, and simplicity. By structuring content as user-owned Markdown and YAML bundles and making the client application central to rendering and social interaction, Signum provides a decentralized alternative to traditional platforms. The model is designed to be resilient, open, and adaptable, with users always in control of their cryptographic identity and their published data. Social features are emergent from the interconnected web of user-managed content bundles, processed client-side, fostering a different kind of online interaction.

The platform's success will depend on creating intuitive and powerful client applications, fostering a community around its open protocols, and clearly communicating its unique value proposition to both creators and consumers of content.

Next Steps (Upon Project Initiation):

Establish core development team and infrastructure.
Begin implementation of Phase 1 features.
Set up community channels (forum, chat, code repository).
Draft initial versions of legal policies and detailed technical API specifications.
Work towards a minimum viable product (MVP) focusing on core publishing and client-rendering.
This specification is version 1.3 and will be updated as the project evolves. For the latest version, consult the project's official documentation repository once established.


## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

