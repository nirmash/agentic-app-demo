# Form System Features: Lookup, New-Record Links, Home Button, Breadcrumbs

**Author:** Fenster (Core Dev)  
**Status:** Implemented  
**Date:** 2026-03-18

## Changes

### 1. Lookup Dropdown (Foreign Key Field)

New field type `lookup` added to the form spec and HTML generator. Creates a `<select>` that dynamically loads records from another form's data via `/api/records/{source}`.

**Spec format:**
```json
{
  "type": "lookup",
  "label": "Speaker",
  "name": "speaker",
  "source": "speaker",
  "displayField": "name",
  "valueField": "sessionId",
  "multiple": false
}
```

- `source`: form name to load records from
- `displayField`: field from source record shown as option label
- `valueField`: field from source record used as option value (`"sessionId"` uses the record's session ID)
- `multiple`: if true, renders multi-select

**Implementation:** `generateFieldHtml()` renders a `<select>` with data attributes. Client-side JS queries all `select[data-lookup-source]` elements on page load and populates them via fetch.

### 2. Links Open New Record

Link fields (`type: "link"`) now append `?new=true` to their href. The target form's JS detects this parameter and skips auto-loading the first existing record, presenting a blank form instead.

### 3. Home Button

A `🏠 Home` link added to the record navigation bar on every form, linking to `/`. Placed before the Prev/Next buttons.

### 4. Breadcrumbs

Primer CSS breadcrumb navigation added above the form header: `Home > {Form Title}`. "Home" links to `/`.

## Files Changed

- `src/eleventy-builder.js` — all 4 features in `generateFormHtml()`, lookup in `generateFieldHtml()`
- `_data/session_spec.json` — replaced `speaker_name` text field with `speaker` lookup field
- All `_site_src/*.html` and `_site/*/index.html` — regenerated
- `test/all-controls.test.js`, `test/eleventy-builder.test.js` — updated link assertions for `?new=true`

## Impact

264 tests pass. All 5 forms rebuilt.
