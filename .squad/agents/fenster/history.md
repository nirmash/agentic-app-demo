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

### List View Feature (2025)
- Added `generateListViewHtml(spec)` to `eleventy-builder.js` — companion page for every form showing all records in a read-only table.
- List view pages are named `{formName}_list.html` and auto-generated during `buildEleventySite()`.
- `generateIndexPage()` now filters out `_list.html` files from the form count and shows a "📊 Records" badge linking to each list view.
- File-based records endpoint: `GET /api/records/:formName` scans `_data/` for `{formName}_*.json` (excludes `*_spec.json`). Added to both `src/server.js` and `bin/deploy-server.js`.
- The `list_view` CLI command can generate a list view for a single form without rebuilding everything.
- The `rm` command also cleans up `_list.html` files (both `_site_src` and `_site`).
- Scalar fields only in list columns — `table`, `button`, and `link` types are excluded.
