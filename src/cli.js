import { Command } from 'commander';
import { createRequire } from 'module';
import { login, logout, getToken } from './auth.js';
import { generateFormSpec } from './generator.js';
import { renderAsciiPreview } from './ascii-preview.js';
import { buildEleventySite } from './eleventy-builder.js';
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
    .command('launch')
    .description('Start Eleventy dev server and data API for the generated form')
    .action(async () => {
      const fs = (await import('fs')).default;
      const siteDir = path.join(PROJECT_ROOT, '_site_src');
      if (!fs.existsSync(siteDir)) {
        console.log('⚠️  No generated form found. Run: adcgen generate\n');
        process.exit(1);
      }

      // Find the form HTML file
      const files = fs.readdirSync(siteDir).filter(f => f.endsWith('.html'));
      if (files.length === 0) {
        console.log('⚠️  No form files found in _site_src/. Run: adcgen generate\n');
        process.exit(1);
      }
      const fileName = files[0];
      const dataDir = path.join(PROJECT_ROOT, '_data');

      // Start the data server
      await startDataServer(dataDir);

      // Run Eleventy
      console.log('\n🚀 Starting Eleventy dev server...\n');
      const eleventy = spawn('npx', ['@11ty/eleventy', '--serve', '--port=8080'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        shell: true
      });

      eleventy.on('error', (err) => {
        console.error(`Failed to start Eleventy: ${err.message}`);
        process.exit(1);
      });

      // Open browser after a short delay
      setTimeout(async () => {
        try {
          const open = (await import('open')).default;
          const formUrl = `http://localhost:8080/`;
          console.log(`\n  🌐 Opening ${formUrl}\n`);
          await open(formUrl);
        } catch {
          // Silently fail if browser can't open
        }
      }, 3000);

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        console.log('\n\n👋 Shutting down...');
        eleventy.kill();
        process.exit(0);
      });
    });

  // Show help if no command given
  program.action(() => {
    program.help();
  });

  return program;
}
