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

### Conference Test App (2025)
- Created a 3-form "conference management" test app: `speaker`, `attendee`, `session`.
- Each form exercises different field types: text, textarea, password, dropdown, checkbox (single + multi-option), radio, table (with calculated columns), button (with click handlers), and link.
- Specs saved as `_data/{formName}_spec.json`; forms built via `buildEleventySite()` which also generates list views and the index page.
- Pre-loaded 9 sample data records (3 per form) with realistic content and `_meta.sessionId`/`_meta.submittedAt` fields.
- Data file naming convention: `_data/{formName}_{sessionId}.json` — this is what the API endpoints expect.
- To rebuild all forms from specs programmatically: import `buildEleventySite` from `src/eleventy-builder.js`, iterate over `_data/*_spec.json`, call `buildEleventySite(spec, projectRoot)` for each, then run `npx @11ty/eleventy`.
- The speaker spec replaced a simpler existing one — the new version has 3 sections with all field types for comprehensive testing.

### Sample Data Deployment Fix (2025)
- `.gitignore` must explicitly un-ignore sample data files (`!_data/speaker_*.json`, `!_data/attendee_*.json`, `!_data/session_*.json`) — otherwise they're excluded from git and never reach the deployed app.
- `db/seed.js` requires `_meta.formName` on every data record — without it, the seed loop silently skips the file. All sample data files now include `"formName": "speaker"`, `"formName": "attendee"`, or `"formName": "session"` in their `_meta` block.
- When adding new sample data, always include `_meta.formName` matching the form name, and ensure the `.gitignore` pattern allows the file to be tracked.
- The deployed Embr app at `https://agentic-app-test-agentic-app-demo-*.embrdev.io` depends on both the file-based records API (reads `_data/`) and the Postgres seed (`db/seed.js`).

### Form Navigation & Auto-Load (2025)
- Replaced DB-based navigation endpoints (`/api/db/records/`, `/api/db/record/`) in client-side JS with file-based endpoints (`/api/records/:formName`, `/api/load?formName=X&id=Y`). The DB endpoints still exist in `bin/deploy-server.js` for Postgres use cases, but the generated form HTML now uses the universally-available file-based API.
- Navigation uses `fetchRecordsList()` to get all records for the form, stores them in `recordsList[]`, and `loadRecordById(id)` to load individual records via `/api/load`.
- Auto-load: On page open, `fetchRecordsList()` runs unconditionally. If `?id=` param is present, it finds that record's index. Otherwise, it auto-loads the first record.
- List view "View" links renamed to "✏️ Edit" with column header changed from "Action" to "Edit".
- `generateFormHtml()` returns a string — to regenerate files, must write output to `_site_src/` manually (or use `buildEleventySite()`).
- Tests updated in `test/db-records.test.js`, `test/list-view.test.js`, and `test/form-navigation.test.js` to match new function names and column headers.
