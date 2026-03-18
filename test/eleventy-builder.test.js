import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateFormHtml, generateIndexPage } from '../src/eleventy-builder.js';

// ─── Minimal Spec Helpers ───────────────────────────────────────

function makeSpec(overrides = {}) {
  return {
    title: overrides.title || 'Test Form',
    formName: overrides.formName || 'test_form',
    sections: overrides.sections || [],
  };
}

function makeField(type, extra = {}) {
  return { type, label: `Test ${type}`, name: `test_${type}`, ...extra };
}

// ─── Minimal Spec ───────────────────────────────────────────────

describe('generateFormHtml — minimal spec', () => {
  it('should produce valid HTML with just a title and one text field', () => {
    const spec = makeSpec({
      sections: [{ heading: 'Info', fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('Test Form'));
    assert.ok(html.includes('id="test_text"'));
  });

  it('should handle spec with no sections', () => {
    const spec = makeSpec({ sections: [] });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('Test Form'));
    assert.ok(html.includes('id="main-form"'));
  });
});

// ─── Empty Sections ─────────────────────────────────────────────

describe('generateFormHtml — empty sections', () => {
  it('should render heading even with no fields', () => {
    const spec = makeSpec({
      sections: [{ heading: 'Empty Section', fields: [] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('Empty Section'));
  });

  it('should handle section without heading', () => {
    const spec = makeSpec({
      sections: [{ fields: [makeField('text')] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('id="test_text"'));
  });
});

// ─── HTML Escaping ──────────────────────────────────────────────

describe('generateFormHtml — HTML escaping', () => {
  it('should escape special characters in field labels', () => {
    const spec = makeSpec({
      sections: [{
        heading: 'Test',
        fields: [{ type: 'text', label: 'Name <script>alert(1)</script>', name: 'xss', placeholder: '' }],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>alert'));
  });

  it('should escape special characters in placeholder', () => {
    const spec = makeSpec({
      sections: [{
        fields: [{ type: 'text', label: 'Field', name: 'f', placeholder: 'a "quoted" & <tagged>' }],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('&quot;quoted&quot;'));
    assert.ok(html.includes('&amp;'));
    assert.ok(html.includes('&lt;tagged&gt;'));
  });

  it('should escape special characters in section headings', () => {
    const spec = makeSpec({
      sections: [{ heading: 'Q&A <section>', fields: [] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('Q&amp;A &lt;section&gt;'));
  });

  it('should escape dropdown option values', () => {
    const spec = makeSpec({
      sections: [{
        fields: [{
          type: 'dropdown', label: 'Pick', name: 'pick',
          options: ['Option "A"', 'Option <B>'],
        }],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('&quot;A&quot;'));
    assert.ok(html.includes('&lt;B&gt;'));
  });
});

// ─── Individual Field Types ─────────────────────────────────────

describe('generateFormHtml — individual field types', () => {
  it('should render text field', () => {
    const spec = makeSpec({
      sections: [{ fields: [makeField('text', { placeholder: 'Enter text', required: true })] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('type="text"'));
    assert.ok(html.includes('placeholder="Enter text"'));
    assert.match(html, /name="test_text"[^>]*required/);
  });

  it('should render textarea field with custom rows', () => {
    const spec = makeSpec({
      sections: [{ fields: [makeField('textarea', { rows: 6 })] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('<textarea'));
    assert.ok(html.includes('rows="6"'));
  });

  it('should render textarea field with default rows', () => {
    const spec = makeSpec({
      sections: [{ fields: [makeField('textarea')] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('rows="4"'));
  });

  it('should render password field with toggle', () => {
    const spec = makeSpec({
      sections: [{ fields: [makeField('password')] }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('type="password"'));
    assert.ok(html.includes('Toggle password visibility'));
    assert.ok(html.includes('👁'));
  });

  it('should render dropdown with options', () => {
    const spec = makeSpec({
      sections: [{
        fields: [makeField('dropdown', { options: ['Red', 'Blue', 'Green'] })],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('<select'));
    assert.ok(html.includes('Select...'));
    assert.ok(html.includes('<option value="Red">Red</option>'));
    assert.ok(html.includes('<option value="Blue">Blue</option>'));
    assert.ok(html.includes('<option value="Green">Green</option>'));
  });

  it('should render multi-option checkbox group', () => {
    const spec = makeSpec({
      sections: [{
        fields: [makeField('checkbox', { options: ['A', 'B'] })],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('type="checkbox"'));
    assert.ok(html.includes('value="A"'));
    assert.ok(html.includes('value="B"'));
    assert.ok(html.includes('<fieldset'));
  });

  it('should render single checkbox without options', () => {
    const spec = makeSpec({
      sections: [{
        fields: [makeField('checkbox', { options: undefined })],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('type="checkbox"'));
    assert.ok(html.includes('id="test_checkbox"'));
    // Single checkbox should not be in a fieldset
    assert.ok(html.includes('form-checkbox mb-3'));
  });

  it('should render radio buttons with first checked', () => {
    const spec = makeSpec({
      sections: [{
        fields: [makeField('radio', { options: ['X', 'Y', 'Z'] })],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('type="radio"'));
    assert.match(html, /value="X"[^>]*checked/);
    assert.ok(html.includes('value="Y"'));
    assert.ok(html.includes('value="Z"'));
  });

  it('should render button', () => {
    const spec = makeSpec({
      sections: [{
        fields: [makeField('button', { label: 'Click Me' })],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('Click Me'));
    assert.ok(html.includes('type="button"'));
  });

  it('should render submit-style button with primary class', () => {
    const spec = makeSpec({
      sections: [{
        fields: [{ type: 'button', label: 'Submit Form', name: 'submit' }],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('btn btn-primary'));
  });

  it('should render link with href', () => {
    const spec = makeSpec({
      sections: [{
        fields: [makeField('link', { label: 'Dashboard', href: '/dashboard/' })],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('href="/dashboard/?new=true"'));
    assert.ok(html.includes('Dashboard'));
    assert.ok(html.includes('class="Link"'));
  });

  it('should render unknown field type as comment', () => {
    const spec = makeSpec({
      sections: [{
        fields: [{ type: 'unknown_widget', label: 'X', name: 'x' }],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('<!-- Unknown field type: unknown_widget -->'));
  });

  it('should render table with columns and initial rows', () => {
    const spec = makeSpec({
      sections: [{
        fields: [{
          type: 'table', label: 'Items', name: 'items',
          columns: [
            { header: 'Name', name: 'name', type: 'text' },
            { header: 'Qty', name: 'qty', type: 'text' },
          ],
          initialRows: 2,
        }],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes('id="table_items"'));
    assert.ok(html.includes('<th class="p-2">Name</th>'));
    assert.ok(html.includes('<th class="p-2">Qty</th>'));
    assert.ok(html.includes('data-row-count="2"'));
    assert.ok(html.includes('+ Add Row'));
    assert.ok(html.includes('name="items_name_0"'));
    assert.ok(html.includes('name="items_name_1"'));
  });
});

// ─── Event Handlers ─────────────────────────────────────────────

describe('generateFormHtml — event handlers', () => {
  it('should wire event handlers in script block', () => {
    const spec = makeSpec({
      sections: [{
        fields: [{
          type: 'button', label: 'Go', name: 'go_btn',
          events: [{ event: 'click', description: 'Do stuff', handler: "alert('go')" }],
        }],
      }],
    });
    const html = generateFormHtml(spec);
    assert.ok(html.includes("getElementById('go_btn')"));
    assert.ok(html.includes("addEventListener('click'"));
    assert.ok(html.includes("alert('go')"));
  });
});

// ─── Index Page ─────────────────────────────────────────────────

describe('generateIndexPage — edge cases', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate index with empty forms list', () => {
    // Directory with no HTML files
    const emptyDir = path.join(tmpDir, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    generateIndexPage(emptyDir);

    const html = fs.readFileSync(path.join(emptyDir, 'index.html'), 'utf-8');
    assert.ok(html.includes('0 forms'));
    assert.ok(html.includes('adcgen'));
  });

  it('should generate index with multiple forms', () => {
    const multiDir = path.join(tmpDir, 'multi');
    fs.mkdirSync(multiDir, { recursive: true });
    fs.writeFileSync(path.join(multiDir, 'user_profile.html'), '<html></html>');
    fs.writeFileSync(path.join(multiDir, 'order_form.html'), '<html></html>');
    fs.writeFileSync(path.join(multiDir, 'feedback.html'), '<html></html>');

    generateIndexPage(multiDir);

    const html = fs.readFileSync(path.join(multiDir, 'index.html'), 'utf-8');
    assert.ok(html.includes('3 forms'));
    assert.ok(html.includes('User Profile'));
    assert.ok(html.includes('Order Form'));
    assert.ok(html.includes('Feedback'));
    assert.ok(html.includes('/user_profile/'));
    assert.ok(html.includes('/order_form/'));
    assert.ok(html.includes('/feedback/'));
  });

  it('should not include index.html in the form list', () => {
    const dir = path.join(tmpDir, 'withindex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'myform.html'), '<html></html>');

    generateIndexPage(dir);

    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.ok(html.includes('1 form'));
    assert.ok(html.includes('Myform'));
    // Should say "1 form" not "1 forms"
    assert.ok(!html.includes('1 forms'));
  });

  it('should use singular "form" for exactly 1 form', () => {
    const dir = path.join(tmpDir, 'singular');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'single.html'), '<html></html>');

    generateIndexPage(dir);

    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    // "${forms.length} form${forms.length !== 1 ? 's' : ''}"
    assert.ok(html.includes('1 form'));
    assert.ok(!html.includes('1 forms'));
  });
});
