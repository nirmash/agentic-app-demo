# Fenster — History

## Project Context
**adcgen** — CLI tool for AI-powered HTML form generation. Node.js, Express, Eleventy, Primer CSS.
User: Nir Mashkowski.

**Architecture:**
- CLI entry: `bin/adcgen.js` → `src/cli.js` (Commander)
- Form flow: user prompt → `generator.js` (GPT-4o) → JSON spec → `ascii-preview.js` → `eleventy-builder.js` → HTML
- Data: Express API on port 3001 → `_data/{form}_{sessionId}.json` → optional Postgres sync
- Two servers: dev (Eleventy + API) and prod (combined static + API)

## Learnings
