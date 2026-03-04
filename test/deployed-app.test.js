// Integration tests for the deployed app (deploy-server.js serving static + API).
// Starts the production server on a random port, runs HTTP tests, then shuts down.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, '_data');
const SITE_DIR = path.join(PROJECT_ROOT, '_site');

const PORT = 9000 + Math.floor(Math.random() * 1000);
let BASE_URL;
let serverProcess;
const testCreatedFiles = [];

async function waitForServer(url, retries = 40, delay = 250) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error(`Server did not start at ${url}`);
}

describe('Deployed App Integration', () => {
  before(async () => {
    assert.ok(fs.existsSync(SITE_DIR), '_site/ directory must exist');
    BASE_URL = `http://127.0.0.1:${PORT}`;
    serverProcess = spawn('node', ['bin/deploy-server.js', '--port', String(PORT)], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: '' },
    });
    serverProcess.stderr.on('data', () => {});
    serverProcess.stdout.on('data', () => {});
    await waitForServer(BASE_URL);
  });

  after(() => {
    if (serverProcess) serverProcess.kill();
    // Clean up test-created data files
    for (const f of testCreatedFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  // ---- 1. Static site serving ----

  describe('Static site serving', () => {
    it('GET / returns 200 with index page linking to forms', async () => {
      const res = await fetch(BASE_URL + '/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('adcgen'), 'index should mention adcgen');
      assert.ok(html.includes('/speaker/'), 'index links to speaker');
      assert.ok(html.includes('/attendee/'), 'index links to attendee');
      assert.ok(html.includes('/session/'), 'index links to session');
    });

    it('GET /speaker/ returns 200 with form HTML', async () => {
      const res = await fetch(BASE_URL + '/speaker/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Speaker Registration'));
    });

    it('GET /attendee/ returns 200 with form HTML', async () => {
      const res = await fetch(BASE_URL + '/attendee/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Attendee'));
    });

    it('GET /session/ returns 200 with form HTML', async () => {
      const res = await fetch(BASE_URL + '/session/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Session'));
    });

    it('GET /speaker_list/ returns 200 with list view table', async () => {
      const res = await fetch(BASE_URL + '/speaker_list/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Records'));
      assert.ok(html.includes('table') || html.includes('list-table'));
    });

    it('GET /attendee_list/ returns 200 with list view table', async () => {
      const res = await fetch(BASE_URL + '/attendee_list/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Records'));
    });

    it('GET /session_list/ returns 200 with list view table', async () => {
      const res = await fetch(BASE_URL + '/session_list/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Records'));
    });

    it('GET /nonexistent returns 404', async () => {
      const res = await fetch(BASE_URL + '/nonexistent');
      assert.equal(res.status, 404);
    });
  });

  // ---- 2. Data API — Records listing ----

  describe('Data API — Records listing', () => {
    it('GET /api/records/speaker returns array with 3 records', async () => {
      const res = await fetch(BASE_URL + '/api/records/speaker');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.equal(body.records.length, 3);
    });

    it('GET /api/records/attendee returns array with 3 records', async () => {
      const res = await fetch(BASE_URL + '/api/records/attendee');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.equal(body.records.length, 3);
    });

    it('GET /api/records/session returns array with 3 records', async () => {
      const res = await fetch(BASE_URL + '/api/records/session');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.equal(body.records.length, 3);
    });

    it('GET /api/records/nonexistent returns empty array', async () => {
      const res = await fetch(BASE_URL + '/api/records/nonexistent');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.equal(body.records.length, 0);
    });

    it('each record has sessionId and data properties', async () => {
      const res = await fetch(BASE_URL + '/api/records/speaker');
      const body = await res.json();
      for (const rec of body.records) {
        assert.ok(rec.sessionId, 'record should have sessionId');
        assert.ok(rec.data, 'record should have data');
      }
    });
  });

  // ---- 3. Data API — Load specific record ----

  describe('Data API — Load specific record', () => {
    it('GET /api/load?formName=speaker&id=abc12345 returns saved data', async () => {
      const res = await fetch(BASE_URL + '/api/load?formName=speaker&id=abc12345');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.equal(body.data.full_name, 'Jane Smith');
      assert.equal(body.data.email, 'jane.smith@techconf.io');
    });

    it('GET /api/load?formName=attendee&id=jkl22222 returns saved data', async () => {
      const res = await fetch(BASE_URL + '/api/load?formName=attendee&id=jkl22222');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.equal(body.data.first_name, 'Alice');
      assert.equal(body.data.last_name, 'Johnson');
    });

    it('GET /api/load with missing params returns 400', async () => {
      const res = await fetch(BASE_URL + '/api/load');
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error);
    });

    it('GET /api/load with non-existent id returns 404', async () => {
      const res = await fetch(BASE_URL + '/api/load?formName=speaker&id=doesnotexist999');
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.ok(body.error);
    });
  });

  // ---- 4. Data API — Save ----

  describe('Data API — Save', () => {
    const testSessionId = `testrun_${Date.now()}`;

    it('POST /api/save with valid data creates a file and returns ok', async () => {
      const payload = {
        formName: 'speaker',
        sessionId: testSessionId,
        data: { full_name: 'Test User', email: 'test@example.com' },
      };
      const res = await fetch(BASE_URL + '/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.ok(body.file.includes(testSessionId));
      // Track for cleanup
      testCreatedFiles.push(path.join(DATA_DIR, body.file));
    });

    it('POST /api/save with missing data returns 400', async () => {
      const res = await fetch(BASE_URL + '/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formName: 'speaker' }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error);
    });

    it('saved data can be loaded back via GET /api/load', async () => {
      const res = await fetch(BASE_URL + `/api/load?formName=speaker&id=${testSessionId}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok);
      assert.equal(body.data.full_name, 'Test User');
      assert.equal(body.data.email, 'test@example.com');
    });
  });

  // ---- 5. Form content validation ----

  describe('Form content validation', () => {
    it('Speaker form contains expected field types', async () => {
      const res = await fetch(BASE_URL + '/speaker/');
      const html = await res.text();
      assert.ok(html.includes('type="text"'), 'has text input');
      assert.ok(html.includes('<textarea'), 'has textarea');
      assert.ok(html.includes('type="password"'), 'has password');
      assert.ok(html.includes('<select'), 'has dropdown (select)');
      assert.ok(html.includes('type="checkbox"'), 'has checkbox');
      assert.ok(html.includes('type="radio"'), 'has radio');
      assert.ok(html.includes('previous_talks') || html.includes('Previous Talks'), 'has table');
    });

    it('Attendee form contains table with calculated column', async () => {
      const res = await fetch(BASE_URL + '/attendee/');
      const html = await res.text();
      assert.ok(html.includes('sessions_to_attend') || html.includes('Sessions to Attend'), 'has sessions table');
      assert.ok(html.includes('Full Name') || html.includes('full_name'), 'has calculated column');
    });

    it('Session form contains expected dropdowns and radio buttons', async () => {
      const res = await fetch(BASE_URL + '/session/');
      const html = await res.text();
      assert.ok(html.includes('<select'), 'has dropdown');
      assert.ok(html.includes('type="radio"'), 'has radio');
      assert.ok(html.includes('Main Hall') || html.includes('Room A'), 'has room options');
      assert.ok(html.includes('Keynote') || html.includes('Workshop'), 'has session type options');
    });

    it('all forms have the main-form id', async () => {
      for (const form of ['speaker', 'attendee', 'session']) {
        const res = await fetch(BASE_URL + `/${form}/`);
        const html = await res.text();
        assert.ok(html.includes('id="main-form"'), `${form} should have main-form id`);
      }
    });

    it('all forms have dark mode attributes', async () => {
      for (const form of ['speaker', 'attendee', 'session']) {
        const res = await fetch(BASE_URL + `/${form}/`);
        const html = await res.text();
        assert.ok(html.includes('data-color-mode="dark"'), `${form} should have dark mode`);
        assert.ok(html.includes('data-dark-theme="dark"'), `${form} should have dark theme`);
      }
    });

    it('all forms have Primer CSS', async () => {
      for (const form of ['speaker', 'attendee', 'session']) {
        const res = await fetch(BASE_URL + `/${form}/`);
        const html = await res.text();
        assert.ok(html.includes('primer.css') || html.includes('@primer/css'), `${form} should have Primer CSS`);
      }
    });
  });

  // ---- 6. List view content validation ----

  describe('List view content validation', () => {
    it('speaker list view fetches from /api/records/ with FORM_NAME', async () => {
      const res = await fetch(BASE_URL + '/speaker_list/');
      const html = await res.text();
      assert.ok(html.includes('/api/records/'), 'should reference records API path');
      assert.ok(html.includes("FORM_NAME = 'speaker'"), 'should set FORM_NAME to speaker');
    });

    it('list views have table elements', async () => {
      for (const form of ['speaker_list', 'attendee_list', 'session_list']) {
        const res = await fetch(BASE_URL + `/${form}/`);
        const html = await res.text();
        assert.ok(html.includes('<table') || html.includes('list-table'), `${form} should have table`);
      }
    });

    it('list views have "View" links pointing to individual forms', async () => {
      // The list views dynamically create View links via JS; check the script references the form path
      const res = await fetch(BASE_URL + '/speaker_list/');
      const html = await res.text();
      assert.ok(html.includes('View') || html.includes('/speaker/'), 'should have View link or form path');
    });
  });

  // ---- 7. Cross-form links ----

  describe('Cross-form links', () => {
    it('Speaker form has a link to attendee', async () => {
      const res = await fetch(BASE_URL + '/speaker/');
      const html = await res.text();
      assert.ok(html.includes('/attendee/'), 'speaker should link to attendee');
    });

    it('Attendee form has a link to speaker', async () => {
      const res = await fetch(BASE_URL + '/attendee/');
      const html = await res.text();
      assert.ok(html.includes('/speaker/'), 'attendee should link to speaker');
    });

    it('Session form has a link to speaker', async () => {
      const res = await fetch(BASE_URL + '/session/');
      const html = await res.text();
      assert.ok(html.includes('/speaker/'), 'session should link to speaker');
    });
  });
});
