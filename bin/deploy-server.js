#!/usr/bin/env node
// Combined static + API server for production deployment (single port).
// Usage: node bin/deploy-server.js [--port 80]

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { execFile, execFileSync } from 'child_process';
import { syncToDb, resolveSpecPath } from '../src/db-sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT, '_site');
const DATA_DIR = path.join(ROOT, '_data');

const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '80', 10);

const app = express();
app.use(express.json());

// API: save form data
app.post('/api/save', (req, res) => {
  const { formName, sessionId, data } = req.body;
  if (!data) return res.status(400).json({ error: 'No data provided' });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const fileName = `${formName || 'form'}_${sessionId || uuidv4().split('-')[0]}.json`;
  fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2));
  console.log(`  💾 Saved: ${fileName}`);

  // Sync to Postgres if DATABASE_URL is set
  const specPath = resolveSpecPath(DATA_DIR, formName);
  if (formName && fs.existsSync(specPath)) {
    syncToDb(formName, data, specPath).catch(err =>
      console.error(`  ⚠️  DB sync failed: ${err.message}`)
    );
  }

  res.json({ ok: true, file: fileName });
});

// API: load form data
app.get('/api/load', (req, res) => {
  const { formName, id } = req.query;
  if (!formName || !id) return res.status(400).json({ error: 'formName and id required' });
  const filePath = path.join(DATA_DIR, `${formName}_${id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  try {
    res.json({ ok: true, data: JSON.parse(fs.readFileSync(filePath, 'utf-8')) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// API: database explorer
if (process.env.DATABASE_URL) {
  const { pool } = await import('../src/db.js');

  app.get('/api/db/tables', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      );
      res.json({ ok: true, tables: result.rows.map(r => r.tablename) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/db/describe/:table', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [req.params.table]
      );
      res.json({ ok: true, columns: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/db/query', async (req, res) => {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'No sql provided' });
    try {
      const result = await pool.query(sql);
      res.json({ ok: true, rows: result.rows, rowCount: result.rowCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all records for a form (ordered by submitted_at desc)
  app.get('/api/db/records/:formName', async (req, res) => {
    const { formName } = req.params;
    try {
      // Check if table exists
      const tableCheck = await pool.query(
        `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`, [formName]
      );
      if (tableCheck.rows.length === 0) return res.json({ ok: true, records: [] });

      const result = await pool.query(
        `SELECT * FROM "${formName}" ORDER BY submitted_at DESC`
      );
      res.json({ ok: true, records: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get a single record with child table data
  app.get('/api/db/record/:formName/:sessionId', async (req, res) => {
    const { formName, sessionId } = req.params;
    try {
      const main = await pool.query(
        `SELECT * FROM "${formName}" WHERE session_id = $1`, [sessionId]
      );
      if (main.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const record = main.rows[0];

      // Load child table data from spec
      const specPath = path.join(DATA_DIR, `${formName}_spec.json`);
      if (fs.existsSync(specPath)) {
        const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
        for (const section of spec.sections || []) {
          for (const field of section.fields || []) {
            if (field.type === 'table' && field.name) {
              const suffix = field.name.startsWith(formName + '_') ? field.name.slice(formName.length + 1) : field.name;
              const childTable = `${formName}_${suffix}`;
              try {
                const childRows = await pool.query(
                  `SELECT * FROM "${childTable}" WHERE session_id = $1 ORDER BY row_index`, [sessionId]
                );
                record[field.name] = childRows.rows;
              } catch {}
            }
          }
        }
      }

      res.json({ ok: true, record });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// API: adcgen auth — login via gh CLI token (no external API call needed)
const ADCGEN_CONFIG_DIR = path.join(process.env.HOME || '/root', '.adcgen');
const ADCGEN_CONFIG = path.join(ADCGEN_CONFIG_DIR, 'config.json');

function readAdcgenConfig() {
  try { return JSON.parse(fs.readFileSync(ADCGEN_CONFIG, 'utf-8')); } catch { return {}; }
}

app.get('/api/cli/auth-status', (req, res) => {
  const config = readAdcgenConfig();
  if (config.github_token) {
    return res.json({ ok: true, loggedIn: true, user: config.github_user || 'authenticated' });
  }
  // Check if gh CLI has a token
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8', timeout: 5000 }).trim();
    if (token && token.length > 10) {
      return res.json({ ok: true, loggedIn: false, ghCliAvailable: true });
    }
  } catch {}
  res.json({ ok: true, loggedIn: false, ghCliAvailable: false });
});

app.post('/api/cli/login', async (req, res) => {
  const { token: manualToken } = req.body || {};
  let token = manualToken;

  // If no manual token, try gh CLI
  if (!token) {
    try {
      token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8', timeout: 5000 }).trim();
    } catch {}
  }

  if (!token || token.length < 10) {
    return res.json({ ok: false, error: 'No token available. Paste a GitHub personal access token.' });
  }

  // Save the token without calling external GitHub API (avoids proxy issues on Embr)
  fs.mkdirSync(ADCGEN_CONFIG_DIR, { recursive: true });
  const config = readAdcgenConfig();
  config.github_token = token;

  // Try to get username from gh CLI (local, no network)
  try {
    const user = execFileSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf-8', timeout: 5000 }).trim();
    if (user) config.github_user = user;
  } catch {}

  fs.writeFileSync(ADCGEN_CONFIG, JSON.stringify(config, null, 2));
  res.json({ ok: true, user: config.github_user || 'authenticated' });
});

app.post('/api/cli/logout', (req, res) => {
  try { fs.unlinkSync(ADCGEN_CONFIG); } catch {}
  res.json({ ok: true });
});

// API: save generated/edited form spec (LLM call happens browser-side)
app.post('/api/cli/save-form', async (req, res) => {
  const { spec } = req.body;
  if (!spec || !spec.formName) return res.status(400).json({ error: 'Invalid spec' });

  try {
    const { buildEleventySite } = await import('../src/eleventy-builder.js');
    const { siteDir, fileName, dataDir } = buildEleventySite(spec, ROOT);

    // Also copy to _site (production static dir) by running eleventy
    try {
      execFileSync('npx', ['@11ty/eleventy'], { cwd: ROOT, timeout: 30000, encoding: 'utf-8' });
    } catch {
      // If eleventy fails, manually copy the file
      const srcFile = path.join(ROOT, '_site_src', fileName);
      const destFile = path.join(SITE_DIR, fileName);
      if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, destFile);
      // Copy index too
      const srcIdx = path.join(ROOT, '_site_src', 'index.html');
      const destIdx = path.join(SITE_DIR, 'index.html');
      if (fs.existsSync(srcIdx)) fs.copyFileSync(srcIdx, destIdx);
    }

    // Sync to DB if available
    const specPath = path.join(dataDir, `${spec.formName}_spec.json`);
    if (process.env.DATABASE_URL && fs.existsSync(specPath)) {
      syncToDb(spec.formName, {}, specPath).catch(() => {});
    }

    res.json({ ok: true, fileName, formName: spec.formName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: get auth token for browser-side LLM calls
app.get('/api/cli/token', (req, res) => {
  const config = readAdcgenConfig();
  if (config.github_token) {
    return res.json({ ok: true, token: config.github_token });
  }
  res.json({ ok: false, error: 'Not logged in' });
});

// API: adcgen CLI execution
app.post('/api/cli/exec', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command provided' });

  const args = command.trim().split(/\s+/);
  const bin = args[0];
  if (bin !== 'adcgen' && bin !== 'adc') {
    return res.status(400).json({ error: 'Only adcgen/adc commands are allowed' });
  }

  // Intercept login/logout — handled by dedicated endpoints
  const subCmd = args[1];
  if (subCmd === 'login' || subCmd === 'logout') {
    return res.json({ ok: true, output: `Use the login panel above instead of "adcgen ${subCmd}".` });
  }

  const binPath = path.join(ROOT, 'bin', bin === 'adc' ? 'adc.js' : 'adcgen.js');

  execFile('node', [binPath, ...args.slice(1)], {
    cwd: ROOT,
    timeout: 30000,
    env: { ...process.env, FORCE_COLOR: '0' }
  }, (err, stdout, stderr) => {
    const output = (stdout || '') + (stderr || '');
    if (err && !output) {
      return res.json({ ok: true, output: `Error: ${err.message}` });
    }
    res.json({ ok: true, output: output || '(no output)' });
  });
});

// Static files
app.use(express.static(SITE_DIR));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 adcgen running on http://0.0.0.0:${PORT}`);
});
