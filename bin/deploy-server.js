#!/usr/bin/env node
// Combined static + API server for production deployment (single port).
// Usage: node bin/deploy-server.js [--port 80]

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

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

// Static files
app.use(express.static(SITE_DIR));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 adcgen running on http://0.0.0.0:${PORT}`);
});
