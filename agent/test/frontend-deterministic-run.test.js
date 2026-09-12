/* Offline golden path: example-v03.js + the generated browser engine feed the
   intake controller without a local agent.

   The three front-end files are executed in one isolated global, in the same
   order index.html loads them, so the assertions cover what a visitor gets when
   nothing is listening on the sidecar port. */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { buildEvidenceCoverageV03, buildRequiredActionsV03, validateDraftV03 } from "../src/intake-v03.js";
import { normalizeEvidenceV021 } from "../src/normalize-v021.js";
import { computeRiskV021 } from "../src/risk-core-v021.js";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const FRONTEND_FILES = ["risk-engine-v021.js", "example-v03.js", "intake-v03.js"];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

async function frontendContext({ withEngine = true } = {}) {
  const memory = new Map();
  const context = vm.createContext({
    sessionStorage: {
      getItem: key => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, value),
      removeItem: key => memory.delete(key)
    },
    crypto: { randomUUID: (() => { let n = 0; return () => `draft-${++n}`; })() }
  });
  vm.runInContext("globalThis.window = globalThis;", context);
  for (const name of FRONTEND_FILES) {
    if (!withEngine && name === "risk-engine-v021.js") continue;
    const source = await readFile(resolve(REPOSITORY_ROOT, "assets/js", name), "utf8");
    vm.runInContext(source, context, { filename: name });
  }
  return context;
}

test("the worked example is the contract fixture, not a second copy", async () => {
  const context = await frontendContext();
  const fixture = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "agent/contracts/finch-test-input.json"), "utf8"));
  const example = JSON.parse(JSON.stringify(context.FC_EXAMPLE.draft));
  assert.equal(
    JSON.stringify(canonical(example)),
    JSON.stringify(canonical(fixture.draft)),
    "assets/js/example-v03.js must mirror agent/contracts/finch-test-input.json"
  );
});

test("the worked example scores in the browser with no local agent", async () => {
  const context = await frontendContext();
  const outcome = context.FC_RISK_RUN(context.FC_EXAMPLE.draft);
  assert.equal(outcome.ok, true, "the worked example must produce a result offline");
  assert.equal(outcome.result.TAI, 93.8);
  assert.equal(outcome.result.CCI, 929);
  assert.equal(outcome.result.riskGrade, "A");
  assert.equal(outcome.result.vetoApplied, false);
  assert.equal(outcome.result.ruleVersion, "flowcredit.risk_result/v0.2.1");
  assert.equal(outcome.result.productVersion, "flowcredit.intake/v0.3.1");
  assert.equal(outcome.result.harnessStatus, "local-deterministic");
  assert.equal(outcome.result.model, null);
  assert.ok(Array.isArray(outcome.result.requiredActions), "requiredActions must be present for the report view");
  assert.ok(outcome.result.evidenceCoverage && outcome.result.evidenceCoverage.total > 0, "evidence coverage must be attached");
  assert.equal(outcome.validation.errors.length, 0);
});

test("the intake controller renders the offline result like a sidecar payload", async () => {
  const context = await frontendContext();
  const draft = context.FC_INTAKE.create(context.FC_EXAMPLE.draft, "example");
  const outcome = context.FC_RISK_RUN(draft.input, draft.draftId);
  assert.equal(outcome.ok, true, "the intake-normalized example must still score");
  context.FC_INTAKE.setResult(outcome.result);
  const settled = context.FC_INTAKE.active();
  assert.equal(settled.status, "complete");
  assert.equal(settled.result.tai, 93.8);
  assert.equal(settled.result.cci, 929);
  assert.equal(settled.result.grade, "A");
  assert.equal(settled.result.harnessStatus, "local-deterministic");
  assert.equal(settled.result.productVersion, "flowcredit.intake/v0.3.1");
  assert.equal(settled.result.ruleVersion, "flowcredit.risk_result/v0.2.1");
  assert.ok(Array.isArray(settled.result.requiredActions));
  assert.ok(Array.isArray(settled.result.anchors) && settled.result.anchors.length > 0, "the credit dimensions must survive the display mapping");
  assert.ok(settled.result.evidenceCoverage && settled.result.evidenceCoverage.total > 0);
  assert.ok(settled.result.factsSha256, "the facts snapshot must be kept for the report");
});

test("invalid input is reported as field errors instead of a thrown exception", async () => {
  const context = await frontendContext();
  const outcome = context.FC_RISK_RUN({
    label: "Broken operator", validRatePct: 120, gpuModel: "unsupported",
    periodStart: "2026-01-01", periodEnd: "2026-06-30", R: [1, 2], C: [1]
  });
  assert.equal(outcome.ok, false);
  assert.ok(outcome.fieldErrors.length > 0, "field errors must be returned");
  for (const item of outcome.fieldErrors) {
    assert.equal(typeof item.field, "string");
    assert.equal(typeof item.message, "string");
  }
  assert.equal(typeof outcome.missingByGroup, "object");
  assert.ok(Array.isArray(outcome.warnings));
});

test("malformed input and a missing engine never throw", async () => {
  const context = await frontendContext();
  for (const value of [null, undefined, "text", 3, [], {}, { evidence: "nope" }, { tokenBucketsM: 5 }, { R: "6,7" }]) {
    const outcome = context.FC_RISK_RUN(value);
    assert.equal(typeof outcome.ok, "boolean", `FC_RISK_RUN(${JSON.stringify(value)}) must report a status`);
    if (outcome.ok) assert.ok(outcome.result && typeof outcome.result === "object", "success must carry a result payload");
    else assert.ok(Array.isArray(outcome.fieldErrors), "failures must still carry an error list");
  }
  const empty = await frontendContext({ withEngine: false });
  const unavailable = empty.FC_RISK_RUN({ label: "No engine" });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.unavailable, true);
});

test("the same draft always produces the same offline result", async () => {
  const context = await frontendContext();
  const first = context.FC_RISK_RUN(context.FC_EXAMPLE.draft).result;
  const second = context.FC_RISK_RUN(context.FC_EXAMPLE.draft).result;
  assert.equal(JSON.stringify(canonical(first)), JSON.stringify(canonical(second)));
  assert.equal(first.inputHash, second.inputHash);
});

test("the offline payload derives the sidecar fields with the sidecar code", async () => {
  const context = await frontendContext();
  const draft = JSON.parse(JSON.stringify(context.FC_EXAMPLE.draft));
  const offline = context.FC_RISK_RUN(draft, "finch-contract-healthy-v01").result;
  const validation = validateDraftV03(structuredClone(draft));
  const result = computeRiskV021(normalizeEvidenceV021(validation.draft));
  const coverage = buildEvidenceCoverageV03(structuredClone(draft));
  const expected = {
    requiredActions: buildRequiredActionsV03(validation, result, coverage),
    missingByGroup: validation.missingByGroup,
    evidenceCoverage: coverage,
    readinessStatus: validation.readinessStatus
  };
  assert.equal(JSON.stringify(canonical(offline.requiredActions)), JSON.stringify(canonical(expected.requiredActions)));
  assert.equal(JSON.stringify(canonical(offline.missingByGroup)), JSON.stringify(canonical(expected.missingByGroup)));
  assert.equal(JSON.stringify(canonical(offline.evidenceCoverage)), JSON.stringify(canonical(expected.evidenceCoverage)));
  assert.equal(offline.readinessStatus, expected.readinessStatus);
  assert.equal(offline.draftId, "finch-contract-healthy-v01");
});
