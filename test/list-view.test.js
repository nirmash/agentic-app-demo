import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateListViewHtml, generateIndexPage } from '../src/eleventy-builder.js';

// Dynamic import for server (avoids top-level side effects)
let startDataServer;
before(async () => {
  ({ startDataServer } = await import('../src/server.js'));
});

// ─── Spec Helpers ───────────────────────────────────────────────

function makeSpec(overrides = {}) {
  return {
    title: overrides.title || 'Test Form',
    formName: overrides.formName || 'test_form',
    sections: overrides.sections || [],
  };
}

// ─── generateListViewHtml — HTML structure ──────────────────────

describe('generateListViewHtml — basic HTML structure', () => {
  const spec = makeSpec({
    title: 'Employee Registration',
    formName: 'employee_reg',
    sections: [
      {
        heading: 'Personal',
        fields: [
          { type: 'text', label: 'Full Name', name: 'full_name' },
          { type: 'text', label: 'Email', name: 'email' },
        ],
      },
    ],
  });
  const html = generateListViewHtml(spec);

  it('should generate valid HTML with doctype', () => {
    assert.ok(html.startsWith('<!DOCTYPE html>'));
  });

  it('should have dark mode attributes', () => {
    assert.ok(html.includes('data-color-mode="dark"'));
    assert.ok(html.includes('data-dark-theme="dark"'));
  });

  it('should include Primer CSS', () => {
    assert.ok(html.includes('@primer/css'));
  });

  it('should have a table element', () => {
    assert.ok(html.includes('<table'));
    assert.ok(html.includes('list-table'));
  });

  it('should include the form title in the heading', () => {
    assert.ok(html.includes('Employee Registration'));
    assert.ok(html.includes('Records'));
  });

  it('should have a "Back to forms" link', () => {
    assert.ok(html.includes('Back to forms'));
    assert.ok(html.includes('href="/"'));
  });

  it('should have a "New Record" link pointing to the form', () => {
    assert.ok(html.includes('href="/employee_reg/"'));
    assert.ok(html.includes('New Record'));
  });
});

// ─── generateListViewHtml — column headers ──────────────────────

describe('generateListViewHtml — column headers', () => {
  const spec = makeSpec({
    sections: [
      {
        heading: 'Info',
        fields: [
          { type: 'text', label: 'Full Name', name: 'full_name' },
          { type: 'dropdown', label: 'Country', name: 'country', options: ['US', 'UK'] },
          { type: 'checkbox', label: 'Active', name: 'active' },
          { type: 'radio', label: 'Gender', name: 'gender', options: ['M', 'F'] },
        ],
      },
      {
        heading: 'Table Section',
        fields: [
          {
            type: 'table', label: 'Items', name: 'items',
            columns: [{ header: 'Name', name: 'name', type: 'text' }],
          },
        ],
      },
      {
        heading: 'Actions',
        fields: [
          { type: 'button', label: 'Submit', name: 'submit_btn' },
          { type: 'link', label: 'Back', name: 'back_link', href: '/' },
        ],
      },
    ],
  });
  const html = generateListViewHtml(spec);

  it('should include scalar fields as column headers', () => {
    assert.ok(html.includes('<th class="p-2">Full Name</th>'));
    assert.ok(html.includes('<th class="p-2">Country</th>'));
    assert.ok(html.includes('<th class="p-2">Active</th>'));
    assert.ok(html.includes('<th class="p-2">Gender</th>'));
  });

  it('should NOT include table-type fields as columns', () => {
    // "Items" is a table-type field; should not appear as <th>
    assert.ok(!html.includes('<th class="p-2">Items</th>'));
  });

  it('should NOT include button fields as columns', () => {
    assert.ok(!html.includes('<th class="p-2">Submit</th>'));
  });

  it('should NOT include link fields as columns', () => {
    assert.ok(!html.includes('<th class="p-2">Back</th>'));
  });

  it('should have an Edit column header', () => {
    assert.ok(html.includes('<th class="p-2"'));
    assert.ok(html.includes('Edit'));
  });
});

// ─── generateListViewHtml — JavaScript fetch ────────────────────

describe('generateListViewHtml — JavaScript', () => {
  const spec = makeSpec({ formName: 'my_form' });
  const html = generateListViewHtml(spec);

  it('should include JavaScript that fetches from /api/records/', () => {
    assert.ok(html.includes('/api/records/'));
    assert.ok(html.includes('fetch('));
  });

  it('should reference the form name in the fetch URL', () => {
    assert.ok(html.includes("FORM_NAME = 'my_form'"));
  });

  it('should include an Edit link in the record rendering logic', () => {
    assert.ok(html.includes("'✏️ Edit'") || html.includes('"✏️ Edit"') || html.includes('Edit'));
  });
});

// ─── generateListViewHtml — edge cases ──────────────────────────

