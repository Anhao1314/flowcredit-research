#!/usr/bin/env node
/* Bundles the deterministic v0.2.1 engine from agent/src into one classic script
   for the zero-build static site. agent/src stays the only source of truth:
   never edit assets/js/risk-engine-v021.js by hand, rerun this script instead.
   Usage: node scripts/build-browser-engine.mjs [--check] */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AGENT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPOSITORY_ROOT = resolve(AGENT_ROOT, "..");
const SOURCE_ROOT = resolve(AGENT_ROOT, "src");
const OUTPUT_PATH = resolve(REPOSITORY_ROOT, "assets/js/risk-engine-v021.js");

/* normalize-v021.js is part of the deterministic path even though the risk core
   does not import it: the caller composes normalizeEvidenceV021 + computeRiskV021. */
const ENTRY_MODULES = ["normalize-v021.js", "risk-core-v021.js", "intake-v03.js"];
const SANDBOX_MODULES = new Map([["node:crypto", ["createHash"]]]);
const API_BINDINGS = [
  ["normalize-v021.js", ["normalizeEvidenceV021"]],
  ["rules-v021.js", ["RULE_VERSION_V021"]],
  ["risk-core-v021.js", ["computeRiskV021"]],
  ["intake-v03.js", ["PRODUCT_VERSION_V03", "validateDraftV03", "buildEvidenceCoverageV03", "buildRequiredActionsV03"]]
];
const IMPORT_PATTERN = /^import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?[ \t]*$/gm;
const EXPORT_PATTERN = /^export\s+(const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm;
const DECLARATION_PATTERN = /^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm;

/* The engine modules run unmodified: only ESM syntax is rewritten into a module
   registry, and the two Node-only facilities are replaced by equivalents. */
const PRELUDE = `  var __shims = { createHash: createHash };
  function __utf8(text) {
    var value = String(text);
    if (typeof TextEncoder === "function") { return new TextEncoder().encode(value); }
    var bytes = [];
    for (var i = 0; i < value.length; i += 1) {
      var code = value.charCodeAt(i);
      if (code < 0x80) { bytes.push(code); continue; }
      if (code < 0x800) { bytes.push(192 | (code >> 6), 128 | (code & 63)); continue; }
      if (code >= 0xd800 && code <= 0xdbff) {
        var low = value.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          var point = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          bytes.push(240 | (point >> 18), 128 | ((point >> 12) & 63), 128 | ((point >> 6) & 63), 128 | (point & 63));
          i += 1;
          continue;
        }
        bytes.push(239, 191, 189);
        continue;
      }
      if (code >= 0xdc00 && code <= 0xdfff) { bytes.push(239, 191, 189); continue; }
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
    return bytes;
  }
  function __rotateRight(value, bits) { return ((value >>> bits) | (value << (32 - bits))) >>> 0; }
  function __sha256Hex(message) {
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var bytes = __utf8(message), length = bytes.length;
    var total = (((length + 9) + 63) >> 6) << 6;
    var buffer = new Uint8Array(total);
    buffer.set(bytes);
    buffer[length] = 0x80;
    var highBits = Math.floor(length / 536870912), lowBits = (length * 8) >>> 0;
    buffer[total - 8] = (highBits >>> 24) & 255; buffer[total - 7] = (highBits >>> 16) & 255;
    buffer[total - 6] = (highBits >>> 8) & 255; buffer[total - 5] = highBits & 255;
    buffer[total - 4] = (lowBits >>> 24) & 255; buffer[total - 3] = (lowBits >>> 16) & 255;
    buffer[total - 2] = (lowBits >>> 8) & 255; buffer[total - 1] = lowBits & 255;
    var hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var words = new Uint32Array(64);
    for (var offset = 0; offset < total; offset += 64) {
      for (var i = 0; i < 16; i += 1) {
        words[i] = ((buffer[offset + i * 4] << 24) | (buffer[offset + i * 4 + 1] << 16) |
          (buffer[offset + i * 4 + 2] << 8) | buffer[offset + i * 4 + 3]) >>> 0;
      }
      for (i = 16; i < 64; i += 1) {
        var w15 = words[i - 15], w2 = words[i - 2];
        var s0 = (__rotateRight(w15, 7) ^ __rotateRight(w15, 18) ^ (w15 >>> 3)) >>> 0;
        var s1 = (__rotateRight(w2, 17) ^ __rotateRight(w2, 19) ^ (w2 >>> 10)) >>> 0;
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
      }
      var a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
      for (i = 0; i < 64; i += 1) {
        var sigma1 = (__rotateRight(e, 6) ^ __rotateRight(e, 11) ^ __rotateRight(e, 25)) >>> 0;
        var choice = ((e & f) ^ (~e & g)) >>> 0;
        var temp1 = (h + sigma1 + choice + K[i] + words[i]) >>> 0;
        var sigma0 = (__rotateRight(a, 2) ^ __rotateRight(a, 13) ^ __rotateRight(a, 22)) >>> 0;
        var majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (sigma0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0; hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0; hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0;
    }
    var out = "";
    for (i = 0; i < 8; i += 1) { out += ("00000000" + hash[i].toString(16)).slice(-8); }
    return out;
  }
  function createHash(algorithm) {
    if (String(algorithm).toLowerCase() !== "sha256") { throw new Error("browser engine supports sha256 only"); }
    var chunks = [];
    return {
      update: function (chunk) { chunks.push(typeof chunk === "string" ? chunk : String(chunk)); return this; },
      digest: function (encoding) {
        if (encoding !== "hex") { throw new Error("browser engine supports hex digests only"); }
        return __sha256Hex(chunks.join(""));
      }
    };
  }
  var structuredClone = (typeof globalThis.structuredClone === "function")
    ? globalThis.structuredClone
    : function (value) { return JSON.parse(JSON.stringify(value === undefined ? null : value)); };
  var process = { env: {} };`;

function header(names) {
  return [
    "/* AUTO-GENERATED by agent/scripts/build-browser-engine.mjs. Do not edit by hand.",
    "   Deterministic v0.2.1 risk engine for the zero-build static site: the module",
    "   list below is bundled verbatim from agent/src, with ESM syntax rewritten and",
    "   the hashing builtin replaced by a small synchronous sha256. Rerun the generator after",
    "   any engine change; agent/test/browser-engine-equivalence.test.js fails when",
    "   this file and agent/src drift apart.",
    `   Sources: ${names.join(", ")} */`
  ].join("\n");
}

function parseImports(source, name) {
  const imports = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const clause = match[1].trim(), specifier = match[2];
    const braced = /^\{([\s\S]*)\}$/.exec(clause);
    if (!braced) throw new Error(`${name}: unsupported import form "${clause}"`);
    const names = braced[1].split(",").map(entry => entry.trim()).filter(Boolean);
    const sandbox = SANDBOX_MODULES.has(specifier);
    if (!sandbox && !specifier.startsWith("./")) throw new Error(`${name}: unsupported specifier "${specifier}"`);
    imports.push({ specifier, names, sandbox });
  }
  return imports;
}

