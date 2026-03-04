# McManus — History

## Project Context
**adcgen** — CLI tool for AI-powered HTML form generation. Node.js, Express, Eleventy, Primer CSS.
User: Nir Mashkowski.

**Current docs:** README.md is comprehensive (270 lines) covering features, installation, CLI commands, project structure, deployment, and architecture. No separate API docs, contributing guide, or architecture doc exists yet.

## Learnings

### Documentation structure (created)
- `docs/ARCHITECTURE.md` — system overview, component diagram, data flow, deployment modes, DB integration
- `docs/API.md` — all Express endpoints (core save/load, DB explorer, production-only CLI endpoints) with request/response examples
- `docs/CONTRIBUTING.md` — dev setup, test runner (`npm test` → `node --test`), how to add a new field type (7-step guide), PR process
- `docs/FORM-SPEC.md` — complete JSON spec reference with all 9 field types, table column types, calculated column formulas (template vs expression), events

### Key file paths
- Source modules: `src/cli.js`, `src/auth.js`, `src/generator.js`, `src/ascii-preview.js`, `src/eleventy-builder.js`, `src/server.js`, `src/db-sync.js`, `src/db.js`
- Production server: `bin/deploy-server.js` — single-port static + API + browser CLI
- Test fixture with all controls: `test/fixtures/all_controls_spec.json`
- LLM system prompts live in `src/generator.js` (SYSTEM_PROMPT, EDIT_SYSTEM_PROMPT, EDIT_HTML_PROMPT)

### Architecture patterns
- Two deployment modes: dev (Eleventy:8080 + API:3001) and prod (single Express on port 80)
- HTML auto-detects API URL at runtime — no URL patching needed between modes
- Postgres is optional (activated by `DATABASE_URL`), auto-creates schema from JSON specs
- Form specs are the source of truth; HTML is derived from specs via `eleventy-builder.js`
- Edit mode detects manual HTML changes and switches between spec-based and HTML-based editing

### Conventions
- ES Modules everywhere (`"type": "module"`)
- No TypeScript, no external test framework — Node.js native test runner
- snake_case for all field names and file names
- Primer CSS dark mode for all generated HTML
