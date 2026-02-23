# adcgen — AI-Powered Form Generator

A CLI tool that generates HTML data-entry forms using AI and [Eleventy](https://www.11ty.dev/). Describe a form in natural language, preview it in ASCII art, and launch a styled GitHub-themed site — all from your terminal.

## Features

### Form Generation
- **AI form generation** — Describe a form in plain English; the LLM (GPT-4o via GitHub Models API) produces a complete form spec
- **ASCII preview** — See a terminal-rendered preview of the form before generating HTML
- **Multiple forms** — Generate as many forms as you want; an auto-generated index page links to all of them
- **Supported controls**: text, password, dropdown, checkbox, radio buttons, tables with embedded controls, buttons, links to other pages
- **Dynamic tables** — Tables include **+ Add Row** and **✕ Delete Row** buttons; table data loads correctly when using `?id=`
- **Required table columns** — Table columns can be marked as required for validation
- **Calculated columns** — Table columns with type `calculated` support two formula modes: template placeholders (`{first} {last}`) or JS expressions prefixed with `=` (`=email.split('@')[0]`)

### Editing
- **AI-powered editing** — Edit existing forms by describing changes in natural language (`adcgen edit`)
- **HTML-aware editing** — If you manually edit the HTML, `adcgen edit` detects the changes and sends the actual HTML to the LLM, preserving your formatting and custom text
- **Spec-based editing** — Unmodified forms are edited via JSON spec with ASCII preview for faster iteration
- **Cross-page links** — Ask the editor to "add a link to the add_user page" and it resolves available pages automatically

### Styling & UX
- **GitHub dark mode** — Generated forms use [Primer CSS](https://primer.style/css/) in dark mode, matching GitHub.com's look
- **Password fields** — Password inputs render with hidden text and a 👁 toggle icon
- **Buttons & events** — Custom buttons with event handlers; describe the behavior and the LLM generates the JavaScript. Events (`click`, `change`, `input`, etc.) can be attached to any field type, not just buttons.
- **Toast notifications** — A success toast appears on form submission and auto-hides after 3 seconds
- **Safe edit zones** — Generated HTML has comments marking which sections are safe to edit manually (headings, text, links) and which are managed by adcgen (form fields, styles, scripts)

### Data & Persistence
- **Form submission → JSON** — Submitted form data is saved as `<formname>_<sessionId>.json` in the `_data/` folder via a local API server
- **Load existing data** — Open a form with `?id=<sessionId>` (e.g., `/add_user/?id=0fd9d199`) to pre-populate from a saved JSON file; re-saving overwrites the same file
- **List saved records** — `adcgen list_data` shows all saved form data with submission timestamps

### Server & DevOps
- **Background dev server** — `adcgen launch` starts Eleventy + data API in the background and returns immediately
- **Custom port** — `adcgen launch --port 3000` to use a custom port
- **Process management** — `adcgen ps` shows running servers, `adcgen stop` kills them
- **Port conflict detection** — Launch checks if ports are free and shows blocking PIDs
- **Rebuild** — `adcgen rebuild` regenerates all forms from saved specs to pick up new features

### Authentication
- **GitHub auth** — Login via `gh` CLI (auto-detected) or paste a GitHub PAT
- **`GITHUB_TOKEN` env var** — Automatically uses the `GITHUB_TOKEN` environment variable if set (useful for CI)
- **Token validation** — Tokens are validated against the GitHub API on login
- **Friendly errors** — Helpful messages if `gh` is not installed or not authenticated

## Installation

### One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/nirmash/agentic-app-demo/main/setup.sh | bash
```

This clones the repo to `~/.adcgen-cli`, installs dependencies, and links `adcgen` globally.

### Manual

```bash
# Clone the repo
git clone https://github.com/nirmash/agentic-app-demo.git
cd agentic-app-demo

# Install dependencies
npm install

# Link globally so you can use "adcgen" anywhere
npm link

# Make sure ~/.npm-global/bin is in your PATH
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Update

Re-run the setup script to pull the latest version:

```bash
curl -fsSL https://raw.githubusercontent.com/nirmash/agentic-app-demo/main/setup.sh | bash
```

## Quick Start

```bash
# 1. Login with GitHub
adcgen login

# 2. Generate a form
adcgen generate signup_form

# 3. Launch the dev server
adcgen launch

# 4. Open http://localhost:8080 in your browser
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `adcgen` | Show help |
| `adcgen login` | Authenticate with GitHub (via `gh` CLI or manual token) |
| `adcgen logout` | Remove stored GitHub token |
| `adcgen token` | Display the stored GitHub token |
| `adcgen list` | List all generated forms |
| `adcgen list_data` | List all saved form data records with timestamps |
| `adcgen generate [name]` | Generate a new form from a natural language description |
| `adcgen edit [name]` | Edit a form using AI — auto-detects manual changes and preserves them |
| `adcgen launch [--port N] [--no-open]` | Start Eleventy + data API servers in the background |
| `adcgen ps` | Show status of running adcgen servers |
| `adcgen stop` | Stop the running background servers |
| `adcgen rm <names...>` | Remove one or more forms by name |
| `adcgen rebuild` | Rebuild all forms from saved specs (picks up latest features) |
| `adcgen clean` | Delete all generated forms and site output |

## Project Structure

```
├── bin/
│   ├── adcgen.js              # CLI entry point
│   ├── adcgen-serve.js        # Background server process (Eleventy + data API)
│   └── deploy-server.js       # Production server (static + API on single port)
├── src/
│   ├── cli.js                 # Commander setup & command routing
│   ├── auth.js                # GitHub auth (gh CLI / manual token)
│   ├── generator.js           # LLM calls for form generation, spec editing & HTML editing
│   ├── ascii-preview.js       # ASCII art form renderer
│   ├── eleventy-builder.js    # HTML generator with Primer CSS dark mode
│   └── server.js              # Express API for saving/loading form data as JSON
├── test/
│   ├── all-controls.test.js   # Automated test suite (71 tests)
│   └── fixtures/              # Test form specs
├── eleventy.config.js         # Eleventy configuration
├── setup.sh                   # One-liner install script
├── deploy.sh                  # Production deployment script
├── _site_src/                 # Generated form HTML source (Eleventy input)
├── _site/                     # Built site output (Eleventy output)
├── _data/                     # Saved form submissions & specs (JSON)
└── package.json
```

## How It Works

1. **`adcgen generate`** — Sends your description to GPT-4o, which returns a structured JSON form spec
2. The spec is rendered as **ASCII art** in the terminal for review
3. On approval, the spec is converted to a full **HTML page** with Primer CSS (GitHub dark mode)
4. The HTML is written to `_site_src/` and an **index page** with links to all forms is regenerated
5. **`adcgen launch`** starts Eleventy's dev server and a data API as a background process
6. When a user fills out a form and clicks **Submit**, the data is POSTed to the API and saved as a JSON file in `_data/`
7. **Load saved data** by opening a form with `?id=<sessionId>` — the data is fetched from the API and pre-populated
8. **`adcgen edit`** detects whether the HTML was manually modified:
   - **Unmodified**: edits via JSON spec with ASCII preview
   - **Modified**: sends actual HTML to the LLM, preserving your manual changes

### Generated HTML Structure

The generated HTML has clearly marked zones:

```html
<!-- ⚠️ DO NOT EDIT: Styles managed by adcgen -->
<style>...</style>
<!-- END DO NOT EDIT -->

<!-- ✅ SAFE TO EDIT: Section headings, text, and links -->
<h3>Section Title</h3>
<!-- END SAFE TO EDIT -->

<!-- ⚠️ DO NOT EDIT: Form fields managed by adcgen. Use "adcgen edit" to change. -->
<div class="form-group">...</div>
<!-- END DO NOT EDIT -->

<!-- ⚠️ DO NOT EDIT: Form submission and data loading scripts -->
<script>...</script>
<!-- END DO NOT EDIT -->
```

## Deployment

### ADC Sandbox (or any Linux server with Node 20+)

A single script handles everything — clone, install, build, and serve on port 80:

```bash
# On the sandbox / server:
bash deploy.sh

# Custom port:
PORT=3000 bash deploy.sh
```

The deploy script:
1. Clones (or updates) the repo to `/app`
2. Installs production dependencies
3. Builds all forms from `_data/*_spec.json` specs (or the demo test form if none exist)
4. Patches API URLs for same-origin serving (no separate API port needed)
5. Starts a combined static + API server on the specified port

**Key files:**
- `deploy.sh` — Orchestrates the full deployment
- `bin/deploy-server.js` — Production server (static files + API on a single port)

## Requirements

- Node.js 18+
- GitHub account (for API token)
- `gh` CLI (optional, for easy login)

## License

MIT
