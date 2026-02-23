import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const SESSION_ID = uuidv4().split('-')[0];

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateFieldHtml(field, indent = '      ') {
  const req = field.required ? ' required' : '';
  const id = field.name;

  switch (field.type) {
    case 'text':
      return `${indent}<div class="form-group mb-3">
${indent}  <div class="form-group-header">
${indent}    <label class="FormControl-label" for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="color-fg-danger">*</span>' : ''}</label>
${indent}  </div>
${indent}  <div class="form-group-body">
${indent}    <input class="form-control input-block" type="text" id="${id}" name="${id}" placeholder="${escapeHtml(field.placeholder || '')}"${req}>
${indent}  </div>
${indent}</div>`;

    case 'password':
      return `${indent}<div class="form-group mb-3">
${indent}  <div class="form-group-header">
${indent}    <label class="FormControl-label" for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="color-fg-danger">*</span>' : ''}</label>
${indent}  </div>
${indent}  <div class="form-group-body position-relative">
${indent}    <input class="form-control input-block" type="password" id="${id}" name="${id}" placeholder="${escapeHtml(field.placeholder || '')}"${req}>
${indent}    <button type="button" class="btn-octicon position-absolute" style="right:8px;top:50%;transform:translateY(-50%)" onclick="const i=document.getElementById('${id}');const t=i.type==='password'?'text':'password';i.type=t;this.innerHTML=t==='password'?'👁':'👁‍🗨'" aria-label="Toggle password visibility">👁</button>
${indent}  </div>
${indent}</div>`;

    case 'dropdown':
      const opts = (field.options || []).map(o =>
        `${indent}      <option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`
      ).join('\n');
      return `${indent}<div class="form-group mb-3">
${indent}  <div class="form-group-header">
${indent}    <label class="FormControl-label" for="${id}">${escapeHtml(field.label)}${field.required ? ' <span class="color-fg-danger">*</span>' : ''}</label>
${indent}  </div>
${indent}  <div class="form-group-body">
${indent}    <select class="form-select input-block" id="${id}" name="${id}"${req}>
${indent}      <option value="">Select...</option>
${opts}
${indent}    </select>
${indent}  </div>
${indent}</div>`;

    case 'checkbox':
      if (field.options && field.options.length > 0) {
        const checks = field.options.map((o, i) =>
          `${indent}  <div class="form-checkbox">
${indent}    <label><input type="checkbox" name="${id}" value="${escapeHtml(o)}"> ${escapeHtml(o)}</label>
${indent}  </div>`
        ).join('\n');
        return `${indent}<fieldset class="mb-3">
${indent}  <legend class="FormControl-label">${escapeHtml(field.label)}</legend>
${checks}
${indent}</fieldset>`;
      }
      return `${indent}<div class="form-checkbox mb-3">
${indent}  <label><input type="checkbox" id="${id}" name="${id}"> ${escapeHtml(field.label)}</label>
${indent}</div>`;

    case 'radio':
      const radios = (field.options || []).map((o, i) =>
        `${indent}  <div class="form-checkbox">
${indent}    <label><input type="radio" name="${id}" value="${escapeHtml(o)}"${i === 0 ? ' checked' : ''}> ${escapeHtml(o)}</label>
${indent}  </div>`
      ).join('\n');
      return `${indent}<fieldset class="mb-3">
${indent}  <legend class="FormControl-label">${escapeHtml(field.label)}</legend>
${radios}
${indent}</fieldset>`;

    case 'button':
      const btnClass = field.name === 'submit' || field.label?.toLowerCase().includes('submit')
        ? 'btn btn-primary' : 'btn';
      const eventAttrs = generateEventAttributes(field);
      return `${indent}<div class="form-actions mb-3">
${indent}  <button type="button" class="${btnClass}" id="${id}"${eventAttrs}>${escapeHtml(field.label || 'Button')}</button>
${indent}</div>`;

    case 'table':
      return generateTableHtml(field, indent);

    case 'link':
      const href = field.href || '#';
      return `${indent}<div class="mb-3">
${indent}  <a class="Link" href="${escapeHtml(href)}">${escapeHtml(field.label || 'Link')}</a>
${indent}</div>`;

    default:
      return `${indent}<!-- Unknown field type: ${field.type} -->`;
  }
}

function generateEventAttributes(field) {
  if (!field.events || field.events.length === 0) return '';
  // Events are wired via JS below, not inline attributes
  return '';
}

