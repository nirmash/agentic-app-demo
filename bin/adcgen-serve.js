#!/usr/bin/env node
// Standalone background process that runs both the data server and Eleventy
import { startDataServer } from '../src/server.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const dataDir = path.join(PROJECT_ROOT, '_data');

// Parse --port flag
const portIdx = process.argv.indexOf('--port');
const port = portIdx !== -1 && process.argv[portIdx + 1] ? process.argv[portIdx + 1] : '8080';

// Start data server
await startDataServer(dataDir);

// Start Eleventy
const eleventy = spawn('npx', ['@11ty/eleventy', '--serve', `--port=${port}`], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  shell: true
});

eleventy.on('close', (code) => {
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  eleventy.kill();
  process.exit(0);
});
