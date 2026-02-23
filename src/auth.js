import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

const CONFIG_DIR = path.join(process.env.HOME, '.adcgen');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

export function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    return config.github_token || null;
  } catch {
    return null;
  }
}

export function saveToken(token) {
  ensureConfigDir();
  const config = fs.existsSync(CONFIG_FILE)
    ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    : {};
  config.github_token = token;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Try to get token from gh CLI
function tryGhToken() {
  try {
    execSync('which gh 2>/dev/null', { encoding: 'utf-8' });
  } catch {
    console.log('  ⚠️  gh CLI not installed.');
    console.log('  Install it: https://cli.github.com');
    console.log('  macOS: brew install gh\n');
    return null;
  }
  try {
    const token = execSync('gh auth token 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (token && token.length > 10) return token;
    console.log('  ⚠️  gh CLI found but not authenticated.');
    console.log('  Run: gh auth login\n');
  } catch {
    console.log('  ⚠️  gh CLI found but not authenticated.');
    console.log('  Run: gh auth login\n');
  }
  return null;
}

export async function login() {
  const fetch = (await import('node-fetch')).default;

  console.log('\n🔐 GitHub Login');
  console.log('━'.repeat(40));

  // Strategy 1: Try gh CLI
  console.log('\n  Checking for gh CLI...');
  const ghToken = tryGhToken();
  if (ghToken) {
    saveToken(ghToken);
    const userRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${ghToken}` }
    });
    const user = await userRes.json();
    console.log(`  ✅ Logged in as ${user.login} (via gh CLI)\n`);
    return ghToken;
  }

  // Strategy 2: Manual token entry
  console.log('  gh CLI not found or not authenticated.\n');
  console.log('  Create a token at: https://github.com/settings/tokens');
  console.log('  Required scope: read:user\n');
  const token = await prompt('  🔑 Paste your GitHub token: ');

  if (!token) {
    throw new Error('No token provided.');
  }

  // Validate
  const userRes = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!userRes.ok) {
    throw new Error(`Invalid token (HTTP ${userRes.status}). Please try again.`);
  }

  const user = await userRes.json();
  saveToken(token);
  console.log(`\n  ✅ Logged in as ${user.login}\n`);
  return token;
}

export function logout() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
  console.log('\n  👋 Logged out. Token removed.\n');
}
