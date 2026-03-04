# Contributing

## Development Setup

```bash
# Clone the repo
git clone https://github.com/nirmash/agentic-app-demo.git
cd agentic-app-demo

# Install dependencies
npm install

# Link the CLI globally
npm link

# Verify the CLI works
adcgen --help
```

### Requirements

- Node.js 18+
- A GitHub token (for LLM API access via GitHub Models)
- `gh` CLI (optional, for easy login)
- Postgres (optional, for database sync features)

## Running Tests

```bash
npm test
```

This runs the test suite using the **Node.js native test runner** (`node --test`). Tests are in `test/` and use specs from `test/fixtures/`.

The test suite covers all field types, HTML generation, table features (add/delete rows, calculated columns, required columns), event handlers, data save/load, and the ASCII preview renderer.

## Project Conventions

- **ES Modules** — All source files use `import`/`export` (the project has `"type": "module"` in package.json)
- **No TypeScript** — Plain JavaScript throughout
- **Node.js native test runner** — No external test frameworks; uses `node:test` and `node:assert`
- **snake_case** for form field names and file names
- **Primer CSS dark mode** for all generated HTML

## How to Add a New Field Type

1. **Define the spec format** — Add the new type to the system prompt in `src/generator.js` so the LLM knows how to produce it. Include the type name, its properties, and any constraints.

2. **Render ASCII preview** — Add a `renderYourType()` function in `src/ascii-preview.js` and wire it into the `switch` statement in `renderAsciiPreview()`.

3. **Generate HTML** — Add a `case` for your type in the `generateFieldHtml()` switch in `src/eleventy-builder.js`. Use Primer CSS classes for styling.

4. **Handle data collection** — If the field has a non-standard value (not a simple `input.value`), update the `collectFormData()` script generation in `eleventy-builder.js` to collect it correctly on submit.

5. **Handle data loading** — If needed, update the `loadFormData()` script generation so that `?id=` URLs populate the new field type correctly.

6. **Add tests** — Create a spec in `test/fixtures/` and add test cases in `test/all-controls.test.js` verifying that:
   - HTML output contains the expected elements
   - The field collects data correctly
   - The field loads data correctly

7. **Update the form spec docs** — Add the new type to `docs/FORM-SPEC.md`.

## Code Style

- No linter is enforced, but keep the existing style: 2-space indentation, single quotes, semicolons.
- Prefer small, focused functions.
- Use descriptive variable names.

## PR Process

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Run `npm test` and verify all tests pass
4. Open a pull request describing what changed and why
5. Wait for review
