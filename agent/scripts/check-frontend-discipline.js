import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// UI-2.0 frontend discipline. The only active product UI is research/surface.
// It remains server-first, read-only and dependency-free in the browser.

const AGENT_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const REPOSITORY_ROOT = resolve(AGENT_ROOT, "..");
const SURFACE_ROOT = resolve(REPOSITORY_ROOT, "research/surface");
const PUBLIC_ROOT = resolve(SURFACE_ROOT, "public");
const RENDER_ROOT = resolve(SURFACE_ROOT, "render");

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

const violations=[];
const fail=(file,rule)=>violations.push({file,rule});

for(const legacy of ["index.html","assets/styles.css","assets/js","assets/img/logo.png"]){
  if(await exists(resolve(REPOSITORY_ROOT,legacy))) fail(legacy,"legacy frontend must not return after UI-2.0");
}

const browserJs=await readFile(resolve(PUBLIC_ROOT,"surface.js"),"utf8");
for(const [pattern,rule] of [
  [/\bfetch\s*\(/,"browser JS must not fetch"],
  [/localStorage|sessionStorage|indexedDB/,"browser JS must not persist state"],
  [/XMLHttpRequest|WebSocket|EventSource/,"browser JS must not open network channels"],
  [/https?:\/\//,"browser JS must not reference external origins"]
]){
  if(pattern.test(browserJs)) fail("research/surface/public/surface.js",rule);
}

const css=await readFile(resolve(PUBLIC_ROOT,"surface.css"),"utf8");
if(/@import\b|url\(\s*['"]?https?:/i.test(css)) fail("research/surface/public/surface.css","surface CSS must use no remote asset or import");
if(!/:focus-visible/.test(css)) fail("research/surface/public/surface.css","keyboard focus style is required");
if(!/prefers-reduced-motion/.test(css)) fail("research/surface/public/surface.css","reduced-motion guard is required");

const layout=await readFile(resolve(RENDER_ROOT,"layout.js"),"utf8");
for(const marker of ["Inbox","Beliefs","Review","Evidence","Timeline","Research Workbench","READ ONLY","AI OFF"]){
  assert.ok(layout.includes(marker),`UI-2.0 layout missing marker: ${marker}`);
}
if(/style="/.test(layout)) fail("research/surface/render/layout.js","inline styles are forbidden by the strict CSP");
if(!/Content-Security-Policy/.test(await readFile(resolve(SURFACE_ROOT,"routes.js"),"utf8"))) fail("research/surface/routes.js","strict CSP header must remain");

for(const name of (await readdir(RENDER_ROOT)).filter(name=>name.endsWith(".js"))){
  const source=await readFile(resolve(RENDER_ROOT,name),"utf8");
  if(/style="/.test(source)) fail(`research/surface/render/${name}`,"inline style emitted by renderer");
}

if(violations.length){
  for(const item of violations) process.stderr.write(`${item.file}\n  ${item.rule}\n`);
  process.stderr.write(`FAIL UI-2.0 frontend discipline: ${violations.length} violation(s)\n`);
  process.exit(1);
}
process.stdout.write("PASS UI-2.0 frontend discipline: one active Workbench, read-only browser, strict CSP\n");
