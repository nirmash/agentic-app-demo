const BOX = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
const WIDTH = 60;

function line(char = BOX.h) {
  return char.repeat(WIDTH);
}

function boxTop() { return BOX.tl + line() + BOX.tr; }
function boxBot() { return BOX.bl + line() + BOX.br; }
function boxRow(text) {
  const padded = text.padEnd(WIDTH);
  return BOX.v + padded.substring(0, WIDTH) + BOX.v;
}
function emptyRow() { return boxRow(''); }

function renderTextField(field) {
  const lines = [];
  const req = field.required ? ' *' : '';
  lines.push(boxRow(` ${field.label}${req}`));
  lines.push(boxRow(` ┌${'─'.repeat(WIDTH - 4)}┐`));
  const placeholder = field.placeholder || '';
  lines.push(boxRow(` │ ${placeholder.padEnd(WIDTH - 6)}│`));
  lines.push(boxRow(` └${'─'.repeat(WIDTH - 4)}┘`));
  return lines;
}

function renderDropdown(field) {
  const lines = [];
  const req = field.required ? ' *' : '';
  lines.push(boxRow(` ${field.label}${req}`));
  const opts = (field.options || []).slice(0, 3).join(' | ');
  lines.push(boxRow(` ┌${'─'.repeat(WIDTH - 6)}▼┐`));
  lines.push(boxRow(` │ ${opts.padEnd(WIDTH - 6)}│`));
  lines.push(boxRow(` └${'─'.repeat(WIDTH - 4)}┘`));
  return lines;
}

function renderCheckbox(field) {
  const lines = [];
  if (field.options && field.options.length > 0) {
    lines.push(boxRow(` ${field.label}`));
    for (const opt of field.options.slice(0, 4)) {
      lines.push(boxRow(`   ☐ ${opt}`));
    }
  } else {
    lines.push(boxRow(`   ☐ ${field.label}`));
  }
  return lines;
}

function renderRadio(field) {
  const lines = [];
  lines.push(boxRow(` ${field.label}`));
  for (const opt of (field.options || []).slice(0, 4)) {
    lines.push(boxRow(`   ◯ ${opt}`));
  }
  return lines;
}

function renderButton(field) {
  const label = field.label || 'Button';
  const pad = Math.max(0, Math.floor((WIDTH - label.length - 6) / 2));
  const lines = [];
  lines.push(emptyRow());
  lines.push(boxRow(' '.repeat(pad) + `[ ${label} ]`));
  lines.push(emptyRow());
  return lines;
}

function renderTable(field) {
  const lines = [];
  lines.push(boxRow(` ${field.label}`));
  const cols = field.columns || [];
  const colWidth = Math.max(8, Math.floor((WIDTH - 2) / Math.max(cols.length, 1)) - 1);

  // Header
  let header = ' ';
  for (const col of cols) {
    header += col.header.substring(0, colWidth).padEnd(colWidth) + '│';
  }
  lines.push(boxRow(header));
  lines.push(boxRow(' ' + ('─'.repeat(colWidth) + '┼').repeat(cols.length)));

  // Sample rows
  const rowCount = field.initialRows || 2;
  for (let r = 0; r < Math.min(rowCount, 3); r++) {
    let row = ' ';
    for (const col of cols) {
      const placeholder = col.type === 'checkbox' ? '☐' : col.type === 'dropdown' ? '▼ ...' : '___';
      row += placeholder.padEnd(colWidth) + '│';
    }
    lines.push(boxRow(row));
  }
  return lines;
}

export function renderAsciiPreview(spec) {
  const output = [];

  output.push('');
  output.push(boxTop());
  // Title
  const titlePad = Math.max(0, Math.floor((WIDTH - spec.title.length) / 2));
  output.push(boxRow(' '.repeat(titlePad) + spec.title));
  output.push(boxRow(line('━')));
  output.push(emptyRow());

  for (const section of spec.sections || []) {
    if (section.heading) {
      output.push(boxRow(` ■ ${section.heading}`));
      output.push(boxRow(` ${'─'.repeat(section.heading.length + 2)}`));
    }

    for (const field of section.fields || []) {
      switch (field.type) {
        case 'text':     output.push(...renderTextField(field)); break;
        case 'dropdown': output.push(...renderDropdown(field)); break;
        case 'checkbox': output.push(...renderCheckbox(field)); break;
        case 'radio':    output.push(...renderRadio(field)); break;
        case 'button':   output.push(...renderButton(field)); break;
        case 'table':    output.push(...renderTable(field)); break;
        case 'link':     output.push(boxRow(` 🔗 ${field.label} → ${field.href || '#'}`)); break;
        default:         output.push(...renderTextField(field)); break;
      }
      output.push(emptyRow());
    }
  }

  output.push(boxBot());
  output.push('');

  return output.join('\n');
}
