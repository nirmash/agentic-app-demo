# Save Button on Generated Forms

**Author:** Fenster (Core Dev)  
**Status:** Implemented  
**Date:** 2025

## Decision

Added a "💾 Save" button to all generated forms, placed in the record navigation bar next to "+ New Record".

## Details

- **Location:** `src/eleventy-builder.js` — `generateFormHtml()` function
- **Approach:** Extracted the inline save logic from the form submit handler into a reusable `saveCurrentRecord()` function. Both the form submit event and the new save button call this function.
- **Behavior:** Save uses the current `SESSION_ID`, so clicking Save on a loaded record updates it in place. Clicking "+ New Record" first generates a new session ID, then Save creates a new record.
- **Styling:** `btn-success` (green) for Save vs `btn-primary` (blue) for New Record — visually distinct actions.

## Rationale

Users could submit forms (which saves + navigates) but had no explicit "save current record" action. The Save button makes the save action discoverable and intentional, especially when editing existing records loaded via navigation.

## Impact

- All existing tests pass (231/232 — 1 pre-existing Node.js runner issue in server.test.js).
- Existing forms need a rebuild (`buildEleventySite()` or `adcgen rebuild`) to pick up the new button.
