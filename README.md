# adcgen — AI-Powered Form Generator

A CLI tool that generates HTML data-entry forms using AI and [Eleventy](https://www.11ty.dev/). Describe a form in natural language, preview it in ASCII art, and launch a styled GitHub-themed site — all from your terminal.

## Features

- **AI form generation** — Describe a form in plain English; the LLM (GPT-4o via GitHub Models API) produces a complete form spec
- **ASCII preview** — See a terminal-rendered preview of the form before generating HTML
- **GitHub dark mode styling** — Generated forms use [Primer CSS](https://primer.style/css/) in dark mode, matching GitHub.com's look
- **Multiple forms** — Generate as many forms as you want; an auto-generated index page links to all of them
- **AI-powered editing** — Edit existing forms by describing changes in natural language (`adcgen edit`)
- **GitHub authentication** — Login via `gh` CLI or paste a GitHub PAT (`adcgen login`)
- **Background dev server** — `adcgen launch` starts Eleventy + data API in the background so you can keep using the CLI
- **Form submission → JSON** — Submitted form data is saved as `<formname>_<sessionId>.json` in the `_data/` folder via a local API server
- **Load existing data** — Open a form with `?id=<sessionId>` (e.g., `/add_user/?id=0fd9d199`) to pre-populate from a saved JSON file; re-saving overwrites the same file
- **Password fields** — Password inputs render with hidden text and a 👁 toggle icon
- **Buttons & events** — Custom buttons with event handlers; describe the behavior and the LLM generates the JavaScript
- **Supported controls**: text, password, dropdown, checkbox, radio buttons, tables with embedded controls, buttons

## Installation

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
| `adcgen edit [name]` | Edit an existing form using AI — shows current form, event handlers, and prompts for changes |
| `adcgen launch [--no-open]` | Start Eleventy + data API servers in the background |
| `adcgen stop` | Stop the running background servers |
| `adcgen rm <names...>` | Remove one or more forms by name |
| `adcgen rebuild` | Rebuild all forms from saved specs (picks up latest features) |
| `adcgen clean` | Delete all generated forms and site output |

## Project Structure

```
├── bin/adcgen.js            # CLI entry point
├── src/
│   ├── cli.js               # Commander setup & command routing
│   ├── auth.js              # GitHub auth (gh CLI / manual token)
│   ├── generator.js         # LLM calls for form generation & editing
│   ├── ascii-preview.js     # ASCII art form renderer
│   ├── eleventy-builder.js  # HTML generator with Primer CSS dark mode
│   └── server.js            # Express API for saving form data as JSON
├── eleventy.config.js       # Eleventy configuration
├── _site_src/               # Generated form HTML source (Eleventy input)
├── _site/                   # Built site output (Eleventy output)
├── _data/                   # Saved form submissions & specs (JSON)
└── package.json
```

## How It Works

1. **`adcgen generate`** — Sends your description to GPT-4o, which returns a structured JSON form spec
2. The spec is rendered as **ASCII art** in the terminal for review
3. On approval, the spec is converted to a full **HTML page** with Primer CSS (GitHub dark mode)
4. The HTML is written to `_site_src/` and an **index page** with links to all forms is regenerated
5. **`adcgen launch`** starts Eleventy's dev server (port 8080) and a data API (port 3001) in the background
6. When a user fills out a form and clicks **Submit**, the data is POSTed to the API and saved as a JSON file in `_data/`
7. **`adcgen edit`** loads the existing form spec, shows it with event handlers, and sends your change request to the LLM for modification

## Requirements

- Node.js 18+
- GitHub account (for API token)
- `gh` CLI (optional, for easy login)

## License

MIT
