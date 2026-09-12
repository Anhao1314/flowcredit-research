/* Browser/Node equivalence for the generated v0.2.1 engine.

   The bundle is executed in an isolated global context instead of a DOM, which
   is the same code path the static site takes; the only browser facility the
   engine touches is sha256 (through the embedded fallback) and, when present,
   TextEncoder. Both encoder paths are exercised here, so this test reproduces
   in CI what the Chrome-CDP spike verified by hand. */

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { validateDraftV03 } from "../src/intake-v03.js";
import { normalizeEvidenceV021 } from "../src/normalize-v021.js";
import { getPresetV021 } from "../src/presets.js";
import { computeRiskV021 } from "../src/risk-core-v021.js";
import { buildBrowserEngineSource } from "../scripts/build-browser-engine.mjs";

const AGENT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPOSITORY_ROOT = resolve(AGENT_ROOT, "..");
const ENGINE_PATH = resolve(REPOSITORY_ROOT, "assets/js/risk-engine-v021.js");
const EXAMPLE_PATH = resolve(AGENT_ROOT, "contracts/finch-test-output.example.json");

const GOLDEN = {
  healthy: { TAI: 93.8, band: "coherent", CCI: 929, grade: "A", veto: false, simulated: "eligible-for-review" },
  watch: { TAI: 82, band: "review", CCI: 741, grade: "B", veto: false, simulated: "standard-review" },
  sybil: { TAI: 28.9, band: "anomalous", CCI: 193, grade: "D", veto: true, simulated: "reject-confirmed-integrity" }
};

const MINIMAL_LIMITED = {
  subjectId: "minimal-limited", label: "Minimal Evidence",
  periodStart: "2026-08-01", periodEnd: "2026-08-31",
  inputTokensM: 12, outputTokensM: 3, modelTier: "flagship", taskType: "inference",
  normalizationProfileId: "demo-token-inference-v1", validRatePct: 90, gpuHours: 300,
  gpuModel: "h100-equivalent", peerProfileId: "demo-inference-h100-v021",
  revenueUsd: 12000, computeSpendUsd: 9000
};

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}
const canonical = value => JSON.stringify(canonicalize(value));

function fieldDiff(left, right, prefix = "") {
  const out = [];
  for (const key of new Set([...Object.keys(left || {}), ...Object.keys(right || {})])) {
    const a = left?.[key], b = right?.[key], path = prefix ? `${prefix}.${key}` : key;
    if (a && b && typeof a === "object" && typeof b === "object") out.push(...fieldDiff(a, b, path));
    else if (canonical(a) !== canonical(b)) out.push(`${path}: node=${JSON.stringify(a)} browser=${JSON.stringify(b)}`);
  }
  return out;
}

function loadBrowserEngine(options = {}) {
  const sandbox = options.withTextEncoder ? { TextEncoder } : {};
  const context = vm.createContext(sandbox);
  return buildBrowserEngineSource()
    .then(source => {
      vm.runInContext(source, context, { filename: "risk-engine-v021.js" });
      assert.equal(typeof context.FC_RISK, "object", "the bundle must expose FC_RISK on the global object");
      return context.FC_RISK;
    });
}

function nodeResult(input) {
  return computeRiskV021(normalizeEvidenceV021(structuredClone(input)));
}

function fixtureInputs(finchDraft) {
  const cjk = getPresetV021("watch");
  cjk.label = "观察对象 · 中文标签";
  return {
    "preset-healthy": getPresetV021("healthy"),
    "preset-watch": getPresetV021("watch"),
    "preset-sybil": getPresetV021("sybil"),
    "finch-draft": finchDraft,
    "minimal-limited": MINIMAL_LIMITED,
    "cjk-label": cjk
  };
}

async function readFinchDraft() {
  const raw = await readFile(resolve(AGENT_ROOT, "contracts/finch-test-input.json"), "utf8");
  return JSON.parse(raw).draft;
}

test("the committed browser engine is exactly what the generator produces", async () => {
  const [generated, committed] = await Promise.all([buildBrowserEngineSource(), readFile(ENGINE_PATH, "utf8")]);
  assert.equal(committed, generated, "assets/js/risk-engine-v021.js is stale; rerun node scripts/build-browser-engine.mjs");
  for (const marker of ["import ", "export ", "require(", "node:crypto", "https://"]) {
    assert.ok(!committed.includes(marker), `the generated script must not contain ${marker}`);
  }
});

test("browser engine matches the Node engine field by field for every fixture", async () => {
  const engine = await loadBrowserEngine();
  const inputs = fixtureInputs(await readFinchDraft());
  for (const [name, input] of Object.entries(inputs)) {
    const browser = engine.assess(structuredClone(input)).result;
    const node = nodeResult(input);
    const differences = fieldDiff(node, browser);
    assert.deepEqual(differences, [], `${name}: browser and Node results diverge`);
    assert.equal(canonical(browser), canonical(node), `${name}: canonical JSON must match`);
    assert.equal(Object.keys(browser).length, 36, `${name}: the result field set must stay stable`);
  }
});

