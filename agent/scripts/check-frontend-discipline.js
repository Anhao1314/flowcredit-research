import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Static enforcement of the AGENTS.md frontend rules that were previously checked by hand:
// fetch stays in the gated live controller, the zero-build loading model stays intact,
// no emoji reaches the UI, and no audit wording reaches user-visible copy.

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)), "..");
const FRONTEND_ROOT = resolve(REPOSITORY_ROOT, "assets/js");
const ENTRY_HTML = resolve(REPOSITORY_ROOT, "index.html");
const STYLESHEET = resolve(REPOSITORY_ROOT, "assets/styles.css");
const LIVE_CONTROLLER = "view-ai-live.js";

const violations = [];
function fail(file, line, rule, text) {
  violations.push({ file, line, rule, text: String(text).trim().slice(0, 140) });
}

// Internal identifiers that AGENTS.md §1.1 explicitly allows in code.
const ALLOWED_AUDIT_FORMS = [
  /#\/audit/g,
  /view-audit/g,
  /run-audit|reset-audit|audit-report-btn/g,
  /auditStage|auditDone|auditToastFor|auditToast/g,
  /\b(?:run|reset)Audit\b/g,
  /(["'`])audit\1/g,
  /\baudit\s*:/g,
  /\|audit\|/g,
  /\bviews\.audit\b/g,
  /statutory audit/gi,
  /audit opinion/gi
];

const ALLOWED_SYMBOLS = new Set([..."→←↑↓↗↘↔…✓✗·×—–±σ≈≤≥‰°∙"]);
const EMOJI_RANGES = [[0x1f000, 0x1faff], [0x1f1e6, 0x1f1ff], [0x2600, 0x27bf], [0x2b00, 0x2bff], [0xfe00, 0xfe0f], [0x2190, 0x21ff]];

function blankBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, " "));
}

function stripLineComment(line) {
  const index = line.indexOf("//");
  if (index < 0) return line;
  return (line.slice(0, index).match(/["'`]/g) || []).length % 2 === 0 ? line.slice(0, index) : line;
}

function emojiIn(line) {
  const found = new Set();
  for (const character of line) {
    if (ALLOWED_SYMBOLS.has(character)) continue;
    const code = character.codePointAt(0);
    if (EMOJI_RANGES.some(([low, high]) => code >= low && code <= high)) found.add(character);
  }
  return [...found];
}

async function frontendFiles() {
  return (await readdir(FRONTEND_ROOT)).filter(name => name.endsWith(".js")).sort();
}

async function checkFrontend() {
  for (const name of await frontendFiles()) {
    const raw = await readFile(resolve(FRONTEND_ROOT, name), "utf8");
    const lines = blankBlockComments(raw).split("\n");
    lines.forEach((rawLine, index) => {
      const line = stripLineComment(rawLine);
      const position = index + 1;

      if (name !== LIVE_CONTROLLER && /\bfetch\s*\(/.test(line)) {
        fail(`assets/js/${name}`, position, "fetch is only allowed in view-ai-live.js", rawLine);
      }
      if (name !== LIVE_CONTROLLER && /\/fc\/ai\//.test(line)) {
        fail(`assets/js/${name}`, position, "same-origin /fc/ai/ calls are only allowed in view-ai-live.js", rawLine);
      }
      if (/\btype\s*=\s*["']module["']|\bdefer\b|\brequire\s*\(|^\s*import\s+[\w{*"']|^\s*export\s/.test(line)) {
        fail(`assets/js/${name}`, position, "zero-build loading model: no module, defer, import, export or require", rawLine);
      }
      if (/https?:\/\//.test(line)) {
        fail(`assets/js/${name}`, position, "no external URL or CDN reference", rawLine);
      }

      const emoji = emojiIn(line);
      if (emoji.length) fail(`assets/js/${name}`, position, `emoji are not allowed in the UI: ${emoji.join(" ")}`, rawLine);

      let remaining = line;
      for (const pattern of ALLOWED_AUDIT_FORMS) remaining = remaining.replace(pattern, " ");
      if (/audit/i.test(remaining)) {
        fail(`assets/js/${name}`, position, "user-visible copy must use risk assessment wording, not audit", rawLine);
      }
    });
  }
}

async function checkEntryHtml() {
  const raw = await readFile(ENTRY_HTML, "utf8");
  const lines = blankBlockComments(raw).split("\n");
  lines.forEach((rawLine, index) => {
    const line = stripLineComment(rawLine);
    const position = index + 1;
    if (/\btype\s*=\s*["']module["']|\bdefer\b/.test(line)) {
      fail("index.html", position, "zero-build loading model: no module or defer", rawLine);
    }
    if (/https?:\/\//.test(line)) fail("index.html", position, "no external URL or CDN reference", rawLine);
    const emoji = emojiIn(line);
    if (emoji.length) fail("index.html", position, `emoji are not allowed in the UI: ${emoji.join(" ")}`, rawLine);
    let remaining = line;
    for (const pattern of ALLOWED_AUDIT_FORMS) remaining = remaining.replace(pattern, " ");
    if (/audit/i.test(remaining)) fail("index.html", position, "user-visible copy must use risk assessment wording, not audit", rawLine);
  });
}

async function checkStylesheet() {
  const raw = await readFile(STYLESHEET, "utf8");
  blankBlockComments(raw).split("\n").forEach((line, index) => {
    const emoji = emojiIn(line);
    if (emoji.length) fail("assets/styles.css", index + 1, `emoji are not allowed in the UI: ${emoji.join(" ")}`, line);
  });
}

async function checkDisclaimerIsPreserved() {
  // The stripping above tolerates "statutory audit" only because the mandated disclaimer uses it;
  // assert it still exists so the allowlist cannot quietly hide its removal.
  const shell = await readFile(resolve(FRONTEND_ROOT, "app.js"), "utf8");
  if (!/not a statutory audit/i.test(shell)) {
    fail("assets/js/app.js", 0, "the global footer must keep the non-audit disclaimer", "not a statutory audit");
  }
}

await checkFrontend();
await checkEntryHtml();
await checkStylesheet();
await checkDisclaimerIsPreserved();

const scanned = (await frontendFiles()).length + 2;
if (violations.length) {
  for (const item of violations) {
    process.stderr.write(`${item.file}:${item.line} [${item.rule}]\n  ${item.text}\n`);
  }
  process.stderr.write(`FAIL frontend discipline: ${violations.length} violation(s) across ${scanned} files\n`);
  process.exit(1);
}
process.stdout.write(`PASS frontend discipline across ${scanned} files\n`);
