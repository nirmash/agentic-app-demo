# Hockney — History

## Project Context
**adcgen** — CLI tool for AI-powered HTML form generation. Node.js, Express, Eleventy, Primer CSS.
User: Nir Mashkowski.

**Testing setup:** Node.js native test runner. `npm test` runs `node --test test/*.test.js`. 71 existing tests in `all-controls.test.js` covering HTML structure, all field types, tables, calculated columns, ASCII preview, and index page generation.

## Learnings
- **Test count:** 140 total (71 original + 69 new across 5 files). All pass in ~243ms.
- **auth.js caching:** `CONFIG_DIR`/`CONFIG_FILE` are module-level constants evaluated once at load time from `process.env.HOME`. To test auth functions in isolation, set `HOME` to a temp dir *before* importing the module. Cache-busting with query strings (`?t=...`) works for re-evaluating a single module but not its transitive dependencies.
- **generator.js auth coupling:** `generator.js` imports `auth.js` at the top level. To test "not authenticated" paths, override `HOME` before the first import of `generator.js` so `getToken()` finds no config file. Then also delete `GITHUB_TOKEN` env var.
- **server.js port 0:** `startDataServer(dir, 0)` binds to a random available port — use `server.address().port` to discover it. Essential for parallel-safe tests.
- **db-sync.js early return:** `syncToDb` and `dropFormTables` both return `undefined` immediately when `DATABASE_URL` is not set. No Postgres needed for unit tests.
- **eleventy-builder.js escapeHtml:** The `escapeHtml` function handles `&`, `<`, `>`, `"` — verified by dedicated escaping tests.
- **Test patterns:** Use `fs.mkdtempSync` + `after` cleanup. Group with `describe`. ES module imports. `node:test` + `node:assert/strict`.
- **Key test files:** `test/server.test.js` (API), `test/auth.test.js` (config I/O), `test/generator.test.js` (exports + auth guard), `test/db-sync.test.js` (path + early return), `test/eleventy-builder.test.js` (field types + escaping + index).
