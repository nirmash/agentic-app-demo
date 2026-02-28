import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { syncToDb, resolveSpecPath } from './db-sync.js';

export function startDataServer(dataDir, port = 3001) {
  const app = express();
  app.use(express.json());

  // CORS for Eleventy dev server
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  app.post('/api/save', (req, res) => {
    const { formName, sessionId, data } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    fs.mkdirSync(dataDir, { recursive: true });
    const fileName = `${formName || 'form'}_${sessionId || uuidv4().split('-')[0]}.json`;
    const filePath = path.join(dataDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`  💾 Saved: ${filePath}`);

    // Sync to Postgres if DATABASE_URL is set
    const specPath = resolveSpecPath(dataDir, formName);
    if (formName && fs.existsSync(specPath)) {
      syncToDb(formName, data, specPath).catch(err =>
        console.error(`  ⚠️  DB sync failed: ${err.message}`)
      );
    }

    res.json({ ok: true, file: fileName });
  });

  app.get('/api/load', (req, res) => {
    const { formName, id } = req.query;
    if (!formName || !id) return res.status(400).json({ error: 'formName and id required' });

    const fileName = `${formName}_${id}.json`;
    const filePath = path.join(dataDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`  📡 Data server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}
