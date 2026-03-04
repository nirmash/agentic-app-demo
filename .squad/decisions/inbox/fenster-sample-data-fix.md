# Sample Data Deployment Fix

**Author:** Fenster (Core Dev)  
**Status:** Implemented  
**Date:** 2025-07-17

## Problem

The deployed Embr test app had no data — both the file-based records API and Postgres were empty. Two root causes:

1. `.gitignore` had `_data/*.json` with only `!_data/*_spec.json` exception — sample data files (e.g., `speaker_abc12345.json`) were never committed/pushed.
2. Sample data files lacked `_meta.formName` — `db/seed.js` silently skips records without it.

## Decision

- Updated `.gitignore` to add exceptions for `speaker_*`, `attendee_*`, and `session_*` data files alongside the existing `*_spec.json` exception.
- Added `"formName"` to the `_meta` block of all 9 sample data records, matching the form name each belongs to.
- This is the minimal fix: user-generated data files (random UUIDs) are still ignored, only known seed data is tracked.

## Convention Going Forward

Any new sample/seed data file **must** include `_meta.formName` and have a filename pattern that is un-ignored in `.gitignore`. Without both, the data won't reach the deployed app.

## Impact

- All 32 deployed-app integration tests pass.
- Commit `354c38d` pushed to `main`.
