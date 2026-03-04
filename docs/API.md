# API Reference

adcgen runs an Express data API alongside the Eleventy dev server. In development mode it runs on port 3001; in production (`deploy-server.js`) all endpoints are served on a single port.

## Core Endpoints

### POST /api/save

Save form submission data as a JSON file. If `DATABASE_URL` is set, data is also synced to Postgres.

**Request:**
```json
{
  "formName": "signup_form",
  "sessionId": "a1b2c3d4",
  "data": {
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "_meta": {
      "sessionId": "a1b2c3d4",
      "submittedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Response (200):**
```json
{
  "ok": true,
  "file": "signup_form_a1b2c3d4.json"
}
```

**Response (400):**
```json
{
  "error": "No data provided"
}
```

**Notes:**
- If `sessionId` is omitted, a random UUID segment is generated
- If `formName` is omitted, defaults to `"form"`
- File is written to `_data/<formName>_<sessionId>.json`

---

### GET /api/load

Load previously saved form data by form name and session ID.

**Query parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `formName` | Yes | The form name (e.g. `signup_form`) |
| `id` | Yes | The session ID |

**Example:**
```
GET /api/load?formName=signup_form&id=a1b2c3d4
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "_meta": { "sessionId": "a1b2c3d4", "submittedAt": "2024-01-15T10:30:00.000Z" }
  }
}
```

**Response (400):**
```json
{
  "error": "formName and id required"
}
```

**Response (404):**
```json
{
  "error": "Not found"
}
```

---

## Database Explorer Endpoints

These endpoints are **only available when `DATABASE_URL` is set** and are served by the production deploy server (`bin/deploy-server.js`).

### GET /api/db/tables

List all Postgres tables in the `public` schema.

**Response:**
```json
{
  "ok": true,
  "tables": ["signup_form", "signup_form_team_members"]
}
```

---

### GET /api/db/describe/:table

Get column schema for a table.

**Example:**
```
GET /api/db/describe/signup_form
```

**Response:**
```json
{
  "ok": true,
  "columns": [
    { "column_name": "session_id", "data_type": "text", "is_nullable": "NO" },
    { "column_name": "submitted_at", "data_type": "timestamp with time zone", "is_nullable": "YES" },
    { "column_name": "full_name", "data_type": "text", "is_nullable": "YES" },
    { "column_name": "email", "data_type": "text", "is_nullable": "YES" }
  ]
}
```

---

### GET /api/db/records/:formName

List all submissions for a form, ordered by `submitted_at` descending.

**Example:**
```
GET /api/db/records/signup_form
```

**Response:**
```json
{
  "ok": true,
  "records": [
    {
      "session_id": "a1b2c3d4",
      "submitted_at": "2024-01-15T10:30:00.000Z",
      "full_name": "Jane Doe",
      "email": "jane@example.com"
    }
  ]
}
```

Returns `{ "ok": true, "records": [] }` if the table doesn't exist yet.

---

### GET /api/db/record/:formName/:sessionId

Get a single submission with all child table data included.

**Example:**
```
GET /api/db/record/signup_form/a1b2c3d4
```

**Response:**
```json
{
  "ok": true,
  "record": {
    "session_id": "a1b2c3d4",
    "submitted_at": "2024-01-15T10:30:00.000Z",
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "team_members": [
      { "id": 1, "session_id": "a1b2c3d4", "row_index": 0, "first_name": "Alice", "last_name": "Smith" }
    ]
  }
}
```

---

### POST /api/db/query

Execute a raw SQL query against the database.

**Request:**
```json
{
  "sql": "SELECT session_id, full_name FROM signup_form LIMIT 5"
}
```

**Response:**
```json
{
  "ok": true,
  "rows": [
    { "session_id": "a1b2c3d4", "full_name": "Jane Doe" }
  ],
  "rowCount": 1
}
```

> ⚠️ **Warning:** This endpoint executes arbitrary SQL. It is intended for development and admin use only.

---

## Production-Only Endpoints

These are available only on the deploy server (`bin/deploy-server.js`).

### GET /api/cli/auth-status

Check if the server has a stored GitHub token.

**Response:**
```json
{ "ok": true, "loggedIn": true, "user": "octocat" }
```
or
```json
{ "ok": true, "loggedIn": false, "ghCliAvailable": true }
```

### POST /api/cli/login

Authenticate with a GitHub token or auto-detect from `gh` CLI.

**Request (manual token):**
```json
{ "token": "ghp_xxxxxxxxxxxx" }
```

**Request (auto-detect):** Send empty body `{}` to use `gh auth token`.

### POST /api/cli/logout

Remove the stored GitHub token.

### GET /api/cli/token

Retrieve the stored token for browser-side LLM calls.

### POST /api/cli/save-form

Save a form spec, generate HTML, and rebuild the site.

**Request:**
```json
{
  "spec": {
    "title": "My Form",
    "formName": "my_form",
    "sections": [...]
  }
}
```

### POST /api/cli/exec

Execute an adcgen or adc CLI command remotely.

**Request:**
```json
{ "command": "adcgen list" }
```

**Response:**
```json
{ "ok": true, "output": "  📋 Forms (2):\n     • signup_form\n     • login" }
```

Only `adcgen` and `adc` commands are allowed. `login`/`logout` subcommands are redirected to the dedicated auth endpoints.
