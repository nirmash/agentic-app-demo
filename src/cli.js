import { Command } from 'commander';
import { createRequire } from 'module';
import { login, logout, getToken } from './auth.js';
import { generateFormSpec, editFormSpec, editFormHtml } from './generator.js';
import { renderAsciiPreview } from './ascii-preview.js';
import { buildEleventySite, generateIndexPage, generateListViewHtml } from './eleventy-builder.js';
import { startDataServer } from './server.js';
import { createInterface } from 'readline';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function createCli() {
  const program = new Command();

  program
    .name('adcgen')
    .description('Generate HTML forms using AI and Eleventy')
    .version('1.0.0');

  program
    .command('login')
    .description('Authenticate with GitHub')
    .action(async () => { await login(); });

  program
    .command('logout')
    .description('Remove stored GitHub token')
    .action(() => { logout(); });

  program
    .command('token')
    .description('Display the stored GitHub token')
    .action(() => {
      const t = getToken();
      console.log(t ? `\n  🔑 ${t}\n` : '\n  ⚠️  No token stored. Run: adcgen login\n');
    });

  program
    .command('list')
    .description('List all generated forms')
    .action(async () => {
      const fs = (await import('fs')).default;
      const siteDir = path.join(PROJECT_ROOT, '_site_src');
      if (!fs.existsSync(siteDir)) {
        console.log('\n  No forms generated yet. Run: adcgen generate\n');
        return;
      }
      const forms = fs.readdirSync(siteDir)
        .filter(f => f.endsWith('.html') && f !== 'index.html')
        .map(f => f.replace('.html', ''));
      if (forms.length === 0) {
        console.log('\n  No forms generated yet. Run: adcgen generate\n');
        return;
      }
      console.log(`\n  📋 Forms (${forms.length}):\n`);
      forms.forEach(f => console.log(`     • ${f}`));
      console.log('');
    });

  program
    .command('list_data')
    .description('List all saved form data records')
    .action(async () => {
      const fs = (await import('fs')).default;
      const dataDir = path.join(PROJECT_ROOT, '_data');
      if (!fs.existsSync(dataDir)) {
        console.log('\n  No data records yet.\n');
        return;
      }
      const files = fs.readdirSync(dataDir)
        .filter(f => f.endsWith('.json') && !f.endsWith('_spec.json'))
        .sort();
      if (files.length === 0) {
        console.log('\n  No data records yet.\n');
        return;
      }
      console.log(`\n  📦 Data records (${files.length}):\n`);
      for (const f of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'));
          const meta = data._meta || {};
          const date = meta.submittedAt ? new Date(meta.submittedAt).toLocaleString() : '—';
          console.log(`     • ${f.replace('.json', '')}  (${date})`);
        } catch {
          console.log(`     • ${f.replace('.json', '')}`);
        }
      }
      console.log('');
    });

  program
    .command('generate')
    .description('Generate a new HTML form from a natural language description')
    .argument('[name]', 'Form name (snake_case, e.g. employee_onboarding)')
    .action(async (name) => {
      const token = getToken();
      if (!token) {
        console.log('⚠️  Not logged in. Run: adcgen login');
        console.log('   Or set GITHUB_TOKEN environment variable.\n');
        process.exit(1);
      }

      // Get form name
      let formName = name;
      if (!formName) {
        formName = await prompt('📛 Form name (snake_case): ');
      }
      formName = formName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (!formName) {
        console.log('No form name provided. Exiting.');
        process.exit(0);
      }

      console.log('\n🎨 adcgen — AI Form Generator');
      console.log('━'.repeat(40));
      console.log('Describe the form you want to create.');
      console.log('Be specific about fields, sections, and any custom behavior.\n');

      const description = await prompt('📝 Form description: ');
      if (!description) {
        console.log('No description provided. Exiting.');
        process.exit(0);
      }

      console.log('\n⏳ Generating form design...\n');

      let spec;
      try {
        spec = await generateFormSpec(description);
      } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
      }

      // Override formName with user-provided name
      spec.formName = formName;

      // Show ASCII preview
      console.log(renderAsciiPreview(spec));

      const approval = await prompt('✅ Approve this form? (y/n): ');
      if (approval.toLowerCase() !== 'y' && approval.toLowerCase() !== 'yes') {
        console.log('Form rejected. Run adcgen generate to try again.');
        process.exit(0);
      }

      // Build Eleventy site
      console.log('\n🔧 Generating Eleventy site...\n');
      const { siteDir, fileName, dataDir } = buildEleventySite(spec, PROJECT_ROOT);
      console.log(`  ✓ Form template: ${siteDir}/${fileName}`);
      console.log(`  ✓ Data directory: ${dataDir}`);

      // List all forms
      const fs = (await import('fs')).default;
      const allForms = fs.readdirSync(siteDir).filter(f => f.endsWith('.html') && f !== 'index.html');
      console.log(`\n  📋 Forms (${allForms.length} total):`);
      allForms.forEach(f => console.log(`     • ${f.replace('.html', '')}`));

      console.log('\n  Run "adcgen launch" to start the dev server.\n');
    });

  program
    .command('edit')
    .description('Edit an existing form using AI')
    .argument('[name]', 'Form name to edit')
    .action(async (name) => {
      const token = getToken();
      if (!token) {
        console.log('⚠️  Not logged in. Run: adcgen login');
        process.exit(1);
      }

      const fs = (await import('fs')).default;
      const siteDir = path.join(PROJECT_ROOT, '_site_src');
      const dataDir = path.join(PROJECT_ROOT, '_data');

      if (!fs.existsSync(siteDir)) {
        console.log('⚠️  No forms found. Run: adcgen generate\n');
        process.exit(1);
      }

      // List available forms
      const forms = fs.readdirSync(siteDir)
        .filter(f => f.endsWith('.html') && f !== 'index.html')
        .map(f => f.replace('.html', ''));

      if (forms.length === 0) {
        console.log('⚠️  No forms found. Run: adcgen generate\n');
        process.exit(1);
      }

      // Pick a form
      let formName = name;
      if (!formName) {
        console.log('\n📋 Available forms:');
        forms.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
        const choice = await prompt('\n📛 Form name (or number): ');
        const num = parseInt(choice);
        formName = (num > 0 && num <= forms.length) ? forms[num - 1] : choice;
      }

      if (!forms.includes(formName)) {
        console.log(`⚠️  Form "${formName}" not found.\n`);
        process.exit(1);
      }

      // Load spec and HTML
      const specFile = path.join(dataDir, `${formName}_spec.json`);
      const htmlFile = path.join(siteDir, `${formName}.html`);

      if (!fs.existsSync(htmlFile)) {
        console.log(`⚠️  HTML file not found for "${formName}". Cannot edit.\n`);
        process.exit(1);
      }

      const currentHtml = fs.readFileSync(htmlFile, 'utf-8');
      const hasSpec = fs.existsSync(specFile);
      const currentSpec = hasSpec ? JSON.parse(fs.readFileSync(specFile, 'utf-8')) : null;

      // Detect if HTML was manually modified (differs from what spec would generate)
      // Normalize by stripping SESSION_ID and trailing whitespace for comparison
      let useHtmlMode = !hasSpec;
      if (hasSpec) {
        const { generateFormHtml } = await import('./eleventy-builder.js');
        if (typeof generateFormHtml === 'function') {
          const normalize = (html) => html.replace(/SESSION_ID\s*=\s*'[^']*'/, 'SESSION_ID').replace(/\s+$/gm, '');
          const specHtml = generateFormHtml(currentSpec);
          useHtmlMode = normalize(currentHtml) !== normalize(specHtml);
        }
      }

      // Show ASCII preview from spec (always, if spec exists)
      if (currentSpec) {
        console.log('\n📄 Current form:');
        console.log(renderAsciiPreview(currentSpec));

        // Show event handlers
        let hasEvents = false;
        for (const section of currentSpec.sections || []) {
          for (const field of section.fields || []) {
            if (field.events && field.events.length > 0) {
              if (!hasEvents) {
                console.log('⚡ Event handlers:');
                hasEvents = true;
              }
              for (const evt of field.events) {
                console.log(`  • ${field.label} [${evt.event}]: ${evt.description || evt.handler}`);
              }
            }
          }
        }
        if (hasEvents) console.log('');
      }

      if (useHtmlMode) {
        console.log('  ℹ️  Manual changes detected — editing HTML directly.\n');
      }

      // Get change request
      const changeRequest = await prompt('✏️  What would you like to change? ');
      if (!changeRequest) {
        console.log('No changes requested. Exiting.');
        process.exit(0);
      }

      console.log('\n⏳ Applying changes...\n');

      // Get available pages for link resolution
      const availablePages = fs.readdirSync(siteDir)
        .filter(f => f.endsWith('.html') && f !== 'index.html')
        .map(f => f.replace('.html', ''));

      if (useHtmlMode) {
        // Edit HTML directly
        let newHtml;
        try {
          newHtml = await editFormHtml(currentHtml, changeRequest, availablePages);
        } catch (err) {
          console.error(`❌ ${err.message}`);
          process.exit(1);
        }

        console.log('📄 Changes applied to HTML.');
        const approval = await prompt('✅ Save changes? (y/n): ');
        if (approval.toLowerCase() !== 'y' && approval.toLowerCase() !== 'yes') {
          console.log('Changes discarded.\n');
          process.exit(0);
        }

        fs.writeFileSync(htmlFile, newHtml);
        console.log(`\n  ✓ Updated: ${htmlFile}`);
        console.log('  Changes will auto-reload if server is running.\n');
      } else {
        // Edit via spec
        let newSpec;
        try {
          newSpec = await editFormSpec(currentSpec, changeRequest, availablePages);
        } catch (err) {
          console.error(`❌ ${err.message}`);
          process.exit(1);
        }

        newSpec.formName = formName;

        console.log('📄 Updated form:');
        console.log(renderAsciiPreview(newSpec));

        const approval = await prompt('✅ Apply these changes? (y/n): ');
        if (approval.toLowerCase() !== 'y' && approval.toLowerCase() !== 'yes') {
          console.log('Changes discarded.\n');
          process.exit(0);
        }

        const { siteDir: sd, fileName } = buildEleventySite(newSpec, PROJECT_ROOT);
        console.log(`\n  ✓ Updated: ${sd}/${fileName}`);
        console.log('  Run "adcgen launch" to see changes.\n');
      }
    });

  program
    .command('launch')
    .description('Start Eleventy dev server and data API in the background')
    .option('--no-open', 'Do not open the browser automatically')
    .option('--port <number>', 'Port for the Eleventy site (default: 8080)', '8080')
    .action(async (opts) => {
      const fs = (await import('fs')).default;
      const port = opts.port;
      const siteDir = path.join(PROJECT_ROOT, '_site_src');
      if (!fs.existsSync(siteDir)) {
        console.log('⚠️  No generated form found. Run: adcgen generate\n');
        process.exit(1);
      }

      const files = fs.readdirSync(siteDir).filter(f => f.endsWith('.html'));
      if (files.length === 0) {
        console.log('⚠️  No form files found in _site_src/. Run: adcgen generate\n');
        process.exit(1);
      }
      const dataDir = path.join(PROJECT_ROOT, '_data');
      const pidFile = path.join(PROJECT_ROOT, '.adcgen.pid');

      // Check if already running
      if (fs.existsSync(pidFile)) {
        try {
          const raw = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
          const pids = Array.isArray(raw) ? raw : (raw.pids || []);
          const alive = pids.some(pid => { try { process.kill(pid, 0); return true; } catch { return false; } });
          if (alive) {
            console.log('⚠️  Server already running. Use "adcgen stop" first.\n');
            process.exit(1);
          }
          // Stale PID file, clean up
          fs.unlinkSync(pidFile);
        } catch { /* stale pid file */ }
      }

      // Check if ports are free
      const { execSync: exec } = await import('child_process');
      for (const checkPort of [port, '3001']) {
        try {
          const pid = exec(`lsof -ti :${checkPort} 2>/dev/null`, { encoding: 'utf-8' }).trim();
          if (pid) {
            console.log(`⚠️  Port ${checkPort} is already in use (PID: ${pid}).`);
            console.log(`   Run: kill ${pid}\n`);
            process.exit(1);
          }
        } catch { /* port is free */ }
      }

      // Start both servers in a single detached child process
      const logFile = path.join(PROJECT_ROOT, '.adcgen-server.log');
      const logFd = fs.openSync(logFile, 'w');
      const serveScript = path.join(PROJECT_ROOT, 'bin', 'adcgen-serve.js');
      const child = spawn('node', [serveScript, '--port', port], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', logFd, logFd],
        detached: true,
        env: { ...process.env }
      });
      child.unref();

      // Save PID and port
      fs.writeFileSync(pidFile, JSON.stringify({ pids: [child.pid], port }));

      console.log('\n🚀 Servers started in background (PID: ' + child.pid + '):');
      console.log('  • Eleventy:    http://localhost:' + port);
      console.log('  • Data API:    http://localhost:3001');
      console.log('  • Logs:        .adcgen-server.log');
      console.log('\n  Use "adcgen stop" to shut down.\n');

      // Open browser
      if (opts.open !== false) {
        setTimeout(async () => {
          try {
            const open = (await import('open')).default;
            await open('http://localhost:' + port + '/');
          } catch { /* ignore */ }
          process.exit(0);
        }, 3000);
      } else {
        process.exit(0);
      }
    });

  program
    .command('stop')
    .description('Stop the running dev servers')
    .action(async () => {
      const fs = (await import('fs')).default;
      const pidFile = path.join(PROJECT_ROOT, '.adcgen.pid');
      if (!fs.existsSync(pidFile)) {
        console.log('⚠️  No running servers found.\n');
        return;
      }
      try {
        const raw = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
        const pids = Array.isArray(raw) ? raw : (raw.pids || []);
        for (const pid of pids) {
          try {
            process.kill(-pid, 'SIGTERM');
          } catch {
            try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
          }
        }
        fs.unlinkSync(pidFile);
        console.log('  👋 Servers stopped.\n');
      } catch (err) {
        console.log(`⚠️  Error stopping servers: ${err.message}\n`);
      }
    });

  program
    .command('ps')
    .description('Show status of running adcgen servers')
    .action(async () => {
      const fs = (await import('fs')).default;
      const pidFile = path.join(PROJECT_ROOT, '.adcgen.pid');
      if (!fs.existsSync(pidFile)) {
        console.log('\n  ⚪ No servers running.\n');
        return;
      }
      try {
        const raw = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
        const pids = Array.isArray(raw) ? raw : (raw.pids || []);
        const port = raw.port || '8080';
        const statuses = pids.map(pid => {
          try { process.kill(pid, 0); return { pid, alive: true }; }
          catch { return { pid, alive: false }; }
        });
        const anyAlive = statuses.some(s => s.alive);
        if (!anyAlive) {
          fs.unlinkSync(pidFile);
          console.log('\n  ⚪ No servers running (stale PID file cleaned).\n');
          return;
        }
        console.log('\n  🟢 adcgen servers running:\n');
        console.log(`     PID     Status`);
        console.log(`     ──────  ──────`);
        for (const s of statuses) {
          console.log(`     ${String(s.pid).padEnd(6)}  ${s.alive ? '🟢 running' : '⚪ stopped'}`);
        }
        console.log(`\n     Eleventy:  http://localhost:${port}`);
        console.log(`     Data API:  http://localhost:3001`);
        console.log(`     Logs:      .adcgen-server.log\n`);
      } catch (err) {
        console.log(`⚠️  Error reading PID file: ${err.message}\n`);
      }
    });

  program
    .command('rm')
    .description('Remove one or more generated forms by name')
    .argument('<names...>', 'Form names to remove (space-separated)')
    .action(async (names) => {
      const fs = (await import('fs')).default;
      const siteDir = path.join(PROJECT_ROOT, '_site_src');
      const dataDir = path.join(PROJECT_ROOT, '_data');
      if (!fs.existsSync(siteDir)) {
        console.log('⚠️  No forms found. Nothing to remove.\n');
        return;
      }
      for (const name of names) {
        const file = path.join(siteDir, `${name}.html`);
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`  🗑  Removed: ${name}`);
        } else {
          console.log(`  ⚠️  Not found: ${name}`);
        }
        // Remove list view page
        const listFile = path.join(siteDir, `${name}_list.html`);
        if (fs.existsSync(listFile)) {
          fs.unlinkSync(listFile);
          console.log(`  🗑  Removed: ${name}_list`);
        }
        // Also remove from _site (production output)
        const prodFile = path.join(PROJECT_ROOT, '_site', `${name}.html`);
        if (fs.existsSync(prodFile)) fs.unlinkSync(prodFile);
        const prodListFile = path.join(PROJECT_ROOT, '_site', `${name}_list.html`);
        if (fs.existsSync(prodListFile)) fs.unlinkSync(prodListFile);
        // Remove spec file (read it first for DB cleanup)
        const specFile = path.join(dataDir, `${name}_spec.json`);
        // Drop DB tables if DATABASE_URL is set (Embr context)
        if (process.env.DATABASE_URL) {
          try {
            const { dropFormTables } = await import('./db-sync.js');
            await dropFormTables(name, specFile);
            console.log(`  🗄  Dropped DB tables for: ${name}`);
          } catch (err) {
            console.log(`  ⚠️  DB cleanup failed: ${err.message}`);
          }
        }
        if (fs.existsSync(specFile)) fs.unlinkSync(specFile);
        // Remove data files
        if (fs.existsSync(dataDir)) {
          for (const f of fs.readdirSync(dataDir)) {
            if (f.startsWith(`${name}_`) && f.endsWith('.json') && !f.endsWith('_spec.json')) {
              fs.unlinkSync(path.join(dataDir, f));
            }
          }
        }
      }
      // Regenerate index for both _site_src and _site
      const remaining = fs.readdirSync(siteDir).filter(f => f.endsWith('.html') && f !== 'index.html');
      if (remaining.length > 0) {
        const { generateIndexPage } = await import('./eleventy-builder.js');
        generateIndexPage(siteDir);
        const prodSiteDir = path.join(PROJECT_ROOT, '_site');
        if (fs.existsSync(prodSiteDir)) generateIndexPage(prodSiteDir);
      } else {
        // No forms left, clean up index too
        for (const d of [siteDir, path.join(PROJECT_ROOT, '_site')]) {
          const indexFile = path.join(d, 'index.html');
          if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);
        }
      }
      console.log(`\n  📋 ${remaining.length} form${remaining.length !== 1 ? 's' : ''} remaining.\n`);
    });

  program
    .command('clean')
    .description('Delete all generated forms and site output')
    .action(async () => {
      const fs = (await import('fs')).default;
      for (const dir of ['_site_src', '_site']) {
        const target = path.join(PROJECT_ROOT, dir);
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true });
          console.log(`  🗑  Removed: ${dir}/`);
        }
      }
      console.log('\n  ✅ All generated files cleaned.\n');
    });

  program
    .command('list_view')
    .description('Generate a list view page showing all records for a form')
    .argument('[name]', 'Form name (e.g. speaker)')
    .action(async (name) => {
      const fs = (await import('fs')).default;
      const dataDir = path.join(PROJECT_ROOT, '_data');
      const siteDir = path.join(PROJECT_ROOT, '_site_src');

      if (!fs.existsSync(dataDir)) {
        console.log('⚠️  No forms found. Run: adcgen generate\n');
        return;
      }

      const specs = fs.readdirSync(dataDir).filter(f => f.endsWith('_spec.json'));
      if (specs.length === 0) {
        console.log('⚠️  No form specs found. Run: adcgen generate\n');
        return;
      }

      // List available forms if no name given
      if (!name) {
        const formNames = specs.map(f => f.replace('_spec.json', ''));
        console.log('\n📋 Available forms:\n');
        formNames.forEach(f => console.log(`     • ${f}`));
        console.log('\n  Usage: adcgen list_view <formName>\n');
        return;
      }

      const specFile = path.join(dataDir, `${name}_spec.json`);
      if (!fs.existsSync(specFile)) {
        console.log(`⚠️  Spec not found for "${name}". Available forms:`);
        specs.forEach(f => console.log(`     • ${f.replace('_spec.json', '')}`));
        console.log('');
        return;
      }

      const spec = JSON.parse(fs.readFileSync(specFile, 'utf-8'));
      fs.mkdirSync(siteDir, { recursive: true });

      const listHtml = generateListViewHtml(spec);
      const listFileName = `${name}_list.html`;
      fs.writeFileSync(path.join(siteDir, listFileName), listHtml);

      // Regenerate index to show the list view link
      generateIndexPage(siteDir);

      console.log(`\n  ✓ List view: ${siteDir}/${listFileName}`);
      console.log(`  ✓ Index page updated with Records link`);
      console.log(`\n  Run "adcgen launch" to see it.\n`);
    });

  program
    .command('rebuild')
    .description('Rebuild all forms from their saved specs (picks up latest features)')
    .action(async () => {
      const fs = (await import('fs')).default;
      const dataDir = path.join(PROJECT_ROOT, '_data');
      if (!fs.existsSync(dataDir)) {
        console.log('⚠️  No specs found. Run: adcgen generate\n');
        return;
      }
      const specs = fs.readdirSync(dataDir).filter(f => f.endsWith('_spec.json'));
      if (specs.length === 0) {
        console.log('⚠️  No specs found. Run: adcgen generate\n');
        return;
      }
      for (const f of specs) {
        const spec = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'));
        buildEleventySite(spec, PROJECT_ROOT);
        console.log(`  ✓ Rebuilt: ${spec.formName}`);
      }
      console.log(`\n  ✅ ${specs.length} form${specs.length !== 1 ? 's' : ''} rebuilt.\n`);
    });

  program
    .command('commit')
    .description('Stage and commit form-related files (optionally for a single form)')
    .argument('[formName]', 'Form name to commit (omit for all forms)')
    .action(async (formName) => {
      const fs = (await import('fs')).default;
      const { execSync } = await import('child_process');
      const run = (cmd) => execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30000 }).trim();

      if (formName) {
        // Validate form exists
        const specFile = path.join(PROJECT_ROOT, '_data', `${formName}_spec.json`);
        if (!fs.existsSync(specFile)) {
          console.log(`⚠️  Form "${formName}" not found. Run: adcgen list\n`);
          process.exitCode = 1;
          return;
        }

        // Build glob list of files to stage
        const patterns = [
          `_data/${formName}_spec.json`,
          `_data/${formName}_*.json`,
          `_site_src/${formName}.html`,
          `_site_src/${formName}_list.html`,
          '_site/'
        ];

        // Stage each pattern (ignore errors for missing files)
        for (const p of patterns) {
          try { run(`git add ${p}`); } catch { /* file may not exist */ }
        }

        // Check if anything was staged
        let staged;
        try { staged = run('git diff --cached --name-only'); } catch { staged = ''; }
        if (!staged) {
          console.log(`\n  ℹ️  No changes to commit for "${formName}".\n`);
          return;
        }

        console.log(`\n  📂 Staged files:`);
        staged.split('\n').forEach(f => console.log(`     • ${f}`));

        try {
          run(`git commit -m "feat: update ${formName} form and data"`);
          console.log(`\n  ✅ Committed: feat: update ${formName} form and data\n`);
        } catch (err) {
          console.log(`\n  ⚠️  Commit failed: ${err.message}\n`);
          process.exitCode = 1;
          return;
        }
      } else {
        // Stage all form-related directories
        for (const dir of ['_data/', '_site_src/', '_site/']) {
          try { run(`git add ${dir}`); } catch { /* dir may not exist */ }
        }

        let staged;
        try { staged = run('git diff --cached --name-only'); } catch { staged = ''; }
        if (!staged) {
          console.log('\n  ℹ️  No changes to commit.\n');
          return;
        }

        console.log(`\n  📂 Staged files:`);
        staged.split('\n').forEach(f => console.log(`     • ${f}`));

        try {
          run('git commit -m "feat: update all forms and data"');
          console.log('\n  ✅ Committed: feat: update all forms and data\n');
        } catch (err) {
          console.log(`\n  ⚠️  Commit failed: ${err.message}\n`);
          process.exitCode = 1;
          return;
        }
      }

      // Try push (non-fatal)
      try {
        const pushOutput = run('git push');
        console.log('  🚀 Pushed to remote.');
        if (pushOutput) console.log(`     ${pushOutput}`);
      } catch (err) {
        console.log(`  ⚠️  Push failed (commit is saved locally): ${err.stderr || err.message}`);
      }
      console.log('');
    });

  // Show help if no command given
  program.action(() => {
    program.help();
  });

  return program;
}
