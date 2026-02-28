#!/usr/bin/env node
// Usage: node db/query.js "SELECT * FROM login"
//        node db/query.js --tables           (list all tables)
//        node db/query.js --describe login   (show table columns)

import { pool } from '../src/db.js';

const args = process.argv.slice(2);

async function run() {
  if (args.length === 0 || args[0] === '--help') {
    console.log(`Usage:
  node db/query.js "SQL query"
  node db/query.js --tables
  node db/query.js --describe <table>`);
    process.exit(0);
  }

  let sql;
  if (args[0] === '--tables') {
    sql = `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  } else if (args[0] === '--describe') {
    const table = args[1];
    if (!table) { console.error('Usage: --describe <table>'); process.exit(1); }
    sql = `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`;
  } else {
    sql = args.join(' ');
  }

  try {
    const result = await pool.query(sql);
    if (result.rows.length === 0) {
      console.log('(no rows)');
    } else {
      console.table(result.rows);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