function transform(name, raw) {
  if (/^export\s+default\b/m.test(raw) || /^export\s*\{/m.test(raw)) {
    throw new Error(`${name}: unsupported export form`);
  }
  const imports = parseImports(raw, name);
  const exports = [...raw.matchAll(EXPORT_PATTERN)].map(match => match[2]);
  if (!exports.length) throw new Error(`${name}: no exports found`);
  const body = raw
    .replace(IMPORT_PATTERN, "")
    .replace(EXPORT_PATTERN, (match, kind, identifier) => `${kind} ${identifier}`)
    .replace(/^\n+/, "");
  if (/^\s*(import|export)\b/m.test(body)) throw new Error(`${name}: ESM syntax survived the rewrite`);
  const declared = new Set();
  for (const match of body.matchAll(DECLARATION_PATTERN)) {
    if (declared.has(match[1])) throw new Error(`${name}: duplicate top-level declaration "${match[1]}"`);
    declared.add(match[1]);
  }
  for (const entry of exports) if (!declared.has(entry)) throw new Error(`${name}: export "${entry}" has no declaration`);
  return { imports, exports, body };
}

async function collectModules() {
  const modules = new Map();
  const pending = [...ENTRY_MODULES];
  while (pending.length) {
    const name = pending.pop();
    if (modules.has(name)) continue;
    const raw = await readFile(resolve(SOURCE_ROOT, name), "utf8");
    const parsed = transform(name, raw);
    modules.set(name, parsed);
    for (const entry of parsed.imports) if (!entry.sandbox) pending.push(entry.specifier.replace(/^\.\//, ""));
  }
  return modules;
}

function orderModules(modules) {
  const order = [];
  const seen = new Set();
  const visit = (name, trail) => {
    if (seen.has(name)) return;
    if (trail.includes(name)) throw new Error(`import cycle: ${[...trail, name].join(" -> ")}`);
    const entry = modules.get(name);
    if (!entry) throw new Error(`missing module ${name}`);
    for (const item of entry.imports) if (!item.sandbox) visit(item.specifier.replace(/^\.\//, ""), [...trail, name]);
    seen.add(name);
    order.push(name);
  };
  for (const name of ENTRY_MODULES) visit(name, []);
  return order;
}

function renderModule(name, entry) {
  const lines = [`  __modules[${JSON.stringify(name)}] = (function () {`];
  for (const item of entry.imports) {
    const source = item.sandbox ? "__shims" : `__modules[${JSON.stringify(item.specifier.replace(/^\.\//, ""))}]`;
    lines.push(`    const { ${item.names.join(", ")} } = ${source};`);
  }
  const body = entry.body.replace(/\n+$/, "").split("\n");
  for (const line of body) lines.push(line.trim() ? `    ${line}` : "");
  lines.push(`    return { ${entry.exports.join(", ")} };`);
  lines.push("  })();");
  return lines.join("\n");
}

function renderApi(modules) {
  const bindings = [];
  for (const [name, names] of API_BINDINGS) {
    const entry = modules.get(name);
    if (!entry) throw new Error(`API binding needs module ${name}, which is not bundled`);
    for (const item of names) if (!entry.exports.includes(item)) throw new Error(`${name} does not export ${item}`);
    bindings.push(`  var { ${names.join(", ")} } = __modules[${JSON.stringify(name)}];`);
  }
  return [
    ...bindings,
    "  var FC_RISK = Object.freeze({",
    "    ruleVersion: RULE_VERSION_V021,",
    "    productVersion: PRODUCT_VERSION_V03,",
    "    validateDraft: function (draft) { return validateDraftV03(draft); },",
    "    assess: function (input) {",
    "      const normalized = normalizeEvidenceV021(input);",
    "      return { normalized: normalized, result: computeRiskV021(normalized) };",
    "    },",
    "    assessDraft: function (draft) {",
    "      const validation = validateDraftV03(draft);",
    "      const normalized = normalizeEvidenceV021(validation.draft);",
    "      return { validation: validation, normalized: normalized, result: computeRiskV021(normalized) };",
    "    },",
    "    coverage: function (draft) { return buildEvidenceCoverageV03(draft); },",
    "    requiredActions: function (validation, result, coverage) { return buildRequiredActionsV03(validation, result, coverage); }",
    "  });",
    "  __global.FC_RISK = FC_RISK;"
  ].join("\n");
}

export async function buildBrowserEngineSource() {
  const modules = await collectModules();
  const order = orderModules(modules);
  const parts = [
    header(order),
    "(function () {",
    '  "use strict";',
    '  var __global = (typeof globalThis !== "undefined") ? globalThis : this;',
    PRELUDE,
    "  var __modules = {};",
    ...order.map(name => renderModule(name, modules.get(name))),
    renderApi(modules),
    "})();",
    ""
  ];
  return parts.join("\n");
}

async function main() {
  const source = await buildBrowserEngineSource();
  const check = process.argv.includes("--check");
  if (check) {
    const current = await readFile(OUTPUT_PATH, "utf8").catch(() => "");
    if (current !== source) {
      process.stderr.write("FAIL assets/js/risk-engine-v021.js is stale; rerun node scripts/build-browser-engine.mjs\n");
      process.exit(1);
    }
    process.stdout.write("PASS browser engine matches agent/src\n");
    return;
  }
  await writeFile(OUTPUT_PATH, source);
  process.stdout.write(`Wrote ${OUTPUT_PATH}\n`);
}

const invokedDirectly = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (invokedDirectly) await main();
