import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

/*
 * auth.js reads CONFIG_DIR from process.env.HOME at module-load time.
 * We override HOME to a temp dir so tests never touch the real config.
 * Each test group gets a fresh temp HOME.
 */

describe('auth — getToken()', () => {
  let tmpHome;
  let originalHome;
  let originalToken;

  before(() => {
    originalHome = process.env.HOME;
    originalToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
  });

  after(() => {
    process.env.HOME = originalHome;
    if (originalToken !== undefined) {
      process.env.GITHUB_TOKEN = originalToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
    process.env.HOME = tmpHome;
  });

  it('should return null when no config file exists', async () => {
    // Fresh import each time to pick up new HOME
    const { getToken } = await import(`../src/auth.js?t=${Date.now()}-1`);
    // No config dir or file exists
    assert.equal(getToken(), null);
  });

  it('should read token from config file', async () => {
    const configDir = path.join(tmpHome, '.adcgen');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ github_token: 'ghp_testtoken123' })
    );
    const { getToken } = await import(`../src/auth.js?t=${Date.now()}-2`);
    assert.equal(getToken(), 'ghp_testtoken123');
  });

  it('should prefer GITHUB_TOKEN env var over config file', async () => {
    const configDir = path.join(tmpHome, '.adcgen');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ github_token: 'from_file' })
    );
    process.env.GITHUB_TOKEN = 'from_env';
    const { getToken } = await import(`../src/auth.js?t=${Date.now()}-3`);
    assert.equal(getToken(), 'from_env');
    delete process.env.GITHUB_TOKEN;
  });

  it('should return null when config file has invalid JSON', async () => {
    const configDir = path.join(tmpHome, '.adcgen');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), 'NOT JSON');
    const { getToken } = await import(`../src/auth.js?t=${Date.now()}-4`);
    assert.equal(getToken(), null);
  });
});

describe('auth — saveToken()', () => {
  let tmpHome;
  let originalHome;

  before(() => {
    originalHome = process.env.HOME;
  });

  after(() => {
    process.env.HOME = originalHome;
  });

  it('should create config dir and write token', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-save-'));
    process.env.HOME = tmpHome;
    const { saveToken } = await import(`../src/auth.js?t=${Date.now()}-5`);

    saveToken('ghp_newtoken');

    const configPath = path.join(tmpHome, '.adcgen', 'config.json');
    assert.ok(fs.existsSync(configPath));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.github_token, 'ghp_newtoken');
  });

  it('should update existing config without losing other keys', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-update-'));
    process.env.HOME = tmpHome;
    const configDir = path.join(tmpHome, '.adcgen');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ github_token: 'old', other_key: 'keep' })
    );
    const { saveToken } = await import(`../src/auth.js?t=${Date.now()}-6`);

    saveToken('ghp_updated');

    const config = JSON.parse(
      fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8')
    );
    assert.equal(config.github_token, 'ghp_updated');
    assert.equal(config.other_key, 'keep');
  });
});

describe('auth — logout()', () => {
  let tmpHome;
  let originalHome;

  before(() => {
    originalHome = process.env.HOME;
  });

  after(() => {
    process.env.HOME = originalHome;
  });

  it('should remove config file when it exists', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-logout-'));
    process.env.HOME = tmpHome;
    const configDir = path.join(tmpHome, '.adcgen');
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ github_token: 'tok' }));
    const { logout } = await import(`../src/auth.js?t=${Date.now()}-7`);

    logout();

    assert.ok(!fs.existsSync(configPath));
  });

  it('should not throw when config file does not exist', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-logout2-'));
    process.env.HOME = tmpHome;
    const { logout } = await import(`../src/auth.js?t=${Date.now()}-8`);

    assert.doesNotThrow(() => logout());
  });
});
