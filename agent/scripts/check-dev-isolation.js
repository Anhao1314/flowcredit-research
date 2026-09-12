import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This repository is a development and testing workspace. It must never gain a path to
// production: no deployment descriptors, no deploy steps in workflows, and no workflow
// token that could write anywhere. See docs/dev-isolation.md.

const AGENT_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const REPOSITORY_ROOT = resolve(AGENT_ROOT, "..");
const WORKFLOWS_ROOT = resolve(REPOSITORY_ROOT, ".github/workflows");
const ISOLATION_DOC = resolve(REPOSITORY_ROOT, "docs/dev-isolation.md");
const SKIP_DIRECTORIES = new Set([".git", "node_modules", "runtime", "runtime-test", "coverage"]);

const FORBIDDEN_FILES = [
  [/^render\.ya?ml$/, "Render descriptor"],
  [/^vercel\.json$/, "Vercel descriptor"],
  [/^netlify\.toml$/, "Netlify descriptor"],
  [/^fly\.toml$/, "Fly.io descriptor"],
  [/^Procfile$/, "Procfile"],
  [/^app\.ya?ml$/, "App Engine descriptor"],
  [/^serverless\.ya?ml$/, "Serverless descriptor"],
  [/^now\.json$/, "Vercel (legacy) descriptor"],
  [/^app\.json$/, "PaaS application descriptor"],
  [/^(?:k8s|kubernetes|helm|charts|\.platform|\.ebextensions)(?:\/|$)/, "deployment manifest tree"]
];

const FORBIDDEN_WORKFLOW_PATTERNS = [
  [/\brender\.com\b|\bonrender\.com\b/i, "deploy hook for a hosted service"],
  [/\bvercel\b/i, "Vercel deployment"],
  [/\bnetlify\b/i, "Netlify deployment"],
  [/\bflyctl\b|\bfly\.io\b|\bsuperfly\b/i, "Fly.io deployment"],
  [/\bwrangler\b|\bcloudflare\b/i, "Cloudflare deployment"],
  [/\bheroku\b|\brailway\b/i, "PaaS deployment"],
  [/\baws-actions\//i, "AWS deployment action"],
  [/\bgoogle-github-actions\//i, "Google Cloud deployment action"],
  [/(^|[\s"'])azure\//i, "Azure deployment action"],
  [/\bdocker\/build-push-action\b|\bdocker\/login-action\b|\bdocker\s+push\b/i, "container registry publishing"],
  [/\bnpm\s+publish\b|\byarn\s+publish\b|\bpnpm\s+publish\b/i, "package publishing"],
  [/\bgh\s+release\s+create\b|softprops\/action-gh-release|actions\/create-release/i, "release publishing"],
  [/\bhelm\s+upgrade\b|\bkubectl\s+apply\b/i, "cluster deployment"],
  [/\bsls\s+deploy\b|\bserverless\s+deploy\b/i, "serverless deployment"],
  [/actions\/deploy-pages|actions\/configure-pages|actions\/upload-pages-artifact/i, "GitHub Pages deployment"]
];

const violations = [];
const fail = (file, reason) => violations.push({ file, reason });

async function walk(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path, output);
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

async function checkDeploymentDescriptors(files) {
  for (const path of files) {
    const relativePath = relative(REPOSITORY_ROOT, path);
    for (const [pattern, reason] of FORBIDDEN_FILES) {
      if (pattern.test(relativePath)) fail(relativePath, `deployment descriptor detected: ${reason}`);
    }
  }
}

async function checkWorkflows() {
  let names = [];
  try { names = (await readdir(WORKFLOWS_ROOT)).filter(name => /\.ya?ml$/.test(name)).sort(); }
  catch { names = []; }
  if (!names.length) return;
  for (const name of names) {
    const file = `.github/workflows/${name}`;
    const text = await readFile(resolve(WORKFLOWS_ROOT, name), "utf8");
    text.split("\n").forEach((line, index) => {
      const position = index + 1;
      if (/^\s*#/.test(line)) return;
      for (const [pattern, reason] of FORBIDDEN_WORKFLOW_PATTERNS) {
        if (pattern.test(line)) fail(`${file}:${position}`, `deployment step detected: ${reason} — ${line.trim().slice(0, 90)}`);
      }
    });
    if (!/\npermissions:|\Apermissions:/.test(`\n${text}`)) {
      fail(file, "workflow must declare an explicit least-privilege permissions block");
    } else if (/\bwrite\b/.test(text)) {
      fail(file, "workflow token must stay read-only in the development repository");
    }
  }
}

async function checkIsolationDocument() {
  try {
    const text = await readFile(ISOLATION_DOC, "utf8");
    if (!/does not deploy|development and testing workspace/i.test(text)) {
      fail("docs/dev-isolation.md", "isolation document must state the non-deployment boundary");
    }
  } catch {
    fail("docs/dev-isolation.md", "isolation document is missing");
  }
}

const files = await walk(REPOSITORY_ROOT);
await checkDeploymentDescriptors(files);
await checkWorkflows();
await checkIsolationDocument();

if (violations.length) {
  for (const item of violations) process.stderr.write(`${item.file}\n  ${item.reason}\n`);
  process.stderr.write(`FAIL development isolation: ${violations.length} violation(s)\n`);
  process.exit(1);
}
process.stdout.write(`PASS development isolation across ${files.length} files and ${(await readdir(WORKFLOWS_ROOT)).filter(n => /\.ya?ml$/.test(n)).length} workflow(s)\n`);
