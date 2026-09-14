#!/usr/bin/env node
// FlowCredit Local Research Surface (UI-1).
//
// Development-only, read-only, loopback-only, AI-off surface for the real
// Research Memory. No build step, no npm dependencies, no client fetch.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { MemorySource, loadDemoCases, resolveDemoDir, resolveMemoryPath } from './data-source.js';
import { createRouter } from './routes.js';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4317;

export function createSurfaceServer({ memoryPath = resolveMemoryPath(), demoDir = resolveDemoDir(), demoFallback = undefined, log = console } = {}) {
  let memoryState = null;
  const getMemory = () => {
    if (!memoryState) {
      try {
        memoryState = { source: MemorySource.open(memoryPath) };
      } catch (error) {
        memoryState = { error };
        log.error(`[surface] Research Memory unavailable (${error?.code ?? error?.name}): ${error?.message ?? error}`);
      }
    }
    return memoryState;
  };
  let demoState = null;
  const getDemoData = () => {
    if (!demoState) demoState = loadDemoCases(demoFallback ? { dir: demoDir, fallback: demoFallback } : { dir: demoDir });
    return demoState;
  };

  const handle = createRouter({ getMemory, getDemoData, log });
  const server = createServer((req, res) => {
    try {
      handle(req, res);
    } catch (error) {
      log.error(`[surface] unhandled error: ${error?.stack ?? error}`);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Surface error\n');
    }
  });
  server.on('close', () => {
    memoryState?.source?.close();
    memoryState = null;
  });
  server.memoryInfo = { path: memoryPath };
  return server;
}

export async function startSurface({ port = DEFAULT_PORT, host = DEFAULT_HOST, memoryPath = resolveMemoryPath(), demoDir = resolveDemoDir(), demoFallback = undefined, log = console } = {}) {
  const server = createSurfaceServer({ memoryPath, demoDir, demoFallback, log });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const url = `http://${host}:${address.port}`;
  log.log(`FlowCredit Research Surface\n${url}\nAI runtime: OFF\nMode: REAL`);
  log.log(`Data source: ${memoryPath} (read-only)\nDemo mode: add ?demo=1 for v0.12 locked synthetic cases`);
  return { server, url, port: address.port };
}

export function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--port') {
      const value = argv[index + 1];
      if (!/^\d+$/.test(value ?? '')) throw new Error('--port requires a numeric value');
      options.port = Number(value);
      index += 1;
    } else if (argument.startsWith('--port=')) {
      const value = argument.slice('--port='.length);
      if (!/^\d+$/.test(value)) throw new Error('--port requires a numeric value');
      options.port = Number(value);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

const HELP = `Usage: node research/surface/server.js [--port 4317]

FlowCredit Local Research Surface (development-only, read-only, AI-off).
Binds 127.0.0.1 only. Reads Research Memory read-only.
Environment:
  FC_SURFACE_MEMORY_DB  Research Memory SQLite file (default: ~/fc-agent/research-memory)
  FC_SURFACE_DEMO_DIR   v0.12 locked runtime directory for ?demo=1 (default: ~/fc-agent/research-claim-revision/locked)`;

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${HELP}\n`);
    process.exit(2);
  }
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const port = options.port ?? (process.env.FC_SURFACE_PORT ? Number(process.env.FC_SURFACE_PORT) : DEFAULT_PORT);
  try {
    const { server } = await startSurface({ port, memoryPath: resolveMemoryPath() });
    const shutdown = () => {
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      process.stderr.write(`Port ${port} is already in use. Start with: node research/surface/server.js --port 4318\n`);
    } else {
      process.stderr.write(`Failed to start surface: ${error?.message ?? error}\n`);
    }
    process.exit(1);
  }
}
