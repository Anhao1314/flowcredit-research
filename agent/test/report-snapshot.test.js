/* Portable JSON snapshots for the browser intake controller.

   FC_INTAKE.snapshot/restore are pure: they may not touch the DOM, storage or
   timers, so this test drives them in an isolated global where the only browser
   facilities present are the ones the controller actually needs. */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const FRONTEND_FILES = ["risk-engine-v021.js", "example-v03.js", "intake-v03.js"];
const MAX_DRAFTS = 5;

async function frontendContext() {
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
    vm.runInContext(await readFile(resolve(REPOSITORY_ROOT, "assets/js", name), "utf8"), context, { filename: name });
  }
  return context;
}

function scoredDraft(context, proofRoot = "root-fixture") {
  const draft = context.FC_INTAKE.create(context.FC_EXAMPLE.draft, "example");
  const outcome = context.FC_RISK_RUN(draft.input, draft.draftId);
  assert.equal(outcome.ok, true, "the fixture must score before it can be exported");
  context.FC_INTAKE.setResult(outcome.result);
  const active = context.FC_INTAKE.active();
  active.proof = { root: proofRoot, levels: [["leaf-a", "leaf-b"], ["node"]], time: "2026-09-13 00:00:00 UTC", nonce: 1 };
  context.FC_INTAKE.commit(active, false);
  return active;
}

test("a snapshot round-trips the result and proof into a new draft", async () => {
  const context = await frontendContext();
  const original = scoredDraft(context);
  const snapshot = context.FC_INTAKE.snapshot();
  assert.equal(snapshot.format, "flowcredit.snapshot/v1");
  assert.equal(snapshot.versions.productVersion, "flowcredit.intake/v0.3.1");
  assert.equal(snapshot.versions.ruleVersion, "flowcredit.risk_result/v0.2.1");
  assert.deepEqual(Object.keys(snapshot.draft).sort(), ["input", "modelConsent", "proof", "result", "source", "status"]);

  const restored = context.FC_INTAKE.restore(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(restored.ok, true, restored.error);
  assert.notEqual(restored.draft.draftId, original.draftId, "a restore is a new draft, never an overwrite");
  assert.equal(restored.draft.status, "complete");
  assert.equal(restored.draft.result.tai, original.result.tai);
  assert.equal(restored.draft.result.cci, original.result.cci);
  assert.equal(restored.draft.result.grade, original.result.grade);
  assert.equal(restored.draft.result.factsSha256, original.result.factsSha256);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.draft.proof)), JSON.parse(JSON.stringify(original.proof)));
  assert.equal(restored.draft.input.label, original.input.label);
  assert.equal(restored.draft.input.monthlySeries.length, original.input.monthlySeries.length);
});

test("a snapshot stays plain JSON with no functions or live references", async () => {
  const context = await frontendContext();
  scoredDraft(context);
  const snapshot = context.FC_INTAKE.snapshot();
  const text = JSON.stringify(snapshot);
  assert.equal(text === undefined, false, "the snapshot must serialize");
  const clone = JSON.parse(text);
  assert.deepEqual(clone, JSON.parse(JSON.stringify(snapshot)));
  const walk = value => {
    if (typeof value === "function") return false;
    if (value && typeof value === "object") return Object.keys(value).every(key => walk(value[key]));
    return true;
  };
  assert.equal(walk(clone), true);
  clone.draft.result.tai = 1;
  assert.notEqual(snapshot.draft.result.tai, 1, "the snapshot must not alias the live draft");
});

test("a draft id can be selected explicitly and an unknown id has no snapshot", async () => {
  const context = await frontendContext();
  const first = scoredDraft(context);
  const second = scoredDraft(context, "root-second");
  const picked = context.FC_INTAKE.snapshot(first.draftId);
  assert.equal(picked.draft.proof.root, "root-fixture");
  assert.equal(context.FC_INTAKE.snapshot(second.draftId).draft.proof.root, "root-second");
  assert.equal(context.FC_INTAKE.snapshot("missing-draft"), null);
});

test("malformed snapshots are rejected without touching the saved drafts", async () => {
  const context = await frontendContext();
  const original = scoredDraft(context);
  const before = context.FC_INTAKE.list().map(draft => draft.draftId);
  const payloads = [
    null, undefined, 3, "text", [], {},
    { format: "flowcredit.report/v1", draft: { input: {}, result: { tai: 1 } } },
    { format: "flowcredit.snapshot/v1" },
    { format: "flowcredit.snapshot/v1", draft: {} },
    { format: "flowcredit.snapshot/v1", draft: { input: "not-an-object", result: { tai: 1 } } },
    { format: "flowcredit.snapshot/v1", draft: { input: {}, result: null } },
    { format: "flowcredit.snapshot/v1", draft: { input: {}, result: [] } },
    { format: "flowcredit.snapshot/v1", draft: { input: {}, result: {} } },
    { format: "flowcredit.snapshot/v1", versions: { productVersion: "flowcredit.intake/v9.9.9" }, draft: { input: {}, result: { tai: 1, cci: 1, grade: "A", decisionStatus: "x" } } }
  ];
  for (const payload of payloads) {
    let outcome;
    assert.doesNotThrow(() => { outcome = context.FC_INTAKE.restore(payload); }, `restore must not throw for ${JSON.stringify(payload)}`);
    assert.equal(outcome.ok, false, `restore must reject ${JSON.stringify(payload)}`);
    assert.equal(typeof outcome.error, "string");
  }
  assert.deepEqual(context.FC_INTAKE.list().map(draft => draft.draftId), before, "rejected payloads must not change the draft list");
  assert.equal(context.FC_INTAKE.active().draftId, original.draftId, "rejected payloads must not change the active draft");
});

test("restores respect the five-draft limit", async () => {
  const context = await frontendContext();
  assert.equal(context.FC_INTAKE.snapshot(), null, "an empty controller has nothing to export");
  const payload = JSON.parse(JSON.stringify((scoredDraft(context), context.FC_INTAKE.snapshot())));
  for (let index = 0; index < MAX_DRAFTS + 2; index += 1) {
    const outcome = context.FC_INTAKE.restore(JSON.parse(JSON.stringify(payload)));
    assert.equal(outcome.ok, true, outcome.error);
  }
  const drafts = context.FC_INTAKE.list();
  assert.equal(drafts.length, MAX_DRAFTS);
  assert.equal(drafts[0].draftId, context.FC_INTAKE.active().draftId, "the newest restore stays active");
  assert.equal(drafts.filter(draft => draft.result.tai === 93.8).length, MAX_DRAFTS);
});
