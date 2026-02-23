import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFormHtml, generateIndexPage } from '../src/eleventy-builder.js';
import { renderAsciiPreview } from '../src/ascii-preview.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'all_controls_spec.json'), 'utf-8'));

// Generate HTML once for all tests
const HTML = generateFormHtml(SPEC);

// ─── HTML Structure ─────────────────────────────────────────────

describe('HTML structure', () => {
  it('should be valid HTML with doctype', () => {
    assert.ok(HTML.startsWith('<!DOCTYPE html>'));
    assert.ok(HTML.includes('</html>'));
  });

  it('should have dark mode attributes', () => {
    assert.ok(HTML.includes('data-color-mode="dark"'));
    assert.ok(HTML.includes('data-dark-theme="dark"'));
  });

  it('should include Primer CSS', () => {
    assert.ok(HTML.includes('primer.css'));
  });

  it('should have form with id main-form', () => {
    assert.ok(HTML.includes('id="main-form"'));
  });

  it('should have toast notification element', () => {
    assert.ok(HTML.includes('id="toast"'));
    assert.ok(HTML.includes('toast-success'));
  });

  it('should have safe edit zone comments', () => {
    assert.ok(HTML.includes('⚠️ DO NOT EDIT'));
    assert.ok(HTML.includes('✅ SAFE TO EDIT'));
    assert.ok(HTML.includes('END DO NOT EDIT'));
    assert.ok(HTML.includes('END SAFE TO EDIT'));
  });

  it('should have title in header', () => {
    assert.ok(HTML.includes('All Controls Test Form'));
  });
});

// ─── Text Fields ────────────────────────────────────────────────

describe('Text fields', () => {
  it('should render text input with correct attributes', () => {
    assert.ok(HTML.includes('id="full_name"'));
    assert.ok(HTML.includes('name="full_name"'));
    assert.ok(HTML.includes('placeholder="Enter your name"'));
    assert.ok(HTML.includes('type="text"'));
  });

  it('should mark required fields', () => {
    assert.match(HTML, /name="full_name"[^>]*required/);
    assert.match(HTML, /name="email"[^>]*required/);
  });

  it('should render labels with required indicator', () => {
    assert.ok(HTML.includes('Full Name <span class="color-fg-danger">*</span>'));
  });
});

// ─── Password Fields ────────────────────────────────────────────

describe('Password fields', () => {
  it('should render password input', () => {
    assert.ok(HTML.includes('type="password"'));
    assert.ok(HTML.includes('id="password"'));
  });

  it('should have visibility toggle button', () => {
    assert.ok(HTML.includes('Toggle password visibility'));
    assert.ok(HTML.includes('👁'));
  });
});

// ─── Dropdown Fields ────────────────────────────────────────────

describe('Dropdown fields', () => {
  it('should render select element', () => {
    assert.ok(HTML.includes('<select'));
    assert.ok(HTML.includes('name="country"'));
  });

  it('should have default empty option', () => {
    assert.ok(HTML.includes('Select...'));
  });

  it('should include all options', () => {
    for (const opt of ['USA', 'Canada', 'UK', 'Germany', 'Japan']) {
      assert.ok(HTML.includes(`<option value="${opt}">${opt}</option>`));
    }
  });
});

// ─── Checkbox Fields ────────────────────────────────────────────

describe('Checkbox fields', () => {
  it('should render multi-option checkbox group', () => {
    for (const opt of ['Sports', 'Music', 'Technology', 'Travel']) {
      assert.ok(HTML.includes(`value="${opt}"`));
    }
  });

  it('should render single checkbox', () => {
    assert.ok(HTML.includes('name="agree_terms"'));
  });
});

// ─── Radio Fields ───────────────────────────────────────────────

describe('Radio fields', () => {
  it('should render radio buttons', () => {
    assert.ok(HTML.includes('type="radio"'));
    assert.ok(HTML.includes('name="contact_method"'));
  });

  it('should include all options', () => {
    for (const opt of ['Email', 'Phone', 'SMS']) {
      assert.ok(HTML.includes(`value="${opt}"`));
    }
  });

  it('should check first radio by default', () => {
    assert.match(HTML, /value="Email"[^>]*checked/);
  });
});

// ─── Link Fields ────────────────────────────────────────────────

describe('Link fields', () => {
  it('should render anchor tag', () => {
    assert.ok(HTML.includes('href="/login/"'));
    assert.ok(HTML.includes('Go to Login Page'));
    assert.ok(HTML.includes('class="Link"'));
  });
});

// ─── Button Fields ──────────────────────────────────────────────

describe('Button fields', () => {
  it('should render buttons', () => {
    assert.ok(HTML.includes('id="validate_btn"'));
    assert.ok(HTML.includes('id="submit_btn"'));
  });

  it('should apply primary class to submit button', () => {
    assert.ok(HTML.includes('btn btn-primary'));
  });
});

// ─── Table Fields ───────────────────────────────────────────────

