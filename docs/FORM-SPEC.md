# Form Spec Reference

The JSON form spec is the intermediate format between the LLM and the HTML generator. The LLM produces it; `eleventy-builder.js` consumes it to generate styled HTML pages.

## Top-Level Structure

```json
{
  "title": "Form Title",
  "formName": "snake_case_name",
  "sections": [ ... ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Display title shown at the top of the form |
| `formName` | string | Snake_case identifier used for filenames, URLs, and table names |
| `sections` | array | Ordered list of form sections |

## Section Structure

```json
{
  "heading": "Section Title",
  "fields": [ ... ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `heading` | string | Section header text (markdown supported) |
| `fields` | array | Ordered list of fields in this section |

## Field Types

Every field has these common properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | One of: `text`, `textarea`, `password`, `dropdown`, `checkbox`, `radio`, `table`, `button`, `link` |
| `label` | string | Yes | Display label |
| `name` | string | Yes | Snake_case identifier (used as HTML `name`/`id`) |
| `required` | boolean | No | Whether the field is required for validation |

### text

Standard single-line text input.

```json
{
  "type": "text",
  "label": "Full Name",
  "name": "full_name",
  "placeholder": "Enter your name",
  "required": true
}
```

| Property | Type | Description |
|----------|------|-------------|
| `placeholder` | string | Placeholder text |

### textarea

Multi-line text input.

```json
{
  "type": "textarea",
  "label": "Description",
  "name": "description",
  "placeholder": "Enter details...",
  "rows": 6
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `placeholder` | string | | Placeholder text |
| `rows` | number | 4 | Number of visible text rows |

### password

Masked password input with a 👁 toggle button.

```json
{
  "type": "password",
  "label": "Password",
  "name": "password",
  "placeholder": "Enter password",
  "required": true
}
```

| Property | Type | Description |
|----------|------|-------------|
| `placeholder` | string | Placeholder text |

### dropdown

Select menu with predefined options.

```json
{
  "type": "dropdown",
  "label": "Country",
  "name": "country",
  "options": ["USA", "Canada", "UK", "Germany", "Japan"],
  "required": true
}
```

| Property | Type | Description |
|----------|------|-------------|
| `options` | string[] | List of selectable values |

### checkbox

Single checkbox or group of checkboxes.

**Single checkbox:**
```json
{
  "type": "checkbox",
  "label": "Agree to Terms",
  "name": "agree_terms",
  "required": true
}
```

**Checkbox group:**
```json
{
  "type": "checkbox",
  "label": "Interests",
  "name": "interests",
  "options": ["Sports", "Music", "Technology", "Travel"]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `options` | string[] | If provided, renders a group of checkboxes. If omitted, renders a single checkbox. |

### radio

Radio button group.

```json
{
  "type": "radio",
  "label": "Preferred Contact Method",
  "name": "contact_method",
  "options": ["Email", "Phone", "SMS"]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `options` | string[] | List of radio options |

### button

Action button with optional event handlers.

```json
{
  "type": "button",
  "label": "Submit",
  "name": "submit_btn",
  "events": [
    {
      "event": "click",
      "description": "Submit the form",
      "handler": "document.getElementById('main-form').requestSubmit();"
    }
  ]
}
```

Buttons named `submit` or with "Submit" in the label get the `btn-primary` CSS class.

### link

Navigation link to another page.

```json
{
  "type": "link",
  "label": "Go to Login Page",
  "name": "login_link",
  "href": "/login/"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `href` | string | Link target URL (typically `/<page_name>/` for internal links) |

### table

Data table with embedded controls per column. Includes built-in **+ Add Row** and **✕ Delete Row** buttons (do not add these manually).

```json
{
  "type": "table",
  "label": "Team Members",
  "name": "team_members",
  "columns": [
    { "header": "First Name", "name": "first_name", "type": "text", "required": true },
    { "header": "Role", "name": "role", "type": "dropdown", "options": ["Dev", "QA"] },
    { "header": "Active", "name": "active", "type": "checkbox" },
    { "header": "Full Name", "name": "full_name", "type": "calculated", "formula": "{first_name} {last_name}" }
  ],
  "initialRows": 1
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `columns` | array | | Column definitions (see below) |
| `initialRows` | number | 1 | Number of rows to render initially |

## Table Column Types

Each column has:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `header` | string | Yes | Column header text |
| `name` | string | Yes | Snake_case identifier |
| `type` | string | Yes | One of: `text`, `dropdown`, `checkbox`, `calculated` |
| `options` | string[] | For `dropdown` | Selectable values |
| `required` | boolean | No | Marks the column as required for validation |
| `formula` | string | For `calculated` | Formula expression (see below) |

### Calculated Columns

Calculated columns are read-only and update automatically when other columns change.

**Template mode** — Use `{column_name}` placeholders for simple concatenation:

```json
{
  "header": "Full Name",
  "name": "full_name",
  "type": "calculated",
  "formula": "{first_name} {last_name}"
}
```

**Expression mode** — Prefix with `=` for JavaScript expressions where column names are variables:

```json
{
  "header": "Handle",
  "name": "handle",
  "type": "calculated",
  "formula": "=email.split('@')[0]"
}
```

```json
{
  "header": "Uppercase Name",
  "name": "upper",
  "type": "calculated",
  "formula": "=first_name.toUpperCase()"
}
```

> Do **not** use events for calculated columns — the system handles recalculation automatically.

## Events

Any field type can have an `events` array:

```json
{
  "events": [
    {
      "event": "click",
      "description": "What should happen",
      "handler": "// JavaScript code"
    }
  ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `event` | string | DOM event name (`click`, `change`, `input`, etc.) |
| `description` | string | Human-readable description of the behavior |
| `handler` | string | JavaScript code to execute |

**Important rules for handlers:**
- The form element always has `id="main-form"`
- To submit the form: `document.getElementById('main-form').requestSubmit()`
- Never reference any other form ID
- Do not add table row add/delete handlers — the system manages those

## Complete Example

See [`test/fixtures/all_controls_spec.json`](../test/fixtures/all_controls_spec.json) for a full example spec that demonstrates every field type, including tables with calculated columns, events, links, and validation.

```json
{
  "title": "All Controls Test Form",
  "formName": "all_controls_test",
  "sections": [
    {
      "heading": "Text & Password Fields",
      "fields": [
        { "type": "text", "label": "Full Name", "name": "full_name", "placeholder": "Enter your name", "required": true },
        { "type": "text", "label": "Email Address", "name": "email", "placeholder": "user@example.com", "required": true },
        { "type": "password", "label": "Password", "name": "password", "placeholder": "Enter password", "required": true }
      ]
    },
    {
      "heading": "Selection Controls",
      "fields": [
        { "type": "dropdown", "label": "Country", "name": "country", "options": ["USA", "Canada", "UK"], "required": true },
        { "type": "checkbox", "label": "Interests", "name": "interests", "options": ["Sports", "Music", "Technology"] },
        { "type": "checkbox", "label": "Agree to Terms", "name": "agree_terms", "required": true },
        { "type": "radio", "label": "Contact Method", "name": "contact_method", "options": ["Email", "Phone", "SMS"] }
      ]
    },
    {
      "heading": "Table with Mixed Controls",
      "fields": [
        {
          "type": "table",
          "label": "Team Members",
          "name": "team_members",
          "columns": [
            { "header": "First Name", "name": "first_name", "type": "text", "required": true },
            { "header": "Last Name", "name": "last_name", "type": "text", "required": true },
            { "header": "Full Name", "name": "full_name", "type": "calculated", "formula": "{first_name} {last_name}" },
            { "header": "Email", "name": "email", "type": "text" },
            { "header": "Handle", "name": "handle", "type": "calculated", "formula": "='@' + email.split('@')[0]" },
            { "header": "Role", "name": "role", "type": "dropdown", "options": ["Developer", "Designer", "Manager", "QA"] },
            { "header": "Active", "name": "active", "type": "checkbox" }
          ],
          "initialRows": 1
        }
      ]
    },
    {
      "heading": "Navigation & Actions",
      "fields": [
        { "type": "link", "label": "Go to Login Page", "name": "login_link", "href": "/login/" },
        {
          "type": "button", "label": "Validate", "name": "validate_btn",
          "events": [{ "event": "click", "description": "Validate all required fields", "handler": "const form = document.getElementById('main-form'); if (form.checkValidity()) { alert('All fields valid!'); } else { form.reportValidity(); }" }]
        },
        {
          "type": "button", "label": "Submit", "name": "submit_btn",
          "events": [{ "event": "click", "description": "Submit the form", "handler": "document.getElementById('main-form').requestSubmit();" }]
        }
      ]
    }
  ]
}
```
