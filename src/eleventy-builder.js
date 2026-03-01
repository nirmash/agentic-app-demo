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
  const rows = field.initialRows || 1;
  const tableId = `table_${field.name}`;
  const colsData = escapeHtml(JSON.stringify(cols));

  let header = cols.map(c =>
    `${indent}        <th class="p-2">${escapeHtml(c.header)}</th>`
  ).join('\n');
  header += `\n${indent}        <th class="p-2" style="width:40px"></th>`;

  let bodyRows = '';
  for (let r = 0; r < rows; r++) {
    const cells = cols.map(c => {
      const cellName = `${field.name}_${c.name}_${r}`;
      const req = c.required ? ' required' : '';
      switch (c.type) {
        case 'dropdown':
          const opts = (c.options || []).map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
          return `${indent}        <td class="p-2"><select class="form-select" name="${cellName}"${req}><option value="">Select...</option>${opts}</select></td>`;
        case 'checkbox':
          return `${indent}        <td class="p-2 text-center"><input type="checkbox" name="${cellName}"${req}></td>`;
        case 'calculated':
          return `${indent}        <td class="p-2"><input class="form-control" type="text" name="${cellName}" readonly tabindex="-1" style="background:var(--bgColor-muted,#161b22);color:var(--fgColor-muted,#848d97)"></td>`;
        default:
          return `${indent}        <td class="p-2"><input class="form-control" type="text" name="${cellName}" placeholder="${escapeHtml(c.header)}"${req}></td>`;
      }
    }).join('\n');
    const deleteBtn = `${indent}        <td class="p-2 text-center"><button type="button" class="btn-octicon color-fg-danger" onclick="deleteTableRow('${tableId}',this)" title="Delete row">✕</button></td>`;
    bodyRows += `${indent}      <tr data-row="${r}">\n${cells}\n${deleteBtn}\n${indent}      </tr>\n`;
  }

  return `${indent}<div class="mb-3">
${indent}  <label class="FormControl-label">${escapeHtml(field.label)}</label>
${indent}  <div class="overflow-auto">
${indent}    <table class="table-bordered width-full" id="${tableId}" data-field-name="${field.name}" data-columns="${colsData}" data-row-count="${rows}">
${indent}      <thead class="color-bg-subtle">
${indent}        <tr>
${header}
${indent}        </tr>
${indent}      </thead>
${indent}      <tbody>
${bodyRows}${indent}      </tbody>
${indent}    </table>
${indent}  </div>
${indent}  <div class="mt-2">
${indent}    <button type="button" class="btn btn-sm" onclick="addTableRow('${tableId}')">+ Add Row</button>
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
      sectionsHtml += `\n      <!-- ✅ SAFE TO EDIT: Section headings, text, and links -->
      <h3 class="h3 mb-3 pb-2 border-bottom">${escapeHtml(section.heading)}</h3>
      <!-- END SAFE TO EDIT -->\n`;
    }
    sectionsHtml += `      <!-- ⚠️ DO NOT EDIT: Form fields managed by adcgen. Use "adcgen edit" to change. -->\n`;
    for (const field of section.fields || []) {
      sectionsHtml += generateFieldHtml(field) + '\n';
    }
    sectionsHtml += `      <!-- END DO NOT EDIT -->\n`;
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

    <!-- You may add text, headings, and links around sections. Do NOT edit form fields — use "adcgen edit" instead. -->
    <form id="main-form">
${sectionsHtml}
    </form>

    <!-- Record navigation bar -->
    <div id="record-nav" style="display:none; margin-top:1rem; padding:0.75rem; background:var(--bgColor-muted,#161b22); border:1px solid var(--borderColor-default,#30363d); border-radius:6px;">
      <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" id="record-prev" class="btn btn-sm" disabled>← Prev</button>
        <span id="record-counter" style="font-size:13px; color:var(--fgColor-muted,#8b949e); min-width:80px; text-align:center;">— / —</span>
        <button type="button" id="record-next" class="btn btn-sm" disabled>Next →</button>
        <span style="flex:auto;"></span>
        <button type="button" id="record-new" class="btn btn-sm btn-primary">+ New Record</button>
      </div>
    </div>
  </div>

  <!-- ⚠️ DO NOT EDIT: Form submission and data loading scripts managed by adcgen -->
  <script>
    const FORM_NAME = '${formName}';
    let SESSION_ID = '${sessionId}';

    // Auto-detect API base: same origin in production, localhost:3001 in Eleventy dev
    const API_BASE = (location.port === '3001' || location.port === '80' || location.port === '443' || location.port === '')
      ? '' : 'http://localhost:3001';

    // Check URL for ?id= param to load existing data
    const urlParams = new URLSearchParams(window.location.search);
    const loadId = urlParams.get('id');
    if (loadId) SESSION_ID = loadId;

    // Table row management
    function addTableRow(tableId) {
      const table = document.getElementById(tableId);
      const tbody = table.querySelector('tbody');
      const fieldName = table.dataset.fieldName;
      const columns = JSON.parse(table.dataset.columns);
      const r = parseInt(table.dataset.rowCount);
      const tr = document.createElement('tr');
      tr.dataset.row = r;
      columns.forEach(function(c) {
        const td = document.createElement('td');
        td.className = 'p-2';
        const cellName = fieldName + '_' + c.name + '_' + r;
        if (c.type === 'dropdown') {
          const sel = document.createElement('select');
          sel.className = 'form-select'; sel.name = cellName;
          if (c.required) sel.required = true;
          let optHtml = '<option value="">Select...</option>';
          (c.options || []).forEach(function(o) { optHtml += '<option value="' + o + '">' + o + '</option>'; });
          sel.innerHTML = optHtml; td.appendChild(sel);
        } else if (c.type === 'checkbox') {
          td.className = 'p-2 text-center';
          const cb = document.createElement('input'); cb.type = 'checkbox'; cb.name = cellName;
          if (c.required) cb.required = true;
          td.appendChild(cb);
        } else if (c.type === 'calculated') {
          const inp = document.createElement('input'); inp.className = 'form-control';
          inp.type = 'text'; inp.name = cellName; inp.readOnly = true; inp.tabIndex = -1;
          inp.style.cssText = 'background:var(--bgColor-muted,#161b22);color:var(--fgColor-muted,#848d97)';
          td.appendChild(inp);
        } else {
          const inp = document.createElement('input'); inp.className = 'form-control';
          inp.type = 'text'; inp.name = cellName; inp.placeholder = c.header;
          if (c.required) inp.required = true;
          td.appendChild(inp);
        }
        tr.appendChild(td);
      });
      const delTd = document.createElement('td');
      delTd.className = 'p-2 text-center';
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'btn-octicon color-fg-danger';
      delBtn.title = 'Delete row'; delBtn.textContent = '\\u2715';
      delBtn.onclick = function() { deleteTableRow(tableId, this); };
      delTd.appendChild(delBtn); tr.appendChild(delTd);
      tbody.appendChild(tr);
      table.dataset.rowCount = r + 1;
    }

    function deleteTableRow(tableId, btn) {
      const table = document.getElementById(tableId);
      const tbody = table.querySelector('tbody');
      if (tbody.rows.length <= 1) return;
      btn.closest('tr').remove();
    }

    // Recalculate computed columns in a table row
    function recalcRow(table, tr) {
      const fieldName = table.dataset.fieldName;
      const columns = JSON.parse(table.dataset.columns);
      const rowIdx = tr.dataset.row;
      const vals = {};
      columns.forEach(function(c) {
        if (c.type === 'calculated') return;
        const el = tr.querySelector('[name="' + fieldName + '_' + c.name + '_' + rowIdx + '"]');
        if (el) vals[c.name] = el.type === 'checkbox' ? (el.checked ? 'Yes' : 'No') : (el.value || '');
      });
      columns.forEach(function(c) {
        if (c.type !== 'calculated' || !c.formula) return;
        const el = tr.querySelector('[name="' + fieldName + '_' + c.name + '_' + rowIdx + '"]');
        if (!el) return;
        try {
          var formula = c.formula;
          if (formula.startsWith('=')) {
            // Expression mode: JS expression with column names as variables
            var keys = Object.keys(vals);
            var fn = new Function(keys.join(','), 'return ' + formula.substring(1));
            var result = fn.apply(null, keys.map(function(k) { return vals[k]; }));
            el.value = (result == null ? '' : result);
          } else {
            // Template mode: replace {col_name} placeholders
            el.value = formula.replace(/\\{(\\w+)\\}/g, function(m, name) { return vals[name] || ''; });
          }
        } catch(e) { el.value = ''; }
      });
    }

    // Wire up input event delegation on tables with calculated columns
    document.querySelectorAll('table[data-field-name]').forEach(function(table) {
      var columns = JSON.parse(table.dataset.columns);
      if (!columns.some(function(c) { return c.type === 'calculated'; })) return;
      table.addEventListener('input', function(e) {
        var tr = e.target.closest('tr');
        if (tr) recalcRow(table, tr);
      });
      table.addEventListener('change', function(e) {
        var tr = e.target.closest('tr');
        if (tr) recalcRow(table, tr);
      });
    });

    // Populate form fields from a data object
    function populateForm(data) {
      const form = document.getElementById('main-form');
      for (const [key, value] of Object.entries(data)) {
        if (key === '_meta') continue;

        // Handle table data (arrays of objects)
        if (Array.isArray(value)) {
          const tableEl = document.querySelector('table[data-field-name="' + key + '"]');
          if (tableEl) {
            const tbody = tableEl.querySelector('tbody');
            // Clear existing rows and reset counter
            while (tbody.rows.length > 0) tbody.deleteRow(0);
            tableEl.dataset.rowCount = 0;
            // Filter out null entries from sparse arrays
            const dataRows = value.filter(function(r) { return r != null; });
            // Add the right number of rows
            for (let i = 0; i < Math.max(dataRows.length, 1); i++) {
              addTableRow(tableEl.id);
            }
            // Populate cells positionally
            const rows = tbody.rows;
            dataRows.forEach(function(row, idx) {
              if (row && typeof row === 'object' && idx < rows.length) {
                for (const [col, cellVal] of Object.entries(row)) {
                  const cellName = key + '_' + col + '_' + idx;
                  const el = rows[idx].querySelector('[name="' + cellName + '"]');
                  if (el) {
                    if (el.type === 'checkbox') el.checked = !!cellVal;
                    else el.value = cellVal;
                  }
                }
              }
            });
          }
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
      fetch(API_BASE + '/api/load?formName=' + FORM_NAME + '&id=' + loadId)
        .then(r => r.ok ? r.json() : null)
        .then(result => {
          if (result && result.data) {
            populateForm(result.data);
            // Recalculate computed columns after loading
            document.querySelectorAll('table[data-field-name]').forEach(function(table) {
              var cols = JSON.parse(table.dataset.columns);
              if (!cols.some(function(c) { return c.type === 'calculated'; })) return;
              table.querySelectorAll('tbody tr').forEach(function(tr) { recalcRow(table, tr); });
            });
          }
        })
        .catch(() => {});
    }

    // ─── DB Record Navigation ─────────────────────────────────
    let dbRecords = [];
    let currentRecordIdx = -1;
    const recordNav = document.getElementById('record-nav');
    const recordPrev = document.getElementById('record-prev');
    const recordNext = document.getElementById('record-next');
    const recordCounter = document.getElementById('record-counter');
    const recordNew = document.getElementById('record-new');

    async function loadRecordsFromDb() {
      try {
        const res = await fetch(API_BASE + '/api/db/records/' + FORM_NAME);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok || !data.records || data.records.length === 0) return;
        dbRecords = data.records;
        recordNav.style.display = '';
        // If we loaded a specific record by ?id=, find its index
        if (loadId) {
          const idx = dbRecords.findIndex(r => r.session_id === loadId);
          if (idx >= 0) currentRecordIdx = idx;
        }
        updateRecordNav();
      } catch {}
    }

    function updateRecordNav() {
      const total = dbRecords.length;
      const cur = currentRecordIdx >= 0 ? currentRecordIdx + 1 : '—';
      recordCounter.textContent = cur + ' / ' + total;
      recordPrev.disabled = currentRecordIdx <= 0;
      recordNext.disabled = currentRecordIdx >= total - 1 || currentRecordIdx < 0;
    }

    async function navigateRecord(direction) {
      const newIdx = currentRecordIdx + direction;
      if (newIdx < 0 || newIdx >= dbRecords.length) return;
      currentRecordIdx = newIdx;
      await displayRecord(dbRecords[newIdx].session_id);
      updateRecordNav();
    }

    async function displayRecord(sessionId) {
      try {
        const res = await fetch(API_BASE + '/api/db/record/' + FORM_NAME + '/' + sessionId);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok || !data.record) return;

        SESSION_ID = sessionId;
        // Reset form and clear table rows
        document.getElementById('main-form').reset();
        document.querySelectorAll('table[data-field-name] tbody').forEach(function(tb) { tb.innerHTML = ''; });

        populateForm(data.record);
        // Recalculate computed columns
        document.querySelectorAll('table[data-field-name]').forEach(function(table) {
          var cols = JSON.parse(table.dataset.columns);
          if (!cols.some(function(c) { return c.type === 'calculated'; })) return;
          table.querySelectorAll('tbody tr').forEach(function(tr) { recalcRow(table, tr); });
        });
      } catch {}
    }

    recordPrev.addEventListener('click', function() { navigateRecord(-1); });
    recordNext.addEventListener('click', function() { navigateRecord(1); });
    recordNew.addEventListener('click', function() {
      currentRecordIdx = -1;
      SESSION_ID = crypto.randomUUID ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).slice(2, 10);
      document.getElementById('main-form').reset();
      document.querySelectorAll('table[data-field-name] tbody').forEach(function(tb) { tb.innerHTML = ''; });
      document.querySelectorAll('table[data-field-name]').forEach(function(table) { addTableRow(table.id); });
      updateRecordNav();
    });

    // Load records from DB on page load (only if not loading a specific file-based record)
    if (!loadId) loadRecordsFromDb();

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

      // Compact sparse table arrays (from deleted rows)
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) {
          data[k] = data[k].filter(function(r) { return r != null; });
        }
      }

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
        const res = await fetch(API_BASE + '/api/save', {
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
