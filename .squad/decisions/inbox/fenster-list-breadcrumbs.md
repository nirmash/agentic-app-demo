# Decision: Breadcrumbs on List View Pages

**Author:** Fenster (Core Dev)  
**Status:** Implemented  
**Date:** 2026-03-18

Added breadcrumb navigation (`Home > {Form Title} Records`) to all list view pages, matching the pattern already used on form pages.

**Implementation:**
- Modified `generateListViewHtml()` in `src/eleventy-builder.js`
- Same Primer CSS `breadcrumb` classes, same `<nav aria-label="Breadcrumb">` structure
- Home links to `/`, current page shows form title + " Records"

**Rationale:** Form pages had breadcrumbs but list pages didn't. Users navigating to a list view had no way to quickly orient themselves or return home without the browser back button. This makes navigation consistent across all page types.

**Impact:** All 5 list view pages now have breadcrumbs. Commit `6ba609d` on `main`. 251 tests pass.