describe('Table fields', () => {
  it('should render table with correct id and data attributes', () => {
    assert.ok(HTML.includes('id="table_team_members"'));
    assert.ok(HTML.includes('data-field-name="team_members"'));
    assert.ok(HTML.includes('data-columns='));
    assert.ok(HTML.includes('data-row-count="1"'));
  });

  it('should render column headers', () => {
    for (const h of ['First Name', 'Last Name', 'Full Name', 'Email', 'Handle', 'Role', 'Active']) {
      assert.ok(HTML.includes(`<th class="p-2">${h}</th>`));
    }
  });

  it('should render text inputs in table', () => {
    assert.ok(HTML.includes('name="team_members_first_name_0"'));
    assert.ok(HTML.includes('name="team_members_last_name_0"'));
  });

  it('should render required table columns', () => {
    assert.match(HTML, /name="team_members_first_name_0"[^>]*required/);
    assert.match(HTML, /name="team_members_last_name_0"[^>]*required/);
  });

  it('should render dropdown in table', () => {
    assert.ok(HTML.includes('name="team_members_role_0"'));
    for (const opt of ['Developer', 'Designer', 'Manager', 'QA']) {
      assert.ok(HTML.includes(`<option value="${opt}">${opt}</option>`));
    }
  });

  it('should render checkbox in table', () => {
    assert.ok(HTML.includes('name="team_members_active_0"'));
  });

  it('should render calculated columns as readonly', () => {
    assert.ok(HTML.includes('name="team_members_full_name_0"'));
    assert.match(HTML, /name="team_members_full_name_0"[^>]*readonly/);
    assert.ok(HTML.includes('name="team_members_handle_0"'));
    assert.match(HTML, /name="team_members_handle_0"[^>]*readonly/);
  });

  it('should have delete button per row', () => {
    assert.ok(HTML.includes('deleteTableRow'));
    assert.ok(HTML.includes('title="Delete row"'));
  });

  it('should have Add Row button', () => {
    assert.ok(HTML.includes('+ Add Row'));
    assert.ok(HTML.includes("addTableRow('table_team_members')"));
  });

  it('should have exactly 1 initial row (not 3)', () => {
    const rowMatches = HTML.match(/<tr data-row="/g);
    assert.equal(rowMatches.length, 1);
  });
});

// ─── Table JavaScript ───────────────────────────────────────────

describe('Table JavaScript functions', () => {
  it('should include addTableRow function', () => {
    assert.ok(HTML.includes('function addTableRow(tableId)'));
  });

  it('should include deleteTableRow function', () => {
    assert.ok(HTML.includes('function deleteTableRow(tableId, btn)'));
  });

  it('should handle calculated type in addTableRow', () => {
    assert.ok(HTML.includes("c.type === 'calculated'"));
  });

  it('should set required on dynamic rows', () => {
    assert.ok(HTML.includes('if (c.required) sel.required = true'));
    assert.ok(HTML.includes('if (c.required) inp.required = true'));
  });

  it('should keep at least 1 row on delete', () => {
    assert.ok(HTML.includes('tbody.rows.length <= 1'));
  });
});

// ─── Calculated Column JavaScript ───────────────────────────────

describe('Calculated column JavaScript', () => {
  it('should include recalcRow function', () => {
    assert.ok(HTML.includes('function recalcRow(table, tr)'));
  });

  it('should support template mode (placeholder replacement)', () => {
    // HTML contains literal \{(\w+)\} — in JS strings, backslash needs escaping
    assert.ok(HTML.includes('formula.replace(/\\{(\\w+)\\}/g'));
  });

  it('should support expression mode (= prefix)', () => {
    assert.ok(HTML.includes("formula.startsWith('=')"));
    assert.ok(HTML.includes('new Function'));
  });

  it('should have try/catch for formula errors', () => {
    assert.ok(HTML.includes('catch(e) { el.value'));
  });

  it('should wire event delegation for input and change', () => {
    assert.ok(HTML.includes("table.addEventListener('input'"));
    assert.ok(HTML.includes("table.addEventListener('change'"));
  });

  it('should recalculate after loading data', () => {
    assert.ok(HTML.includes('Recalculate computed columns after loading'));
  });
});

// ─── Form Data Collection ───────────────────────────────────────

describe('Form data collection script', () => {
  it('should include collectFormData function', () => {
    assert.ok(HTML.includes('function collectFormData()'));
  });

  it('should handle table field regex parsing', () => {
    assert.ok(HTML.includes('tableMatch'));
  });

  it('should compact sparse arrays', () => {
    assert.ok(HTML.includes('Compact sparse table arrays'));
  });

  it('should handle unchecked checkboxes', () => {
    assert.ok(HTML.includes('unchecked checkboxes'));
  });

  it('should include form submission handler', () => {
    assert.ok(HTML.includes("addEventListener('submit'"));
    assert.ok(HTML.includes('/api/save'));
  });
});

// ─── Data Loading ───────────────────────────────────────────────

describe('Data loading script', () => {
  it('should check for ?id= URL parameter', () => {
    assert.ok(HTML.includes("urlParams.get('id')"));
  });

  it('should fetch from /api/load', () => {
    assert.ok(HTML.includes('/api/load'));
  });

  it('should include populateForm function', () => {
    assert.ok(HTML.includes('function populateForm(data)'));
  });

  it('should handle table data loading with dynamic row creation', () => {
    assert.ok(HTML.includes("table[data-field-name=\"' + key + '\""));
    assert.ok(HTML.includes('addTableRow(tableEl.id)'));
  });
});

// ─── Event Handlers ─────────────────────────────────────────────

describe('Event handlers', () => {
  it('should wire custom event handlers', () => {
    assert.ok(HTML.includes("document.getElementById('validate_btn')"));
    assert.ok(HTML.includes("document.getElementById('submit_btn')"));
  });

  it('should use main-form for submit', () => {
    assert.ok(HTML.includes("document.getElementById('main-form').requestSubmit()"));
  });
});

// ─── Section Headings ───────────────────────────────────────────

describe('Section headings', () => {
  it('should render all section headings', () => {
    for (const h of ['Text &amp; Password Fields', 'Selection Controls', 'Table with Mixed Controls', 'Navigation &amp; Actions']) {
      assert.ok(HTML.includes(h), `Missing heading: ${h}`);
    }
  });
});

// ─── ASCII Preview ──────────────────────────────────────────────

describe('ASCII preview', () => {
  const ascii = renderAsciiPreview(SPEC);

  it('should render title', () => {
    assert.ok(ascii.includes('All Controls Test Form'));
  });

  it('should render text fields with placeholder', () => {
    assert.ok(ascii.includes('Full Name'));
    assert.ok(ascii.includes('Enter your name'));
  });

  it('should render dropdown with arrow', () => {
    assert.ok(ascii.includes('▼'));
    assert.ok(ascii.includes('Country'));
  });

  it('should render checkboxes', () => {
    assert.ok(ascii.includes('☐'));
    assert.ok(ascii.includes('Sports'));
  });

  it('should render radio buttons', () => {
    assert.ok(ascii.includes('◯'));
    assert.ok(ascii.includes('Email'));
  });

  it('should render buttons', () => {
    assert.ok(ascii.includes('[ Validate ]'));
    assert.ok(ascii.includes('[ Submit ]'));
  });

  it('should render table with headers', () => {
    assert.ok(ascii.includes('Team Members'));
    assert.ok(ascii.includes('First Na')); // truncated due to column width
  });

  it('should render calculated column as =calc', () => {
    assert.ok(ascii.includes('=calc'));
  });

  it('should show Add Row hint', () => {
    assert.ok(ascii.includes('[ + Add Row ]'));
  });

  it('should show delete button hint', () => {
    assert.ok(ascii.includes('✕'));
  });

  it('should render link', () => {
    assert.ok(ascii.includes('🔗'));
    assert.ok(ascii.includes('Go to Login Page'));
    assert.ok(ascii.includes('/login/'));
  });

  it('should render section headings', () => {
    assert.ok(ascii.includes('■ Text & Password Fields'));
    assert.ok(ascii.includes('■ Selection Controls'));
  });
});

// ─── Index Page ─────────────────────────────────────────────────

describe('Index page generation', () => {
  it('should generate index.html with form links', () => {
    const tmpDir = path.join(__dirname, '.tmp_index_test');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'form_a.html'), '<html></html>');
    fs.writeFileSync(path.join(tmpDir, 'form_b.html'), '<html></html>');

    generateIndexPage(tmpDir);

    const indexHtml = fs.readFileSync(path.join(tmpDir, 'index.html'), 'utf-8');
    assert.ok(indexHtml.includes('Form A'));
    assert.ok(indexHtml.includes('Form B'));
    assert.ok(indexHtml.includes('/form_a/'));
    assert.ok(indexHtml.includes('/form_b/'));
    assert.ok(indexHtml.includes('2 forms'));

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── Data Columns Round-Trip ────────────────────────────────────

describe('Data columns JSON round-trip', () => {
  it('should survive HTML escaping for template formulas', () => {
    const match = HTML.match(/data-columns="([^"]*)"/);
    assert.ok(match, 'data-columns attribute not found');
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    const cols = JSON.parse(decoded);
    const fullNameCol = cols.find(c => c.name === 'full_name');
    assert.equal(fullNameCol.formula, '{first_name} {last_name}');
    assert.equal(fullNameCol.type, 'calculated');
  });

  it('should survive HTML escaping for expression formulas', () => {
    const match = HTML.match(/data-columns="([^"]*)"/);
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    const cols = JSON.parse(decoded);
    const handleCol = cols.find(c => c.name === 'handle');
    assert.equal(handleCol.formula, "='@' + email.split('@')[0]");
    assert.equal(handleCol.type, 'calculated');
  });
});
