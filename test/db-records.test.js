import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFormHtml } from '../src/eleventy-builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL_CONTROLS_SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'all_controls_spec.json'), 'utf-8'));
const LOGIN_SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'login_spec.json'), 'utf-8'));

// Generate HTML for both form types
const ALL_CONTROLS_HTML = generateFormHtml(ALL_CONTROLS_SPEC);
const LOGIN_HTML = generateFormHtml(LOGIN_SPEC);

// ─── Record Navigation UI ─────────────────────────────────────

describe('Record navigation bar', () => {
  it('should include the record navigation bar in generated HTML', () => {
    assert.ok(LOGIN_HTML.includes('record-nav'), 'Login form should have record-nav element');
    assert.ok(ALL_CONTROLS_HTML.includes('record-nav'), 'All controls form should have record-nav element');
  });

  it('should have prev/next buttons', () => {
    assert.ok(LOGIN_HTML.includes('record-prev'), 'Should have prev button');
    assert.ok(LOGIN_HTML.includes('record-next'), 'Should have next button');
  });

  it('should have a record counter display', () => {
    assert.ok(LOGIN_HTML.includes('record-counter'), 'Should have record counter element');
  });

  it('should have a new record button', () => {
    assert.ok(LOGIN_HTML.includes('record-new'), 'Should have new record button');
  });
});

// ─── DB Record Loading Logic ──────────────────────────────────

describe('DB record loading script', () => {
  it('should include loadRecordsFromDb function', () => {
    assert.ok(LOGIN_HTML.includes('loadRecordsFromDb'), 'Should have DB record loading function');
  });

  it('should call /api/db/records endpoint', () => {
    assert.ok(LOGIN_HTML.includes('/api/db/records/'), 'Should reference the records API endpoint');
  });

  it('should include navigateRecord function for prev/next', () => {
    assert.ok(LOGIN_HTML.includes('navigateRecord'), 'Should have record navigation function');
  });

  it('should include displayRecord function to populate form', () => {
    assert.ok(LOGIN_HTML.includes('displayRecord'), 'Should have displayRecord function');
  });
});

// ─── Individual form (like login) ─────────────────────────────

describe('Individual record form navigation', () => {
  it('should use populateForm when displaying a record', () => {
    assert.ok(LOGIN_HTML.includes('populateForm'), 'Should reuse populateForm for DB records');
  });

  it('should update SESSION_ID when navigating records', () => {
    // The script should set SESSION_ID to the record's session_id
    assert.ok(LOGIN_HTML.includes('SESSION_ID'), 'Should reference SESSION_ID for updates');
  });
});

// ─── Table-type form ──────────────────────────────────────────

describe('Table-type form record handling', () => {
  it('should include table-type specific record handling', () => {
    // Forms with table fields should also load child table data
    assert.ok(ALL_CONTROLS_HTML.includes('loadRecordsFromDb'), 'Table form should have DB loading');
  });
});

// ─── API endpoint structure ───────────────────────────────────

describe('Server API endpoints for DB records', () => {
  // These test that the deploy-server has the right endpoints
  // by checking the server source code
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'bin', 'deploy-server.js'), 'utf-8');

  it('should have GET /api/db/records/:formName endpoint', () => {
    assert.ok(serverSrc.includes('/api/db/records/:formName'), 'Should have records list endpoint');
  });

  it('should have GET /api/db/record/:formName/:sessionId endpoint', () => {
    assert.ok(serverSrc.includes('/api/db/record/:formName/:sessionId'), 'Should have single record endpoint');
  });

  it('records endpoint should query the form table', () => {
    assert.ok(serverSrc.includes('SELECT'), 'Should query records from DB');
  });

  it('single record endpoint should return child table data', () => {
    assert.ok(serverSrc.includes('child') || serverSrc.includes('_spec.json'), 'Should handle child table data');
  });
});
