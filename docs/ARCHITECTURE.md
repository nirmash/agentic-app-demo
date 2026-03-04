# Architecture

## System Overview

adcgen is a CLI-to-browser pipeline that turns natural language descriptions into styled HTML data-entry forms. The core flow is:

```
User prompt → CLI → LLM (GPT-4o) → JSON spec → ASCII preview → HTML (Primer CSS) → Eleventy site
```

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (bin/adcgen.js → src/cli.js)                           │
│  Commander-based command router                             │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│          │          │          │          │                  │
│  auth.js │generator │ascii-    │eleventy- │  server.js      │
│          │  .js     │preview.js│builder.js│  (data API)     │
│          │          │          │          │                  │
│  GitHub  │  LLM     │ Terminal │  HTML +  │  Express        │
│  token   │  calls   │ preview  │  Primer  │  JSON save/load │
│  mgmt    │  GPT-4o  │  render  │  CSS gen │  + Postgres     │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
                                                │
                                          ┌─────┴──────┐
                                          │ db-sync.js  │
                                          │ db.js       │
                                          │ (Postgres)  │
                                          └─────────────┘
```

## Data Flow

### Form Generation

```
1. User runs:  adcgen generate signup_form
2. CLI prompts for a natural language description
3. generator.js sends the description to GPT-4o with a system prompt
4. GPT-4o returns a JSON form spec
5. ascii-preview.js renders the spec as terminal ASCII art
6. User approves (or re-prompts)
7. eleventy-builder.js converts the spec → HTML page with Primer CSS
8. HTML is written to _site_src/<formName>.html
9. Spec is saved to _data/<formName>_spec.json
10. Index page is regenerated with links to all forms
```

### Form Submission

```
1. User fills out the form in a browser
2. Client JS collects all field values + table rows
3. POST /api/save with { formName, sessionId, data }
4. server.js writes _data/<formName>_<sessionId>.json
5. If DATABASE_URL is set, db-sync.js upserts to Postgres
6. Success toast appears in the browser
```

### Data Loading

```
1. User opens a form with ?id=<sessionId>
2. Client JS calls GET /api/load?formName=X&id=Y
3. server.js reads the JSON file from _data/
4. Client JS populates all fields and table rows
```

## Key Modules

| Module | File | Responsibility |
|--------|------|----------------|
| **CLI** | `src/cli.js` | Commander setup, command routing, interactive prompts |
| **Auth** | `src/auth.js` | GitHub token management — `gh` CLI auto-detect, manual PAT entry, `GITHUB_TOKEN` env var |
| **Generator** | `src/generator.js` | LLM API calls for form generation, spec editing, and HTML editing. Includes system prompts and handler sanitization |
| **ASCII Preview** | `src/ascii-preview.js` | Box-drawing terminal renderer — renders form specs as ASCII art for review before HTML generation |
| **Eleventy Builder** | `src/eleventy-builder.js` | HTML generation from JSON specs. Primer CSS dark mode, table row add/delete, calculated columns, event wiring, data load/save scripts |
| **Data Server** | `src/server.js` | Express API for saving and loading form submissions as JSON files. CORS-enabled for Eleventy dev server |
| **DB Sync** | `src/db-sync.js` | Optional Postgres integration — auto-creates tables from specs, upserts submissions, handles schema evolution |
| **DB Pool** | `src/db.js` | `pg.Pool` wrapper around `DATABASE_URL` with error handling |
| **Deploy Server** | `bin/deploy-server.js` | Production server — static files + full API on a single port. Includes DB explorer endpoints and browser-based CLI |

## Deployment Modes

### Development (default)

`adcgen launch` starts two processes:

| Process | Port | Purpose |
|---------|------|---------|
| Eleventy dev server | 8080 | Static site with live reload |
| Express data API | 3001 | Form save/load endpoints |

The generated HTML auto-detects which mode it's running in and routes API calls accordingly.

### Production

`bin/deploy-server.js` runs a single Express server that serves both static files and the API on one port (default 80). Activated via `deploy.sh --serve`.

Additional production-only endpoints:
- `/api/cli/auth-status` — check login state
- `/api/cli/login` / `/api/cli/logout` — browser-based auth
- `/api/cli/save-form` — save forms from a browser UI
- `/api/cli/exec` — run adcgen commands remotely
- `/api/db/*` — Postgres explorer (when `DATABASE_URL` is set)

## Database Integration

Postgres support is **optional** and activated by setting `DATABASE_URL`.

When enabled:
1. **Auto-schema**: `db-sync.js` reads the form's JSON spec and creates tables automatically
2. **Main table**: One row per submission, with columns matching scalar form fields
3. **Child tables**: One table per `table`-type field, with rows linked by `session_id`
4. **Schema evolution**: New fields added to specs get `ALTER TABLE ADD COLUMN` automatically
5. **Upsert**: Re-submitting with the same `sessionId` updates the existing row

```
Form spec with a "team_members" table field:

  ┌──────────────┐        ┌──────────────────────┐
  │ signup_form   │        │ signup_form_team_     │
  │ (main table)  │ 1───∞  │ members (child table) │
  ├──────────────┤        ├──────────────────────┤
  │ session_id PK │        │ id SERIAL PK          │
  │ submitted_at  │        │ session_id FK          │
  │ full_name     │        │ row_index              │
  │ email         │        │ first_name             │
  └──────────────┘        │ last_name              │
                          │ role                   │
                          └──────────────────────┘
```
