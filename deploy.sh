#!/bin/bash
# deploy.sh — Deploy adcgen to an ADC sandbox (or any Linux server with Node 20+).
# Clones the repo, installs deps, links the CLI globally, builds the site,
# and optionally starts the production server.
#
# Usage:
#   On the sandbox:  bash deploy.sh           # setup only (use adcgen CLI after)
#                    bash deploy.sh --serve    # setup + start server on port 80
#   Custom port:     bash deploy.sh --serve --port 3000
set -e

PORT="${PORT:-80}"
APP_DIR="/app"
REPO="https://github.com/nirmash/agentic-app-demo.git"
SERVE=false

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --serve) SERVE=true; shift ;;
    *) shift ;;
  esac
done

echo "📦 Setting up adcgen deployment..."

# Clone or update
if [ -d "$APP_DIR/.git" ]; then
  echo "  Updating existing repo..."
  cd "$APP_DIR" && git pull --quiet
else
  echo "  Cloning repo..."
  mkdir -p "$APP_DIR"
  git clone --quiet "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# Install dependencies and link CLI globally
echo "  Installing dependencies..."
npm install --quiet 2>/dev/null
npm link --quiet 2>/dev/null
echo "  ✅ adcgen CLI linked globally"

# Build site from any existing specs
echo "  Building site..."
mkdir -p _data _site_src _site

# Generate HTML from all *_spec.json files
node -e "
import fs from 'fs';
import { buildEleventySite } from './src/eleventy-builder.js';
const dataDir = './_data';
const specs = fs.readdirSync(dataDir).filter(f => f.endsWith('_spec.json'));
if (specs.length === 0) {
  // No specs found — build the test form as a demo
  const testSpec = JSON.parse(fs.readFileSync('./test/fixtures/all_controls_spec.json', 'utf-8'));
  buildEleventySite(testSpec, '.');
  console.log('  Built demo form: all_controls_test');
} else {
  for (const f of specs) {
    const spec = JSON.parse(fs.readFileSync(dataDir + '/' + f, 'utf-8'));
    buildEleventySite(spec, '.');
    console.log('  Built form: ' + spec.formName);
  }
}
"

# Run Eleventy build
npx @11ty/eleventy --quiet 2>/dev/null

# Fix API URLs: replace localhost:3001 with same-origin relative paths
find _site -name '*.html' -exec sed -i 's|http://localhost:3001/api/|/api/|g' {} +
echo "  API URLs patched for same-origin"

echo ""
echo "✅ adcgen deployed to $APP_DIR"
echo "   Run 'adcgen' to see all commands"

if [ "$SERVE" = true ]; then
  echo ""
  echo "🚀 Starting adcgen on port $PORT..."
  exec node bin/deploy-server.js --port "$PORT"
else
  echo "   Run 'bash deploy.sh --serve' to start the web server on port $PORT"
fi
