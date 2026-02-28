#!/usr/bin/env node
// Combined static + API server for production deployment (single port).
// Usage: node bin/deploy-server.js [--port 80]

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
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
}

// Static files
app.use(express.static(SITE_DIR));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 adcgen running on http://0.0.0.0:${PORT}`);
});
