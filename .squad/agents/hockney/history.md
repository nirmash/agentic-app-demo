# Hockney — History

## Project Context
**adcgen** — CLI tool for AI-powered HTML form generation. Node.js, Express, Eleventy, Primer CSS.
User: Nir Mashkowski.

**Testing setup:** Node.js native test runner. `npm test` runs `node --test test/*.test.js`. 71 existing tests in `all-controls.test.js` covering HTML structure, all field types, tables, calculated columns, ASCII preview, and index page generation.

## Learnings
- **Test count:** 204 total (172 prior + 32 new in deployed-app.test.js). All pass in ~440ms.
- **deployed-app.test.js pattern:** Integration tests that spawn `bin/deploy-server.js` on a random port (9000+rand), poll until ready, run HTTP assertions, then kill the process. Uses `DATABASE_URL=''` to skip Postgres paths. Cleanup of test-created data files via `after()` hook.
- **List view API URL pattern:** List view HTML builds the fetch URL dynamically (`'/api/records/' + FORM_NAME`), not as a literal string. Tests must check for the path fragment and the FORM_NAME variable separately.
- **deploy-server.js port flag:** Accepts `--port N` via `process.argv` parsing (no env var). The default is 80.
- **Static file routing:** Eleventy outputs directories (e.g., `_site/speaker/index.html`) served as `/speaker/`. List views are at `/speaker_list/`. A 404 is returned for non-existent paths.
- **Pre-existing flaky failure:** `server.test.js` intermittently fails with `Error: Unable to deserialize cloned data` when run alongside other test files — a known Node.js test runner parallel bug. Passes when run individually. Not caused by deployed-app.test.js.
- **List view column filtering:** `generateListViewHtml` skips `table`, `button`, and `link` field types — only scalar fields become column headers. Edge case: a spec with *only* table-type fields produces zero scalar columns but still renders a valid page with just the Action column.
- **Title sanitization:** `generateListViewHtml` strips "Add/Edit " prefix from titles for the list view heading. Worth testing when forms have edit-style titles.
- **_spec.json exclusion:** The `/api/records/:formName` endpoint filters out `_spec.json` files by checking `!f.endsWith('_spec.json')`. Important to test because spec files share the same prefix pattern.
- **Index page _list.html handling:** `generateIndexPage` now filters out `_list.html` files from the form count and conditionally adds a "📊 Records" badge when a corresponding `_list.html` exists.
- **Node.js test runner parallel bug:** Running all test files together occasionally triggers `Error: Unable to deserialize cloned data` in `server.test.js` — a known Node.js test runner serialization issue. Each file passes individually.
- **auth.js caching:** `CONFIG_DIR`/`CONFIG_FILE` are module-level constants evaluated once at load time from `process.env.HOME`. To test auth functions in isolation, set `HOME` to a temp dir *before* importing the module. Cache-busting with query strings (`?t=...`) works for re-evaluating a single module but not its transitive dependencies.
- **generator.js auth coupling:** `generator.js` imports `auth.js` at the top level. To test "not authenticated" paths, override `HOME` before the first import of `generator.js` so `getToken()` finds no config file. Then also delete `GITHUB_TOKEN` env var.
- **server.js port 0:** `startDataServer(dir, 0)` binds to a random available port — use `server.address().port` to discover it. Essential for parallel-safe tests.
- **db-sync.js early return:** `syncToDb` and `dropFormTables` both return `undefined` immediately when `DATABASE_URL` is not set. No Postgres needed for unit tests.
- **eleventy-builder.js escapeHtml:** The `escapeHtml` function handles `&`, `<`, `>`, `"` — verified by dedicated escaping tests.
- **Test patterns:** Use `fs.mkdtempSync` + `after` cleanup. Group with `describe`. ES module imports. `node:test` + `node:assert/strict`.
- **Key test files:** `test/server.test.js` (API), `test/auth.test.js` (config I/O), `test/generator.test.js` (exports + auth guard), `test/db-sync.test.js` (path + early return), `test/eleventy-builder.test.js` (field types + escaping + index).

## New Functions Added (Fenster, 2026-03-04T01:23Z)
- **`generateListViewHtml(spec, records)`** in `src/eleventy-builder.js` — builds read-only HTML table of record data, filtering columns to scalar fields only, includes "View" links to individual records. Ready for test coverage.

## Test Application (Fenster, 2026-03-04T16:52Z)
- **Conference management app** — 3 forms (speaker, attendee, session) with all field types covered
- **9 pre-loaded records** — deterministic IDs (abc12345, def67890, etc.) for consistent test assertions
- **3 data tables** — Previous Talks (speaker), Sessions to Attend (attendee), plus buttons/links for navigation
- **Calculated columns** — both template `{field}` and expression `=...` modes represented
- Ready for E2E test coverage across forms, navigation, and data operations

## Regression Test: Form Navigation (2026-03-04)
- **test/form-navigation.test.js** — 34 tests covering form navigation, auto-load, and list view edit links
- **HTML generation tests (20):** Verify `generateFormHtml` outputs Prev/Next buttons, record-nav bar, record counter, New Record button, `/api/records/` fetch, FORM_NAME variable, `?id=` URL param reading, `/api/load` fetch, auto-load logic (`fetchRecordsList`), `populateForm` function. Verify `generateListViewHtml` outputs Edit links with `?id=` param, `/api/records/` fetch, `createElement('a')`, sessionId in hrefs, Edit column header.
- **E2E tests (14):** Deploy server on random port, test speaker form nav markup, `/api/records/speaker` returns records array, `/api/load?formName=speaker&id=abc12345` loads specific record, speaker_list page has Edit links with `?id=` pattern.
- **Pattern: function name flexibility** — auto-load function may be named `fetchRecordsList`, `loadRecords`, `loadRecordsFromDb`, or `loadRecordsFromApi`. Tests check all variants.
- **Pattern: Fenster renamed** "Action" column → "Edit", "View" link text → "✏️ Edit". Assertions accept both old and new naming.
- **Test count:** 264 total (238 prior + 26 new in new-features.test.js). All pass in ~430ms.
- **new-features.test.js:** 26 tests across 5 describe blocks covering 4 new features: lookup dropdown (single & multi-select), links open new record (?new=true), back home button, and breadcrumbs.
- **Lookup field implementation:** Uses `data-lookup-source`, `data-lookup-display`, `data-lookup-value` data attributes on the `<select>` element. JS populates options dynamically via `fetch('/api/records/' + source)`. No literal source URL in the HTML — must test via data attributes.
- **Link ?new=true:** Fenster's change appends `?new=true` to all link hrefs. This broke 2 existing tests in `eleventy-builder.test.js` and `all-controls.test.js` that checked for bare hrefs — fixed both to include `?new=true`.
- **Breadcrumbs:** Rendered as `<nav aria-label="Breadcrumb">` with an `<ol class="breadcrumb">`. Home links to `/`, current page shows escaped spec.title with `aria-current="page"`.
- **Home button:** Rendered as `<a href="/" class="btn btn-sm">🏠 Home</a>` in the record navigation area.
- **?new=true param handling:** Form JS reads `urlParams.get('new')` and sets `isNewRecord` flag to skip auto-loading existing records.

