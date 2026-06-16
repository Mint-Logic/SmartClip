# SmartClip

A high-performance, privacy-first clipboard history manager that safely captures text, links, and snippets while proactively preventing accidental exposure of sensitive keys during live presentations or screen shares.

## Features
* **Sensitive Data Heuristics:** Scans incoming text chunks via regex arrays to identify AWS keys, GitHub tokens, RSA private key blocks, and credit cards (validated via local Luhn algorithm verification) to automatically mask them in the UI.
* **Developer Prose Bypass:** Intelligently checks for programming syntax blocks (`{}`, `[]`, `=`) to preserve readability for actual code snippets while keeping true configuration credentials hidden.
* **Formatting Transforms:** Context-aware string mutation controls to convert clipboard targets on-the-fly into UPPERCASE, lowercase, CamelCase, -slugify-, or clean tracking parameter strings from web URLs.
* **Deep Image Indexing:** Automatically extracts and indexes readable text from copied graphics using a local offline Tesseract worker, allowing users to search their image history using global string searches.

## Architecture
SmartClip utilizes a background Electron routine mapping memory to a native persistent JSON database written strictly to your local hard drive. UI dimensions shift dynamically to accommodate search filters and management modals while completely dropping all tracking loops.

## Development & Installation

```bash
# Install dependencies
npm install

# Execute locally
npm start