test("browser engine holds the frozen simulation goldens", async () => {
  const engine = await loadBrowserEngine();
  for (const [key, values] of Object.entries(GOLDEN)) {
    const result = engine.assess(getPresetV021(key)).result;
    assert.equal(result.TAI, values.TAI, `${key} TAI`);
    assert.equal(result.tokenActivityBand, values.band, `${key} band`);
    assert.equal(result.CCI, values.CCI, `${key} CCI`);
    assert.equal(result.riskGrade, values.grade, `${key} grade`);
    assert.equal(result.vetoApplied, values.veto, `${key} veto`);
    assert.equal(result.decisionStatus, "simulation-only", `${key} decision status`);
    assert.equal(result.simulatedDecisionStatus, values.simulated, `${key} simulated decision`);
    assert.equal(result.tokenMeteringStatus, "simulated", `${key} metering status`);
    assert.equal(result.PD_pct, null, `${key} PD must stay uncalibrated`);
    assert.equal(result.expectedLoss, null, `${key} expected loss must stay uncalibrated`);
    assert.equal(result.recommendedLimit, null, `${key} limit must stay uncalibrated`);
  }
});

test("embedded sha256 matches node:crypto on ASCII and multi-byte payloads", async () => {
  const bare = await loadBrowserEngine();
  const native = await loadBrowserEngine({ withTextEncoder: true });
  const cases = {
    "preset-watch": getPresetV021("watch"),
    "cjk-label": fixtureInputs(await readFinchDraft())["cjk-label"],
    "long-description": { label: "x".repeat(4096), subjectId: "pad" }
  };
  for (const [name, input] of Object.entries(cases)) {
    const normalized = normalizeEvidenceV021(structuredClone(input));
    const expected = createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
    assert.equal(bare.assess(structuredClone(input)).result.inputHash, expected, `${name}: fallback encoder hash`);
    assert.equal(native.assess(structuredClone(input)).result.inputHash, expected, `${name}: TextEncoder hash`);
  }
});

test("draft path mirrors the server pipeline and the committed Finch example", async () => {
  const engine = await loadBrowserEngine();
  const draft = await readFinchDraft();
  const browser = engine.assessDraft(draft);
  const validation = validateDraftV03(draft);
  const node = computeRiskV021(normalizeEvidenceV021(structuredClone(validation.draft)));
  assert.equal(canonical(browser.validation), canonical(validation), "draft validation must match the server");
  assert.equal(canonical(browser.result), canonical(node), "sanitized draft assessment must match the server");

  const example = JSON.parse(await readFile(EXAMPLE_PATH, "utf8")).data;
  const compared = Object.keys(example).filter(key => key in browser.result);
  assert.ok(compared.length >= 25, "the example must overlap the engine result");
  const differences = compared.filter(key => canonical(example[key]) !== canonical(browser.result[key]));
  assert.deepEqual(differences, [], "every field shared with the committed example must match");
  assert.equal(browser.result.inputHash, example.inputHash, "inputHash must match the committed example");
});

test("a sparse draft returns a limited, non-throwing assessment", async () => {
  const engine = await loadBrowserEngine();
  const browser = engine.assessDraft(MINIMAL_LIMITED);
  assert.equal(browser.validation.errors.length, 0);
  assert.equal(browser.validation.readinessStatus, "limited");
  assert.equal(browser.result.TAI, null);
  assert.equal(browser.result.CCI, null);
  assert.equal(browser.result.riskGrade, null);
  assert.ok(browser.result.missingInputs.length > 0);
  const coverage = engine.coverage(MINIMAL_LIMITED);
  assert.equal(coverage.total, 24);
  assert.ok(engine.requiredActions(browser.validation, browser.result, coverage).length > 0);
  const sanitized = validateDraftV03(MINIMAL_LIMITED);
  const node = computeRiskV021(normalizeEvidenceV021(structuredClone(sanitized.draft)));
  assert.equal(canonical(browser.result), canonical(node), "the draft path must mirror the server sanitize-then-score order");
  const raw = nodeResult(MINIMAL_LIMITED);
  assert.equal(raw.TAI, null);
  assert.equal(raw.CCI, null);
});

test("inputHash follows JSON key order while the assessment does not", async () => {
  const engine = await loadBrowserEngine();
  const input = getPresetV021("healthy");
  const reordered = {};
  for (const key of Object.keys(input).reverse()) reordered[key] = input[key];
  const first = engine.assess(structuredClone(input)).result;
  const second = engine.assess(reordered).result;
  assert.notEqual(first.inputHash, second.inputHash, "inputHash hashes the serialized input, so key order matters");
  const withoutHash = value => { const copy = { ...value }; delete copy.inputHash; return canonical(copy); };
  assert.equal(withoutHash(first), withoutHash(second), "field order must not change any scored value");
});

test("the browser engine surface stays explicit", async () => {
  const engine = await loadBrowserEngine();
  assert.equal(Object.isFrozen(engine), true);
  assert.equal(engine.ruleVersion, "flowcredit.risk_result/v0.2.1");
  assert.equal(engine.productVersion, "flowcredit.intake/v0.3.1");
  for (const name of ["validateDraft", "assess", "assessDraft", "coverage", "requiredActions"]) {
    assert.equal(typeof engine[name], "function", `FC_RISK.${name} must stay callable`);
  }
});
