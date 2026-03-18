# Decisions

## Active Decisions

### Conference Test Application

**Author:** Fenster (Core Dev)  
**Status:** Implemented

Created a "conference management" test application with 3 forms and 9 pre-loaded records to serve as a comprehensive test fixture for the deployed app.

#### Forms Created

| Form | Field Types Covered | Table | Button | Link |
|------|-------------------|-------|--------|------|
| `speaker` | text, textarea, password, dropdown, checkbox (single), radio | Previous Talks (text, text, dropdown, calculated-expression) | Validate Email | → attendee |
| `attendee` | text, textarea, dropdown, checkbox (multi-option), radio | Sessions to Attend (text, dropdown, dropdown, calculated-template) | — | → speaker |
| `session` | text, textarea, dropdown, radio | — | Check Availability | → speaker |

#### Pre-loaded Data (9 records)

- **Speaker**: 3 records (abc12345, def67890, ghi11111) — varied experience levels, talk counts
- **Attendee**: 3 records (jkl22222, mno33333, pqr44444) — different roles, dietary options, session counts
- **Session**: 3 records (stu55555, vwx66666, yza77777) — keynote, workshop, talk types

#### Rationale

- Covers all supported field types including both calculated column modes (template `{field}` and expression `=...`).
- Replaced the simpler existing `speaker_spec.json` with the comprehensive test version.
- Data records use deterministic session IDs (not UUIDs) so tests can reference them by ID.
- Cross-form links (speaker ↔ attendee ↔ session) enable navigation testing.

#### Impact

- All 172 tests pass (~260ms).
- Hockney can now write E2E tests against these forms and data.

---

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

---

### Switch Form Navigation to File-Based API

**Author:** Fenster (Core Dev)  
**Status:** Implemented

Replaced the DB-based record navigation in generated form HTML with the file-based records API, making prev/next navigation and auto-load work universally (with or without Postgres).

**Key Changes:**
1. **Navigation endpoints:** Client-side JS now uses `GET /api/records/:formName` (list) and `GET /api/load?formName=X&id=Y` (single record) instead of `/api/db/records/` and `/api/db/record/`.
2. **Auto-load first record:** Forms now auto-load the first available record on page open. If `?id=` is in the URL, that specific record is selected in the nav.
3. **List view edit links:** Changed "View" → "✏️ Edit" and column header "Action" → "Edit" for clarity.

**Rationale:** DB endpoints require a running Postgres instance (not always available). File-based API works everywhere since `_data/*.json` files are always present. DB endpoints remain in `deploy-server.js` for direct Postgres access.

**Files Changed:**
- `src/eleventy-builder.js` — `generateFormHtml()` and `generateListViewHtml()`
- `test/db-records.test.js`, `test/list-view.test.js`, `test/form-navigation.test.js` — updated assertions
- All `_site_src/*.html` and `_site/*/index.html` — regenerated

**Impact:** 235 tests pass (1 pre-existing server.test.js deserialization failure unrelated to this change).

---

### Sample Data Deployment Fix

**Author:** Fenster (Core Dev)  
**Status:** Implemented  
**Date:** 2025-07-17

Deployed Embr test app had no data due to two root causes: (1) `.gitignore` excluded `_data/*.json` with only `*_spec.json` exception; (2) sample data files lacked `_meta.formName` which `db/seed.js` requires.

**Solution:**
- Updated `.gitignore` to add exceptions for `speaker_*`, `attendee_*`, and `session_*` data files alongside `*_spec.json` exception.
- Added `"formName"` to the `_meta` block of all 9 sample data records matching their form name.

**Convention Going Forward:** Any new sample/seed data file must include `_meta.formName` and have a filename pattern that is un-ignored in `.gitignore`. Without both, the data won't reach the deployed app.

**Impact:** All 32 deployed-app integration tests pass. Commit `354c38d` pushed to `main`.

---

### Save Button on Generated Forms

**Author:** Fenster (Core Dev)  
**Status:** Implemented  
**Date:** 2026-03-18

Added a "💾 Save" button to all generated forms, placed in the record navigation bar next to "+ New Record".

**Implementation:**
- **Location:** `src/eleventy-builder.js` — `generateFormHtml()` function
- **Approach:** Extracted the inline save logic from the form submit handler into a reusable `saveCurrentRecord()` function. Both the form submit event and the new save button call this function.
- **Behavior:** Save uses the current `SESSION_ID`, so clicking Save on a loaded record updates it in place. Clicking "+ New Record" first generates a new session ID, then Save creates a new record.
- **Styling:** `btn-success` (green) for Save vs `btn-primary` (blue) for New Record — visually distinct actions.

**Rationale:** Users could submit forms (which saves + navigates) but had no explicit "save current record" action. The Save button makes the save action discoverable and intentional, especially when editing existing records loaded via navigation.

**Impact:** All existing tests pass (231/232 — 1 pre-existing Node.js runner issue in server.test.js). Existing forms need a rebuild (`buildEleventySite()` or `adcgen rebuild`) to pick up the new button.
