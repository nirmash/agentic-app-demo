import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';

describe('db-sync — resolveSpecPath()', () => {
  let resolveSpecPath;

  before(async () => {
    ({ resolveSpecPath } = await import('../src/db-sync.js'));
  });

  it('should build correct path from dataDir and formName', () => {
    const result = resolveSpecPath('/data/submissions', 'user_registration');
    assert.equal(result, path.join('/data/submissions', 'user_registration_spec.json'));
  });

  it('should handle dataDir with trailing slash', () => {
    const result = resolveSpecPath('/data/', 'invoice');
    // path.join normalises the trailing slash
    assert.equal(result, path.join('/data', 'invoice_spec.json'));
  });

  it('should handle simple formName', () => {
    const result = resolveSpecPath('.', 'form');
    assert.equal(result, path.join('.', 'form_spec.json'));
  });
});

describe('db-sync — syncToDb() without DATABASE_URL', () => {
  let syncToDb;
  let originalDbUrl;

  before(async () => {
    originalDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    ({ syncToDb } = await import('../src/db-sync.js'));
  });

  after(() => {
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    }
  });

  it('should return early (undefined) when DATABASE_URL is not set', async () => {
    const result = await syncToDb('test_form', { name: 'Alice' }, '/fake/path.json');
    assert.equal(result, undefined);
  });
});

describe('db-sync — dropFormTables() without DATABASE_URL', () => {
  let dropFormTables;
  let originalDbUrl;

  before(async () => {
    originalDbUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    ({ dropFormTables } = await import('../src/db-sync.js'));
  });

  after(() => {
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    }
  });

  it('should return early (undefined) when DATABASE_URL is not set', async () => {
    const result = await dropFormTables('test_form', '/fake/spec.json');
    assert.equal(result, undefined);
  });
});
