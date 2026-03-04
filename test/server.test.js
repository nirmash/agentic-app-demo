import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Dynamic import to avoid top-level side effects
let startDataServer;

before(async () => {
  ({ startDataServer } = await import('../src/server.js'));
});

describe('Data server — POST /api/save', () => {
  let server;
  let tmpDir;
  let baseUrl;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-test-'));
    // Use port 0 to get a random available port
    server = await startDataServer(tmpDir, 0);
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should save valid data and return ok', async () => {
    const res = await fetch(`${baseUrl}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formName: 'test_form',
        sessionId: 'abc123',
        data: { name: 'Alice' },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.file.startsWith('test_form_'));

    // Verify file was written
    const filePath = path.join(tmpDir, body.file);
    assert.ok(fs.existsSync(filePath));
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.deepEqual(saved, { name: 'Alice' });
  });

  it('should auto-generate formName and sessionId when missing', async () => {
    const res = await fetch(`${baseUrl}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { x: 1 } }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.file.startsWith('form_'));
  });

  it('should return 400 when data is missing', async () => {
    const res = await fetch(`${baseUrl}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formName: 'no_data' }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.ok(body.error);
  });
});

describe('Data server — GET /api/load', () => {
  let server;
  let tmpDir;
  let baseUrl;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-load-'));
    // Pre-populate a file
    fs.writeFileSync(
      path.join(tmpDir, 'myform_sess1.json'),
      JSON.stringify({ val: 42 })
    );
    server = await startDataServer(tmpDir, 0);
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should load existing data', async () => {
    const res = await fetch(`${baseUrl}/api/load?formName=myform&id=sess1`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(body.data, { val: 42 });
  });

  it('should return 400 when formName is missing', async () => {
    const res = await fetch(`${baseUrl}/api/load?id=sess1`);
    assert.equal(res.status, 400);
  });

  it('should return 400 when id is missing', async () => {
    const res = await fetch(`${baseUrl}/api/load?formName=myform`);
    assert.equal(res.status, 400);
  });

  it('should return 404 for non-existent file', async () => {
    const res = await fetch(`${baseUrl}/api/load?formName=myform&id=doesnotexist`);
    assert.equal(res.status, 404);
  });
});

describe('Data server — CORS', () => {
  let server;
  let tmpDir;
  let baseUrl;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-cors-'));
    server = await startDataServer(tmpDir, 0);
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should include Access-Control-Allow-Origin header', async () => {
    const res = await fetch(`${baseUrl}/api/load?formName=x&id=y`);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  it('should respond 200 to OPTIONS preflight', async () => {
    const res = await fetch(`${baseUrl}/api/save`, { method: 'OPTIONS' });
    assert.equal(res.status, 200);
  });
});
