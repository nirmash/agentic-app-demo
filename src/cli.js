import { Command } from 'commander';
import { createRequire } from 'module';
import { login, logout, getToken } from './auth.js';
import { generateFormSpec, editFormSpec } from './generator.js';
import { renderAsciiPreview } from './ascii-preview.js';
import { buildEleventySite, generateIndexPage } from './eleventy-builder.js';
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

      // Load spec
      const specFile = path.join(dataDir, `${formName}_spec.json`);
      if (!fs.existsSync(specFile)) {
        console.log(`⚠️  Spec file not found for "${formName}". Cannot edit.\n`);
        process.exit(1);
      }
      const currentSpec = JSON.parse(fs.readFileSync(specFile, 'utf-8'));

      // Show current form
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

      // Get change request
      const changeRequest = await prompt('✏️  What would you like to change? ');
      if (!changeRequest) {
        console.log('No changes requested. Exiting.');
        process.exit(0);
      }

      console.log('\n⏳ Applying changes...\n');

      let newSpec;
      try {
        newSpec = await editFormSpec(currentSpec, changeRequest);
      } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
      }

      // Preserve formName
      newSpec.formName = formName;

      // Show updated form
      console.log('📄 Updated form:');
      console.log(renderAsciiPreview(newSpec));

      const approval = await prompt('✅ Apply these changes? (y/n): ');
      if (approval.toLowerCase() !== 'y' && approval.toLowerCase() !== 'yes') {
        console.log('Changes discarded.\n');
        process.exit(0);
      }

      // Rebuild
      const { siteDir: sd, fileName } = buildEleventySite(newSpec, PROJECT_ROOT);
      console.log(`\n  ✓ Updated: ${sd}/${fileName}`);
      console.log('  Run "adcgen launch" to see changes.\n');
    });

  program
    .command('launch')
    .description('Start Eleventy dev server and data API in the background')
    .option('--no-open', 'Do not open the browser automatically')
    .action(async (opts) => {
      const fs = (await import('fs')).default;
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
          const pids = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
          const alive = pids.some(pid => { try { process.kill(pid, 0); return true; } catch { return false; } });
          if (alive) {
            console.log('⚠️  Server already running. Use "adcgen stop" first.\n');
            process.exit(1);
          }
        } catch { /* stale pid file */ }
      }

      // Start data server
      await startDataServer(dataDir);
      const dataServerPid = process.pid;

      // Start Eleventy detached
      const eleventyLog = fs.openSync(path.join(PROJECT_ROOT, '.adcgen-eleventy.log'), 'w');
      const eleventy = spawn('npx', ['@11ty/eleventy', '--serve', '--port=8080'], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', eleventyLog, eleventyLog],
        shell: true,
        detached: true
      });
      eleventy.unref();

      // Save PIDs
      fs.writeFileSync(pidFile, JSON.stringify([eleventy.pid, dataServerPid]));

      console.log('\n🚀 Servers started in background:');
      console.log('  • Eleventy:    http://localhost:8080  (PID: ' + eleventy.pid + ')');
      console.log('  • Data API:    http://localhost:3001  (PID: ' + dataServerPid + ')');
      console.log('  • Logs:        .adcgen-eleventy.log');
      console.log('\n  Use "adcgen stop" to shut down.\n');

      // Open browser
      if (opts.open !== false) {
        setTimeout(async () => {
          try {
            const open = (await import('open')).default;
            await open('http://localhost:8080/');
          } catch { /* ignore */ }
        }, 3000);
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
        const pids = JSON.parse(fs.readFileSync(pidFile, 'utf-8'));
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
    .command('rm')
    .description('Remove one or more generated forms by name')
    .argument('<names...>', 'Form names to remove (space-separated)')
    .action(async (names) => {
      const fs = (await import('fs')).default;
      const siteDir = path.join(PROJECT_ROOT, '_site_src');
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
      }
      // Regenerate index
      const remaining = fs.readdirSync(siteDir).filter(f => f.endsWith('.html') && f !== 'index.html');
      if (remaining.length > 0) {
        const { generateIndexPage } = await import('./eleventy-builder.js');
        generateIndexPage(siteDir);
      } else {
        // No forms left, clean up index too
        const indexFile = path.join(siteDir, 'index.html');
        if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);
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

  // Show help if no command given
  program.action(() => {
    program.help();
  });

  return program;
}
