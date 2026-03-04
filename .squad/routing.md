# Routing Rules

## Signal → Agent Mapping

| Signal | Agent | Notes |
|--------|-------|-------|
| CLI commands, Express API, form generation, LLM integration | Fenster | Core implementation work |
| Eleventy config, HTML generation, Primer CSS | Fenster | Build & templating |
| Database sync, PostgreSQL | Fenster | Data layer |
| ADC MCP client (adc.js) | Fenster | Secondary CLI |
| Tests, test fixtures, quality, coverage | Hockney | All testing |
| Docs, README, guides, examples, onboarding | McManus | Developer experience |
| Architecture decisions, scope, code review | Keaton | Oversight & review |
| Multi-domain / "team" requests | Keaton + relevant agents | Lead coordinates |
| Work queue, backlog, issues | Ralph | Monitoring |

## File Ownership

| Path Pattern | Primary | Secondary |
|--------------|---------|-----------|
| `src/*.js` | Fenster | Keaton (review) |
| `bin/*.js` | Fenster | Keaton (review) |
| `test/**` | Hockney | Fenster (fixtures) |
| `*.md` (non-.squad) | McManus | Keaton (review) |
| `db/**` | Fenster | — |
| `deploy.sh`, `setup.sh` | Fenster | McManus (docs) |
| `.squad/**` | Scribe | Keaton (decisions) |