function generateTableHtml(field, indent) {
  const cols = field.columns || [];
  const rows = field.initialRows || 3;

  let header = cols.map(c =>
    `${indent}        <th class="p-2">${escapeHtml(c.header)}</th>`
  ).join('\n');

  let bodyRows = '';
  for (let r = 0; r < rows; r++) {
    const cells = cols.map(c => {
      const cellName = `${field.name}_${c.name}_${r}`;
      switch (c.type) {
        case 'dropdown':
          const opts = (c.options || []).map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
          return `${indent}        <td class="p-2"><select class="form-select" name="${cellName}""><option value="">Select...</option>${opts}</select></td>`;
        case 'checkbox':
          return `${indent}        <td class="p-2 text-center"><input type="checkbox" name="${cellName}"></td>`;
        default:
          return `${indent}        <td class="p-2"><input class="form-control" type="text" name="${cellName}" placeholder="${escapeHtml(c.header)}"></td>`;
      }
    }).join('\n');
    bodyRows += `${indent}      <tr data-row="${r}">\n${cells}\n${indent}      </tr>\n`;
  }

  return `${indent}<div class="mb-3">
${indent}  <label class="FormControl-label">${escapeHtml(field.label)}</label>
${indent}  <div class="overflow-auto">
${indent}    <table class="table-bordered width-full" id="table_${field.name}">
${indent}      <thead class="color-bg-subtle">
${indent}        <tr>
${header}
${indent}        </tr>
${indent}      </thead>
${indent}      <tbody>
${bodyRows}${indent}      </tbody>
${indent}    </table>
${indent}  </div>
${indent}</div>`;
}

function generateEventHandlerScript(spec) {
  const handlers = [];

  for (const section of spec.sections || []) {
    for (const field of section.fields || []) {
      if (!field.events || field.events.length === 0) continue;
      for (const evt of field.events) {
        handlers.push(`  // ${field.label}: ${evt.description || evt.event}
  document.getElementById('${field.name}')?.addEventListener('${evt.event}', function(e) {
    ${evt.handler || `console.log('${field.name} ${evt.event}');`}
  });`);
      }
    }
  }

  return handlers.join('\n\n');
}

export function generateFormHtml(spec) {
  const sessionId = SESSION_ID;
  const formName = spec.formName || 'form';

  let sectionsHtml = '';
  for (const section of spec.sections || []) {
    if (section.heading) {
      sectionsHtml += `\n      <h3 class="h3 mb-3 pb-2 border-bottom">${escapeHtml(section.heading)}</h3>\n`;
    }
    for (const field of section.fields || []) {
      sectionsHtml += generateFieldHtml(field) + '\n';
    }
  }

  const eventScript = generateEventHandlerScript(spec);

  return `<!DOCTYPE html>
<html lang="en" data-color-mode="dark" data-dark-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(spec.title)}</title>
  <link rel="stylesheet" href="https://unpkg.com/@primer/css@21.3.1/dist/primer.css">
  <!-- ⚠️ DO NOT EDIT: Styles managed by adcgen -->
  <style>
    body { background-color: var(--bgColor-default, #0d1117); color: var(--fgColor-default, #e6edf3); }
    .form-container {
      max-width: 768px;
      margin: 2rem auto;
      background: var(--bgColor-muted, #161b22);
      border: 1px solid var(--borderColor-default, #30363d);
      border-radius: 6px;
      padding: 2rem;
    }
    .form-header {
      text-align: center;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--borderColor-default, #30363d);
    }
    .table-bordered { border-collapse: collapse; }
    .table-bordered th, .table-bordered td { border: 1px solid var(--borderColor-default, #30363d); }
    .table-bordered input, .table-bordered select { border: none; width: 100%; background: transparent; color: inherit; }
    .toast-success {
      position: fixed; top: 1rem; right: 1rem;
      background: var(--bgColor-success-emphasis, #1a7f37);
      color: white; padding: 0.75rem 1.5rem; border-radius: 6px;
      display: none; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  </style>
  <!-- END DO NOT EDIT -->
</head>
<body>
  <div class="toast-success" id="toast">✓ Data saved successfully!</div>

  <div class="form-container">
    <div class="form-header">
      <h1 class="h2">${escapeHtml(spec.title)}</h1>
    </div>

    <!-- ✅ SAFE TO EDIT: Form content below -->
    <form id="main-form">
${sectionsHtml}
    </form>
    <!-- END SAFE TO EDIT -->
  </div>

  <!-- ⚠️ DO NOT EDIT: Form submission and data loading scripts managed by adcgen -->
  <script>
    const FORM_NAME = '${formName}';
    let SESSION_ID = '${sessionId}';

    // Check URL for ?id= param to load existing data
    const urlParams = new URLSearchParams(window.location.search);
    const loadId = urlParams.get('id');
    if (loadId) SESSION_ID = loadId;

    // Populate form fields from a data object
    function populateForm(data) {
      const form = document.getElementById('main-form');
      for (const [key, value] of Object.entries(data)) {
        if (key === '_meta') continue;

        // Handle table data (arrays of objects)
        if (Array.isArray(value)) {
          value.forEach((row, rowIdx) => {
            if (row && typeof row === 'object') {
              for (const [col, cellVal] of Object.entries(row)) {
                const cellName = key + '_' + col + '_' + rowIdx;
                const el = form.querySelector('[name="' + cellName + '"]');
                if (el) {
                  if (el.type === 'checkbox') el.checked = !!cellVal;
                  else el.value = cellVal;
                }
              }
            }
          });
          continue;
        }

        const elements = form.querySelectorAll('[name="' + key + '"]');
        if (elements.length === 0) continue;

        const el = elements[0];
        if (el.type === 'checkbox') {
          if (elements.length > 1) {
            // Multi-checkbox: value is array
            const vals = Array.isArray(value) ? value : [value];
            elements.forEach(cb => { cb.checked = vals.includes(cb.value); });
          } else {
            el.checked = value === true || value === 'on' || value === el.value;
          }
        } else if (el.type === 'radio') {
          elements.forEach(r => { r.checked = r.value === value; });
        } else {
          el.value = value;
        }
      }
    }

    // Load existing data if ?id= is present
    if (loadId) {
      fetch('http://localhost:3001/api/load?formName=' + FORM_NAME + '&id=' + loadId)
        .then(r => r.ok ? r.json() : null)
        .then(result => { if (result && result.data) populateForm(result.data); })
        .catch(() => {});
    }

    // Collect all form data including tables
    function collectFormData() {
      const form = document.getElementById('main-form');
      const data = {};
      const formData = new FormData(form);

      for (const [key, value] of formData.entries()) {
        // Handle table fields: fieldname_colname_rowindex
        const tableMatch = key.match(/^(.+?)_(.+?)_(\\d+)$/);
        if (tableMatch) {
          const [, table, col, row] = tableMatch;
          if (!data[table]) data[table] = [];
          if (!data[table][parseInt(row)]) data[table][parseInt(row)] = {};
          data[table][parseInt(row)][col] = value;
          continue;
        }

        // Handle checkboxes with multiple values
        if (data[key] !== undefined) {
          if (!Array.isArray(data[key])) data[key] = [data[key]];
          data[key].push(value);
        } else {
          data[key] = value;
        }
      }

      // Also collect unchecked checkboxes
      form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const name = cb.name;
        if (!formData.has(name)) {
          data[name] = false;
        }
      });

      return data;
    }

    // Form submission → save JSON via local API
    document.getElementById('main-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const data = collectFormData();
      data._meta = {
        formName: FORM_NAME,
        sessionId: SESSION_ID,
        submittedAt: new Date().toISOString()
      };

      try {
        const res = await fetch('http://localhost:3001/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formName: FORM_NAME, sessionId: SESSION_ID, data })
        });
        if (res.ok) {
          const toast = document.getElementById('toast');
          toast.style.display = 'block';
          setTimeout(() => toast.style.display = 'none', 3000);
        } else {
          alert('Failed to save data. Is the adcgen server running?');
        }
      } catch (err) {
        alert('Could not connect to save server. Is the adcgen server running?');
      }
    });

    // Custom event handlers
${eventScript}
  </script>
  <!-- END DO NOT EDIT -->
</body>
</html>`;
}

