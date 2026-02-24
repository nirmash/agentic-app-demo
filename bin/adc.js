#!/usr/bin/env node
// adc — MCP client CLI for Azure Dev Compute (ADC)
// Usage: adc <sandbox_id> <command> [payload]
//        adc --config               # show/edit config
//        adc --list-commands        # list available MCP commands

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(process.env.HOME, '.adcgen');
const CONFIG_FILE = path.join(CONFIG_DIR, 'adc-config.json');

const DEFAULT_CONFIG = {
  endpoint: 'https://management.azuredevcompute.io/mcp/sse',
  apiKey: ''
};

// All known ADC MCP commands and their parameter schemas
const COMMANDS = {
  list_disk_images:              { params: [] },
  get_disk_image:                { params: ['diskImageId'] },
  create_disk_image:             { params: ['imageRef'] },
  create_sandbox:                { params: ['diskImageId'], optional: ['cpuMillicores', 'memoryMB'] },
  delete_sandbox:                { params: ['sandboxId'] },
  execute_command:               { params: ['sandboxId', 'command'], optional: ['workingDirectory'] },
  list_ports:                    { params: ['sandboxId'] },
  add_port:                      { params: ['sandboxId', 'port'], optional: ['name', 'anonymous', 'protocol', 'activationMode'] },
  remove_port:                   { params: ['sandboxId', 'port'] },
  create_static_site:            { params: ['zipBase64'] }
};

// ─── Config ─────────────────────────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function initConfig() {
  const config = loadConfig();
  if (!config.apiKey) {
    console.error('❌ No API key configured.');
    console.error(`   Edit ${CONFIG_FILE} and set "apiKey".\n`);
    console.error(`   Example:\n   ${JSON.stringify({ ...DEFAULT_CONFIG, apiKey: 'your-api-key-here' }, null, 2)}`);
    process.exit(1);
  }
  return config;
}

// ─── MCP Client ─────────────────────────────────────────────────

let requestId = 1;

async function mcpCall(config, method, args) {
  const fetch = (await import('node-fetch')).default;

  const body = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: { name: method, arguments: args }
  };

  const res = await fetch(config.endpoint, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'X-API-Key': config.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  // Parse SSE response: extract JSON from "data:" lines
  const text = await res.text();
  const dataLine = text.split('\n').find(l => l.startsWith('data: '));
  if (!dataLine) {
    throw new Error(`Unexpected response format:\n${text.substring(0, 500)}`);
  }

  const data = JSON.parse(dataLine.slice(6));
  if (data.error) {
    throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
  }
  return data.result;
}

// ─── Payload parsing ────────────────────────────────────────────

function parsePayload(raw) {
  if (!raw) return {};

  // If it's a file path that exists, read it
  if (fs.existsSync(raw)) {
    const content = fs.readFileSync(raw, 'utf-8').trim();
    try {
      return JSON.parse(content);
    } catch {
      // Not JSON — treat as a single string value (used for execute_command)
      return { _raw: content };
    }
  }

  // Try parsing as JSON
  try {
    return JSON.parse(raw);
  } catch {
    // Treat as a single string value
    return { _raw: raw };
  }
}

// ─── Build arguments ────────────────────────────────────────────

function buildArgs(command, sandboxId, payload) {
  const schema = COMMANDS[command];
  if (!schema) {
    throw new Error(`Unknown command: ${command}\nRun: adc --list-commands`);
  }

  const args = {};

  // Auto-inject sandboxId if the command needs it and we have one
  if (schema.params.includes('sandboxId') && sandboxId !== '-') {
    args.sandboxId = sandboxId;
  }

  // If payload has _raw, map it to the first non-sandboxId required param
  if (payload._raw !== undefined) {
    const target = schema.params.find(p => p !== 'sandboxId');
    if (target) args[target] = payload._raw;
  } else {
    // Merge payload object into args
    Object.assign(args, payload);
  }

  // Validate required params
  for (const p of schema.params) {
    if (!(p in args)) {
      throw new Error(`Missing required parameter: ${p}\nCommand ${command} requires: ${schema.params.join(', ')}`);
    }
  }

  // Coerce numeric params
  if (args.port) args.port = parseInt(args.port, 10);
  if (args.cpuMillicores) args.cpuMillicores = parseInt(args.cpuMillicores, 10);
  if (args.memoryMB) args.memoryMB = parseInt(args.memoryMB, 10);

  return args;
}

// ─── CLI ────────────────────────────────────────────────────────

function showUsage() {
  console.log(`
adc — MCP client for Azure Dev Compute

Usage:
  adc <sandbox_id> <command> [payload]    Execute an MCP command
  adc - <command> [payload]               Command that doesn't need a sandbox ID
  adc --list-commands                     List all available commands
  adc --config                            Show config file location and contents

Payload:
  • JSON string:  '{"diskImageId":"abc-123","cpuMillicores":2000}'
  • File path:    ./params.json  (reads file contents as JSON)
  • Plain string: "ls -la /app"  (mapped to the first required param)

Examples:
  adc - list_disk_images
  adc - create_sandbox '{"diskImageId":"abc-123"}'
  adc abc-123 execute_command "ls -la /app"
  adc abc-123 add_port '{"port":80,"anonymous":true}'
  adc abc-123 list_ports
  adc abc-123 delete_sandbox

Config: ${CONFIG_FILE}
`);
}

function listCommands() {
  console.log('\nAvailable ADC MCP commands:\n');
  for (const [name, schema] of Object.entries(COMMANDS)) {
    const required = schema.params.join(', ');
    const optional = (schema.optional || []).join(', ');
    const optStr = optional ? ` [optional: ${optional}]` : '';
    console.log(`  ${name.padEnd(28)} params: ${required || '(none)'}${optStr}`);
  }
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  if (args.includes('--list-commands')) {
    listCommands();
    process.exit(0);
  }

  if (args.includes('--config')) {
    const config = loadConfig();
    if (!fs.existsSync(CONFIG_FILE)) {
      saveConfig(config);
      console.log(`Created config: ${CONFIG_FILE}`);
    } else {
      console.log(`Config: ${CONFIG_FILE}`);
    }
    console.log(JSON.stringify(config, null, 2));
    process.exit(0);
  }

  if (args.length < 2) {
    console.error('Usage: adc <sandbox_id> <command> [payload]');
    process.exit(1);
  }

  const config = initConfig();
  const [sandboxId, command, ...rest] = args;
  const payloadRaw = rest.join(' ') || null;
  const payload = parsePayload(payloadRaw);

  try {
    const mcpArgs = buildArgs(command, sandboxId, payload);
    const result = await mcpCall(config, command, mcpArgs);

    // Check for MCP-level error in result
    if (result.isError) {
      const msg = result.content?.map(c => c.text).join('\n') || 'Unknown error';
      console.error(`❌ ${msg}`);
      process.exit(1);
    }

    // Pretty-print result
    if (result && typeof result === 'object') {
      // Handle MCP tool result format (content array)
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            try {
              console.log(JSON.stringify(JSON.parse(item.text), null, 2));
            } catch {
              console.log(item.text);
            }
          }
        }
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      console.log(result);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

main();
