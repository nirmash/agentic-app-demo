# Decision: Switch Form Navigation to File-Based API

**Author:** Fenster (Core Dev)  
**Status:** Implemented

## Summary

Replaced the DB-based record navigation in generated form HTML with the file-based records API, making prev/next navigation and auto-load work universally (with or without Postgres).

## Changes

1. **Navigation endpoints**: Client-side JS now uses `GET /api/records/:formName` (list) and `GET /api/load?formName=X&id=Y` (single record) instead of `/api/db/records/` and `/api/db/record/`. These file-based endpoints are available in both dev and prod servers.

2. **Auto-load first record**: Forms now auto-load the first available record on page open. If `?id=` is in the URL, that specific record is selected in the nav. This runs unconditionally — no longer gated behind `!loadId`.

3. **List view edit links**: Changed "View" → "✏️ Edit" and column header "Action" → "Edit" for clarity.

## Rationale

The DB endpoints (`/api/db/*`) require a running Postgres instance, which isn't always available (e.g., local dev, file-only deployments). The file-based API works everywhere since `_data/*.json` files are always present. The DB endpoints remain in `deploy-server.js` for direct Postgres access but are no longer the default navigation path.

## Files Changed

- `src/eleventy-builder.js` — `generateFormHtml()` and `generateListViewHtml()`
- `test/db-records.test.js`, `test/list-view.test.js`, `test/form-navigation.test.js` — updated assertions
- All `_site_src/*.html` and `_site/*/index.html` — regenerated

## Impact

235 tests pass (1 pre-existing server.test.js deserialization failure unrelated to this change).
