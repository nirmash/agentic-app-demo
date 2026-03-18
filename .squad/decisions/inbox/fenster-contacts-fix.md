# Decision: Table Data Collection Uses DOM-Aware Parsing

**Author:** Fenster (Core Dev)  
**Date:** 2026-07  
**Status:** Implemented

## Context

The `collectFormData()` function in generated form HTML used a non-greedy regex `^(.+?)_(.+?)_(\d+)$` to parse table input names into `{tableName}_{colName}_{rowIndex}`. This broke when table field names or column names contained underscores — the regex captured the wrong split point.

The contacts form (`user_details_table`) was the first to surface this because it's 100% table data, making the bug appear as "save doesn't work." Other forms (speaker, attendee) have the same bug for their table fields but it went unnoticed because their non-table fields still saved correctly.

## Decision

Replaced the regex with a DOM-aware approach: `collectFormData()` now reads all `table[data-field-name]` values, sorts them longest-first, and matches each input name against known table prefixes. Column name and row index are extracted from the remaining suffix using `lastIndexOf('_')`.

## Convention

Calculated column formulas that need anything beyond simple `{field_name}` template replacement should use expression mode (`=` prefix). Template mode regex `\{(\w+)\}` only matches word-character field names.

## Impact

All forms regenerated. 264 tests pass.
