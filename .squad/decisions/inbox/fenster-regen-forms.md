# Decision: Regenerate Forms After Generator Changes

**Author:** Fenster (Core Dev)  
**Date:** 2026-03-18  
**Status:** Convention

## Context

The save button was added to `generateFormHtml()` in `src/eleventy-builder.js`, but the existing HTML files in `_site_src/` were generated before that change. The deployed forms were missing the save button.

## Decision

After any change to the HTML generation logic in `eleventy-builder.js`, run `adcgen rebuild && npm run build` to regenerate all form templates and rebuild the Eleventy site. This ensures deployed forms always reflect the latest generator output.

## Impact

- Regenerated all 5 forms (speaker, attendee, session, contacts, all_controls_test) — save button now appears in all of them.
- 11 Eleventy output files rebuilt.
- Commit `ec290f0` on `main`.