export function buildEleventySite(spec, outputDir) {
  const siteDir = path.join(outputDir, '_site_src');
  const dataDir = path.join(outputDir, '_data');

  // Ensure directories
  fs.mkdirSync(siteDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Write the HTML form (additive — doesn't remove existing forms)
  const formHtml = generateFormHtml(spec);
  const fileName = `${spec.formName || 'form'}.html`;
  fs.writeFileSync(path.join(siteDir, fileName), formHtml);

  // Regenerate index page listing all forms
  generateIndexPage(siteDir);

  // Write Eleventy config
  const eleventyConfig = `export default function(eleventyConfig) {
  eleventyConfig.setUseGitIgnore(false);

  return {
    dir: {
      input: "_site_src",
      output: "_site"
    },
    htmlTemplateEngine: false,
    markdownTemplateEngine: false
  };
};
`;
  fs.writeFileSync(path.join(outputDir, 'eleventy.config.js'), eleventyConfig);

  // Save the form spec for reference
  fs.writeFileSync(
    path.join(dataDir, `${spec.formName || 'form'}_spec.json`),
    JSON.stringify(spec, null, 2)
  );

  return { siteDir, fileName, dataDir };
}

export function generateIndexPage(siteDir) {
  const forms = fs.readdirSync(siteDir)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => {
      const name = f.replace('.html', '');
      const label = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { file: name, label };
    });

  const links = forms.map(f =>
    `        <li class="Box-row">
          <a href="/${f.file}/" class="Link d-flex flex-items-center">
            <span class="mr-2">📋</span>
            <span class="flex-auto">${f.label}</span>
            <span class="Label Label--secondary">${f.file}.html</span>
          </a>
        </li>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en" data-color-mode="dark" data-dark-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>adcgen — Forms</title>
  <link rel="stylesheet" href="https://unpkg.com/@primer/css@21.3.1/dist/primer.css">
  <style>
    body { background-color: var(--bgColor-default, #0d1117); color: var(--fgColor-default, #e6edf3); }
    .container { max-width: 768px; margin: 2rem auto; }
    .Box-row a { text-decoration: none; padding: 12px 16px; }
    .Box-row:hover { background: var(--bgColor-muted, #161b22); }
  </style>
</head>
<body>
  <div class="container">
    <div class="Subhead mb-4">
      <h1 class="Subhead-heading">📝 adcgen Forms</h1>
      <div class="Subhead-description">${forms.length} form${forms.length !== 1 ? 's' : ''} generated</div>
    </div>
    <div class="Box">
      <ul class="list-style-none">
${links}
      </ul>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(siteDir, 'index.html'), html);
}
