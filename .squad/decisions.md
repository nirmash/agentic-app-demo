# Decisions

## Active Decisions

### Documentation Structure

**Author:** McManus (DevRel)  
**Status:** Implemented

Created a `docs/` directory with four reference documents:

| File | Scope |
|------|-------|
| `ARCHITECTURE.md` | System overview, data flow, deployment modes, DB integration |
| `API.md` | All Express endpoints with request/response examples |
| `FORM-SPEC.md` | JSON spec format — all field types, table columns, calculated fields, events |
| `CONTRIBUTING.md` | Dev setup, testing, adding field types, code style, PR process |

Added a "Documentation" section to `README.md` linking to all four docs.

**Rationale:** README was already comprehensive (270 lines) — no need to rewrite, just link to deeper docs. Form spec reference is critical for anyone extending field types or debugging LLM output. API docs save time for integrations. Contributing guide lowers the barrier for new contributors.

---

### Test Suite Strategy

**Author:** Hockney (Tester)  
**Status:** Implemented

Added 5 new test files (69 tests) alongside the existing file, bringing the total to 140. Each source module gets its own test file. Tests use temp directories for isolation and clean up after themselves. No external test frameworks — only `node:test` and `node:assert/strict`.

**Test Files Created:**
- `test/server.test.js` — Express API (save/load/CORS), uses real HTTP with port 0
- `test/auth.test.js` — Token read/write/logout with temp HOME dirs
- `test/generator.test.js` — Module exports + auth-guard rejection
- `test/db-sync.test.js` — resolveSpecPath + early-return without DATABASE_URL
- `test/eleventy-builder.test.js` — All field types, HTML escaping, empty specs, index page edge cases

**Rationale:** Port 0 avoids conflicts with running services. Temp dirs prevent test pollution of real config/data. Each module tested in isolation; integration points (e.g., LLM calls, Postgres) are boundary-tested only.

---

### List View Page Type

**Author:** Fenster (Core Dev)  
**Status:** Implemented

Added a "list view" page type that generates a read-only HTML table of all saved records for any form, with a "View" link to open each record in the individual form.

**Key Decisions:**
1. **Naming convention:** `{formName}_list.html` — underscore-separated, sits alongside the form file in `_site_src/`.
2. **Auto-generation:** List views are generated automatically during `buildEleventySite()` and `rebuild`, not just on-demand. Every form gets a list view.
3. **File-based records endpoint:** `GET /api/records/:formName` scans `_data/` for matching JSON files. No DB required. Added to both dev and prod servers.
4. **Column selection:** Only scalar fields (text, dropdown, checkbox, radio, textarea, password) are shown as table columns. Table, button, and link fields are excluded.
5. **Index page integration:** The index page shows a "📊 Records" badge next to each form linking to its list view.

**Files Changed:**
- `src/eleventy-builder.js` — added `generateListViewHtml()`, updated `buildEleventySite()` and `generateIndexPage()`
- `src/server.js` — added `GET /api/records/:formName`
- `bin/deploy-server.js` — added `GET /api/records/:formName`
- `src/cli.js` — added `list_view` command, updated `rm` to clean up list files

**Impact on Tests:** All 140 existing tests pass. New functions (`generateListViewHtml`) are exported and available for future testing.
