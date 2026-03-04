// Regression tests for form navigation, auto-load, and list view edit links.
// These test the EXPECTED behavior — some may fail until Fenster's fixes land.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateFormHtml, generateListViewHtml } from '../src/eleventy-builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(PROJECT_ROOT, '_site');

// ─── Spec helpers ────────────────────────────────────────────────

const SPEAKER_SPEC = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, '_data', 'speaker_spec.json'), 'utf-8')
);

function makeSpec(overrides = {}) {
  return {
    title: overrides.title || 'Test Form',
    formName: overrides.formName || 'test_form',
    sections: overrides.sections || [
      {
        heading: 'Info',
        fields: [
          { type: 'text', label: 'Name', name: 'name' },
          { type: 'text', label: 'Email', name: 'email' },
        ],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════
// PART 1: HTML Generation Tests — generateFormHtml()
// ═══════════════════════════════════════════════════════════════════

describe('generateFormHtml — navigation buttons', () => {
  const html = generateFormHtml(SPEAKER_SPEC);

  it('should contain a Prev navigation button', () => {
    // Accept various labels: "Prev", "← Prev", "◀", etc.
    const hasPrev = html.includes('Prev') || html.includes('◀') || html.includes('record-prev');
    assert.ok(hasPrev, 'form HTML must contain a Prev navigation element');
  });

  it('should contain a Next navigation button', () => {
    const hasNext = html.includes('Next') || html.includes('▶') || html.includes('record-next');
    assert.ok(hasNext, 'form HTML must contain a Next navigation element');
  });

  it('should have a record navigation bar container', () => {
    assert.ok(html.includes('record-nav'), 'form HTML must contain a record-nav container');
  });

  it('should have a record counter display', () => {
    assert.ok(html.includes('record-counter'), 'form HTML must contain a record counter element');
  });

  it('should contain a New Record button', () => {
    assert.ok(
      html.includes('New Record') || html.includes('record-new'),
      'form HTML must contain a New Record button'
    );
  });
});

describe('generateFormHtml — records API reference', () => {
  const html = generateFormHtml(SPEAKER_SPEC);

  it('should reference /api/records/ for fetching the records list', () => {
    assert.ok(
      html.includes('/api/records/'),
      'form JavaScript must reference /api/records/ endpoint for record fetching'
    );
  });

  it('should contain a fetch call for loading records', () => {
    assert.ok(html.includes('fetch('), 'form JavaScript must use fetch() to load records');
  });

  it('should set FORM_NAME matching the spec', () => {
    assert.ok(
      html.includes("FORM_NAME = 'speaker'"),
      'form JavaScript must set FORM_NAME to the spec formName'
    );
  });
});

describe('generateFormHtml — URL ?id= parameter support', () => {
  const html = generateFormHtml(makeSpec({ formName: 'myform' }));

  it('should read the ?id= URL parameter', () => {
    assert.ok(
      html.includes("urlParams.get('id')") || html.includes('urlParams.get("id")'),
      'form JavaScript must read the id URL parameter'
    );
  });

  it('should use the id param to set SESSION_ID', () => {
    assert.ok(
      html.includes('loadId') || html.includes("get('id')"),
      'form JavaScript must use the id param for loading'
    );
  });

  it('should fetch from /api/load with formName and id', () => {
    assert.ok(
      html.includes('/api/load'),
      'form JavaScript must fetch from /api/load endpoint'
    );
  });
});

describe('generateFormHtml — auto-load first record on page open', () => {
  const html = generateFormHtml(makeSpec());

  it('should have auto-load logic that runs on page load', () => {
    // The form should call a function to load records automatically
    const hasAutoLoad =
      html.includes('loadRecords') ||
      html.includes('loadRecordsFromDb') ||
      html.includes('loadRecordsFromApi') ||
      html.includes('fetchRecordsList');
    assert.ok(hasAutoLoad, 'form must auto-load records on page open');
  });

  it('should display the first record when no ?id= is present', () => {
    // There should be logic like: if no loadId, fetch and display first record
    const hasFirstDisplay =
      html.includes('currentRecordIdx = 0') ||
      html.includes('displayRecord') ||
      html.includes('populateForm');
    assert.ok(hasFirstDisplay, 'form must auto-display the first available record');
  });

  it('should include a populateForm function', () => {
    assert.ok(
      html.includes('function populateForm') || html.includes('populateForm('),
      'form must have a populateForm function to fill in fields'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 2: HTML Generation Tests — generateListViewHtml()
// ═══════════════════════════════════════════════════════════════════

describe('generateListViewHtml — edit/view links in rows', () => {
  const spec = makeSpec({ formName: 'contact', title: 'Contact Form' });
  const html = generateListViewHtml(spec);

  it('should contain Edit link text in the row rendering', () => {
    const hasLink =
      html.includes("'✏️ Edit'") ||
      html.includes("Edit");
    assert.ok(hasLink, 'list view must render Edit links per row');
  });

  it('should build links pointing to the form URL with ?id= parameter', () => {
    // The link href should be like: /{formName}/?id={sessionId}
    assert.ok(
      html.includes("'/' + FORM_NAME + '/?id='") ||
      html.includes("'/" + spec.formName + "/?id='") ||
      html.includes('?id='),
      'list view links must include ?id= parameter pointing to the form'
    );
  });

  it('should reference /api/records/ for fetching data', () => {
    assert.ok(
      html.includes('/api/records/'),
      'list view must fetch from /api/records/ endpoint'
    );
  });

  it('should set FORM_NAME to the spec formName', () => {
    assert.ok(
      html.includes("FORM_NAME = 'contact'"),
      'list view must set FORM_NAME to contact'
    );
  });

  it('should have an Edit column header', () => {
    assert.ok(html.includes('Edit'), 'list view must have an Edit column');
  });
});

describe('generateListViewHtml — link construction uses correct URL pattern', () => {
  const spec = makeSpec({ formName: 'employee' });
  const html = generateListViewHtml(spec);

  it('should create <a> elements for each record', () => {
    assert.ok(
      html.includes("createElement('a')") || html.includes('createElement("a")'),
      'list view must create anchor elements for record links'
    );
  });

  it('should use sessionId in the link href', () => {
    assert.ok(
      html.includes('sessionId') || html.includes('rec.sessionId'),
      'list view links must use the record sessionId'
    );
  });

  it('should point links to /{formName}/ path', () => {
    assert.ok(
      html.includes("FORM_NAME + '/?id='") || html.includes('/employee/'),
      'list view links must point to the form path'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 3: E2E / Integration Tests (deploy-server)
// ═══════════════════════════════════════════════════════════════════

const PORT = 9000 + Math.floor(Math.random() * 1000);
let BASE_URL;
let serverProcess;

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

describe('E2E — Form navigation and record loading', () => {
  before(async () => {
    assert.ok(fs.existsSync(SITE_DIR), '_site/ directory must exist — run build first');
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
  });

  // ---- Form page contains navigation buttons ----

  describe('Speaker form page — navigation markup', () => {
    it('GET /speaker/ contains Prev button markup', async () => {
      const res = await fetch(BASE_URL + '/speaker/');
      assert.equal(res.status, 200);
      const html = await res.text();
      const hasPrev = html.includes('Prev') || html.includes('◀') || html.includes('record-prev');
      assert.ok(hasPrev, 'speaker form page must contain Prev navigation');
    });

    it('GET /speaker/ contains Next button markup', async () => {
      const res = await fetch(BASE_URL + '/speaker/');
      assert.equal(res.status, 200);
      const html = await res.text();
      const hasNext = html.includes('Next') || html.includes('▶') || html.includes('record-next');
      assert.ok(hasNext, 'speaker form page must contain Next navigation');
    });

    it('GET /speaker/ contains record navigation bar', async () => {
      const res = await fetch(BASE_URL + '/speaker/');
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('record-nav'), 'speaker form must have record-nav container');
    });
  });

  // ---- Records API ----

  describe('Records API — /api/records/speaker', () => {
    it('GET /api/records/speaker returns a valid records array', async () => {
      const res = await fetch(BASE_URL + '/api/records/speaker');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok, 'response must have ok: true');
      assert.ok(Array.isArray(body.records), 'records must be an array');
      assert.ok(body.records.length >= 1, 'must have at least one record');
    });

    it('each record has sessionId and data', async () => {
      const res = await fetch(BASE_URL + '/api/records/speaker');
      const body = await res.json();
      for (const rec of body.records) {
        assert.ok(rec.sessionId, 'record must have sessionId');
        assert.ok(rec.data, 'record must have data');
      }
    });
  });

  // ---- Load specific record by ID ----

  describe('Load specific record — /api/load', () => {
    it('GET /api/load?formName=speaker&id=abc12345 returns saved data', async () => {
      const res = await fetch(BASE_URL + '/api/load?formName=speaker&id=abc12345');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.ok, 'response must have ok: true');
      assert.ok(body.data, 'response must contain data object');
      assert.equal(body.data.full_name, 'Jane Smith');
    });

    it('GET /api/load with unknown ID returns 404', async () => {
      const res = await fetch(BASE_URL + '/api/load?formName=speaker&id=doesnotexist999');
      assert.equal(res.status, 404);
    });
  });

  // ---- List view page contains edit/view links ----

  describe('Speaker list page — edit links', () => {
    it('GET /speaker_list/ returns 200', async () => {
      const res = await fetch(BASE_URL + '/speaker_list/');
      assert.equal(res.status, 200);
    });

    it('GET /speaker_list/ contains View link text', async () => {
      const res = await fetch(BASE_URL + '/speaker_list/');
      const html = await res.text();
      assert.ok(
        html.includes('View') || html.includes('Edit'),
        'list page must have View or Edit link text'
      );
    });

    it('GET /speaker_list/ references /api/records/ for data loading', async () => {
      const res = await fetch(BASE_URL + '/speaker_list/');
      const html = await res.text();
      assert.ok(html.includes('/api/records/'), 'list page must reference /api/records/ endpoint');
    });

    it('GET /speaker_list/ builds links with ?id= parameter pattern', async () => {
      const res = await fetch(BASE_URL + '/speaker_list/');
      const html = await res.text();
      assert.ok(
        html.includes('?id='),
        'list page must build links with ?id= parameter for individual records'
      );
    });

    it('GET /speaker_list/ links point to /speaker/ form path', async () => {
      const res = await fetch(BASE_URL + '/speaker_list/');
      const html = await res.text();
      assert.ok(
        html.includes("/speaker/'") || html.includes('/speaker/'),
        'list page links must point to the speaker form'
      );
    });
  });
});
