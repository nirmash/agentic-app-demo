import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

/*
 * auth.js resolves CONFIG_DIR from process.env.HOME at module-load time.
 * We set HOME to a clean temp dir *before* importing generator (which imports auth)
 * so getToken() finds no config and returns null when GITHUB_TOKEN is also unset.
 */
const originalHome = process.env.HOME;
const originalToken = process.env.GITHUB_TOKEN;
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-test-'));
process.env.HOME = tmpHome;
delete process.env.GITHUB_TOKEN;

// Now import generator — its auth.js will see the empty HOME
const { generateFormSpec, editFormSpec, editFormHtml } = await import('../src/generator.js');

// Restore HOME immediately so other modules are unaffected
process.env.HOME = originalHome;
if (originalToken !== undefined) {
  process.env.GITHUB_TOKEN = originalToken;
}

describe('Generator module exports', () => {
  it('should export generateFormSpec function', () => {
    assert.equal(typeof generateFormSpec, 'function');
  });

  it('should export editFormSpec function', () => {
    assert.equal(typeof editFormSpec, 'function');
  });

  it('should export editFormHtml function', () => {
    assert.equal(typeof editFormHtml, 'function');
  });
});

describe('Generator — generateFormSpec without auth', () => {
  it('should throw when not authenticated', async () => {
    // Temporarily clear GITHUB_TOKEN so getToken() must rely on (empty) config
    const saved = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      await assert.rejects(
        () => generateFormSpec('make a form'),
        (err) => {
          assert.ok(err.message.includes('Not authenticated'));
          return true;
        }
      );
    } finally {
      if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
    }
  });
});

describe('Generator — editFormSpec without auth', () => {
  it('should throw when not authenticated', async () => {
    const saved = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      await assert.rejects(
        () => editFormSpec({}, 'change something'),
        (err) => {
          assert.ok(err.message.includes('Not authenticated'));
          return true;
        }
      );
    } finally {
      if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
    }
  });
});

describe('Generator — editFormHtml without auth', () => {
  it('should throw when not authenticated', async () => {
    const saved = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      await assert.rejects(
        () => editFormHtml('<html></html>', 'add a button'),
        (err) => {
          assert.ok(err.message.includes('Not authenticated'));
          return true;
        }
      );
    } finally {
      if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
    }
  });
});