describe('generateListViewHtml — edge cases', () => {
  it('should handle specs with no sections', () => {
    const spec = makeSpec({ sections: [] });
    const html = generateListViewHtml(spec);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<table'));
    // Should still have the Edit column
    assert.ok(html.includes('Edit'));
  });

  it('should handle specs with only table-type fields (no scalar columns)', () => {
    const spec = makeSpec({
      sections: [{
        heading: 'Tables Only',
        fields: [
          { type: 'table', label: 'Items', name: 'items', columns: [] },
        ],
      }],
    });
    const html = generateListViewHtml(spec);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    // Edit column should still be there
    assert.ok(html.includes('Edit'));
    // No scalar <th> elements besides Edit
    const thMatches = html.match(/<th class="p-2"[^>]*>/g) || [];
    assert.equal(thMatches.length, 1, 'Only Edit column header expected');
  });

  it('should strip "Add/Edit" prefix from title', () => {
    const spec = makeSpec({ title: 'Add/Edit Employees' });
    const html = generateListViewHtml(spec);
    assert.ok(html.includes('Employees Records'));
    assert.ok(!html.includes('Add/Edit'));
  });

  it('should escape HTML in field labels', () => {
    const spec = makeSpec({
      sections: [{
        fields: [{ type: 'text', label: 'Name <script>xss</script>', name: 'xss_field' }],
      }],
    });
    const html = generateListViewHtml(spec);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>xss</script>'));
  });

  it('should fallback to formName when title is missing', () => {
    const spec = { formName: 'fallback_form', sections: [] };
    const html = generateListViewHtml(spec);
    assert.ok(html.includes('fallback_form'));
  });
});

// ─── GET /api/records/:formName — API endpoint ─────────────────

describe('GET /api/records/:formName', () => {
  let server;
  let tmpDir;
  let baseUrl;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-view-api-'));
    server = await startDataServer(tmpDir, 0);
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty records array when no data files exist', async () => {
    const res = await fetch(`${baseUrl}/api/records/nonexistent_form`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(body.records, []);
  });

  it('should return records when data files exist', async () => {
    const data = { full_name: 'Alice', email: 'alice@test.com' };
    fs.writeFileSync(
      path.join(tmpDir, 'contact_form_sess001.json'),
      JSON.stringify(data)
    );
    const res = await fetch(`${baseUrl}/api/records/contact_form`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.records.length, 1);
    assert.deepEqual(body.records[0].data, data);
  });

  it('should include sessionId in each record', async () => {
    const res = await fetch(`${baseUrl}/api/records/contact_form`);
    const body = await res.json();
    assert.equal(body.records[0].sessionId, 'sess001');
  });

  it('should exclude _spec.json files from results', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'contact_form_spec.json'),
      JSON.stringify({ title: 'spec' })
    );
    const res = await fetch(`${baseUrl}/api/records/contact_form`);
    const body = await res.json();
    // Should still be only 1 record (the data file), not 2
    assert.equal(body.records.length, 1);
  });

  it('should return multiple records sorted by filename', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'contact_form_sess002.json'),
      JSON.stringify({ full_name: 'Bob' })
    );
    const res = await fetch(`${baseUrl}/api/records/contact_form`);
    const body = await res.json();
    assert.equal(body.records.length, 2);
    assert.equal(body.records[0].sessionId, 'sess001');
    assert.equal(body.records[1].sessionId, 'sess002');
  });

  it('should parse JSON data correctly from saved files', async () => {
    const complexData = { name: 'Test', count: 42, nested: { a: 1 } };
    fs.writeFileSync(
      path.join(tmpDir, 'complex_form_s1.json'),
      JSON.stringify(complexData)
    );
    const res = await fetch(`${baseUrl}/api/records/complex_form`);
    const body = await res.json();
    assert.deepEqual(body.records[0].data, complexData);
  });

  it('should return empty records when data directory does not exist', async () => {
    // Start a server pointing to a non-existent directory
    const missingDir = path.join(os.tmpdir(), 'does-not-exist-' + Date.now());
    const srv2 = await startDataServer(missingDir, 0);
    const addr2 = srv2.address();
    try {
      const res = await fetch(`http://127.0.0.1:${addr2.port}/api/records/anyform`);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.deepEqual(body.records, []);
    } finally {
      srv2.close();
    }
  });

  it('should include submittedAt from _meta if present', async () => {
    const dataWithMeta = { full_name: 'Carol', _meta: { submittedAt: '2024-01-15T10:00:00Z' } };
    fs.writeFileSync(
      path.join(tmpDir, 'meta_form_s1.json'),
      JSON.stringify(dataWithMeta)
    );
    const res = await fetch(`${baseUrl}/api/records/meta_form`);
    const body = await res.json();
    assert.equal(body.records[0].submittedAt, '2024-01-15T10:00:00Z');
  });

  it('should return null submittedAt when _meta is absent', async () => {
    const res = await fetch(`${baseUrl}/api/records/contact_form`);
    const body = await res.json();
    assert.equal(body.records[0].submittedAt, null);
  });
});

// ─── Index page — list view links ───────────────────────────────

describe('generateIndexPage — list view links', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-list-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should include list view badge when _list.html exists', () => {
    const dir = path.join(tmpDir, 'with-list');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'employee.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'employee_list.html'), '<html></html>');

    generateIndexPage(dir);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.ok(html.includes('Records'));
    assert.ok(html.includes('/employee_list/'));
  });

  it('should NOT include list view badge when _list.html does not exist', () => {
    const dir = path.join(tmpDir, 'no-list');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'contact.html'), '<html></html>');

    generateIndexPage(dir);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.ok(html.includes('Contact'));
    assert.ok(!html.includes('/contact_list/'));
  });

  it('should not count _list.html files as forms', () => {
    const dir = path.join(tmpDir, 'list-count');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'myform.html'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'myform_list.html'), '<html></html>');

    generateIndexPage(dir);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    // Should say "1 form" — _list.html should not be counted
    assert.ok(html.includes('1 form'));
    assert.ok(!html.includes('2 form'));
  });
});
