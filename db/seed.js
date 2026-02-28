#!/usr/bin/env node
// Seed script — runs once on first Embr deploy.
// Syncs any existing _data JSON files into Postgres tables.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncToDb, resolveSpecPath } from '../src/db-sync.js';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '_data');

async function seed() {
  const files = fs.readdirSync(DATA_DIR).filter(f =>
    f.endsWith('.json') && !f.endsWith('_spec.json')
  );

  console.log(`🌱 Seeding ${files.length} data file(s) into Postgres...`);

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
      const formName = data._meta?.formName;
      if (!formName) continue;

      const specPath = resolveSpecPath(DATA_DIR, formName);
      if (!fs.existsSync(specPath)) continue;

      await syncToDb(formName, data, specPath);
      console.log(`  ✅ ${file}`);
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message}`);
    }
  }

  await pool.end();
  console.log('🌱 Seed complete.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
