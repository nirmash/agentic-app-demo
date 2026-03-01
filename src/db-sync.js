import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

// Field types that map to SQL columns on the main table
const DATA_FIELD_TYPES = new Set(['text', 'password', 'dropdown', 'radio', 'checkbox']);

/**
 * Extract column definitions from a _spec.json.
 * Returns { mainColumns: [...], childTables: [{ name, columns }] }
 */
function schemaFromSpec(spec) {
  const mainColumns = [];
  const childTables = [];

  for (const section of spec.sections || []) {
    for (const field of section.fields || []) {
      if (field.type === 'table') {
        const cols = (field.columns || [])
          .filter(c => c.name)
          .map(c => c.name);
        if (cols.length > 0) {
          childTables.push({ name: field.name, columns: cols });
        }
      } else if (DATA_FIELD_TYPES.has(field.type) && field.name) {
        mainColumns.push(field.name);
      }
    }
  }

  return { mainColumns, childTables };
}

/**
 * Build and execute CREATE TABLE statements for a form spec.
 */
async function createTables(formName, spec) {
  const { mainColumns, childTables } = schemaFromSpec(spec);

  // Main table: session_id PK + submitted_at + scalar fields
  const mainCols = [
    'session_id TEXT PRIMARY KEY',
    'submitted_at TIMESTAMPTZ',
    ...mainColumns.map(c => `"${c}" TEXT`),
  ];
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "${formName}" (${mainCols.join(', ')})`
  );

  // Child tables for table-type fields
  for (const child of childTables) {
    const childCols = [
      'id SERIAL PRIMARY KEY',
      `session_id TEXT REFERENCES "${formName}"(session_id) ON DELETE CASCADE`,
      'row_index INTEGER',
      ...child.columns.map(c => `"${c}" TEXT`),
    ];
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "${formName}_${child.name}" (${childCols.join(', ')})`
    );
  }
}

/**
 * Upsert form submission data into Postgres.
 * @param {string} formName - the form name (table name)
 * @param {object} data - the submitted data (includes _meta)
 * @param {string} specPath - path to the _spec.json file
 */
export async function syncToDb(formName, data, specPath) {
  if (!process.env.DATABASE_URL) return;

  const specRaw = fs.readFileSync(specPath, 'utf-8');
  const spec = JSON.parse(specRaw);

  // Create tables if not yet marked
  if (!spec.dbTableCreated) {
    await createTables(formName, spec);
    spec.dbTableCreated = true;
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  }

  const { mainColumns, childTables } = schemaFromSpec(spec);
  const meta = data._meta || {};
  const sessionId = meta.sessionId;
  const submittedAt = meta.submittedAt || new Date().toISOString();

  // Upsert main row
  const scalarFields = mainColumns.filter(c => data[c] !== undefined);
  const allCols = ['session_id', 'submitted_at', ...scalarFields];
  const allVals = [sessionId, submittedAt, ...scalarFields.map(c => {
    const v = data[c];
    return Array.isArray(v) ? JSON.stringify(v) : String(v);
  })];
  const placeholders = allVals.map((_, i) => `$${i + 1}`);
  const updateSet = allCols
    .filter(c => c !== 'session_id')
    .map((c, i) => `"${c}" = $${i + 2}`)
    .join(', ');

  await pool.query(
    `INSERT INTO "${formName}" (${allCols.map(c => `"${c}"`).join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (session_id) DO UPDATE SET ${updateSet}`,
    allVals
  );

  // Upsert child table rows
  for (const child of childTables) {
    // Find the matching array in data — key might differ from field name
    // Data keys for table rows are arrays; try field name or scan for arrays
    let rows = data[child.name];
    if (!Array.isArray(rows)) {
      // Scan top-level keys for the first array value (table data)
      for (const [key, val] of Object.entries(data)) {
        if (key !== '_meta' && Array.isArray(val)) {
          rows = val;
          break;
        }
      }
    }
    if (!Array.isArray(rows)) continue;

    // Delete old rows for this session, then insert fresh
    const childTable = `${formName}_${child.name}`;
    await pool.query(
      `DELETE FROM "${childTable}" WHERE session_id = $1`,
      [sessionId]
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cols = ['session_id', 'row_index', ...child.columns];
      // Data keys may be prefixed with "table_"
      const vals = [sessionId, i, ...child.columns.map(c => {
        return row[c] ?? row[`table_${c}`] ?? null;
      })];
      const ph = vals.map((_, j) => `$${j + 1}`);
      await pool.query(
        `INSERT INTO "${childTable}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${ph.join(', ')})`,
        vals
      );
    }
  }
}

/**
 * Resolve the spec file path for a given formName in the data directory.
 */
export function resolveSpecPath(dataDir, formName) {
  return path.join(dataDir, `${formName}_spec.json`);
}

/**
 * Drop all tables associated with a form (main + child tables).
 * Reads the spec to find child table names, then drops them all.
 */
export async function dropFormTables(formName, specPath) {
  if (!process.env.DATABASE_URL) return;

  let childNames = [];
  if (fs.existsSync(specPath)) {
    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const { childTables } = schemaFromSpec(spec);
      childNames = childTables.map(c => `${formName}_${c.name}`);
    } catch {}
  }

  // Drop child tables first (FK references), then main table
  for (const t of [...childNames, formName]) {
    try {
      await pool.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    } catch {}
  }
}
