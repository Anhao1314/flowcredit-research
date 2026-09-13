/* Draft persistence: localStorage first, one-time sessionStorage migration,
   and an in-memory fallback when the browser refuses storage access. */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const FRONTEND_FILES = ["risk-engine-v021.js", "example-v03.js", "intake-v03.js"];
const KEY = "flowcredit.intake.v03";

function store(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    dump: () => Object.fromEntries(map)
  };
}

function blockedStore() {
  const blocked = () => { throw new Error("storage is blocked in this context"); };
  return { getItem: blocked, setItem: blocked, removeItem: blocked };
}

function persisted(label) {
  return JSON.stringify({
    activeId: "draft-legacy",
    drafts: [{ draftId: "draft-legacy", createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z", status: "draft", source: "manual", input: { label }, errors: [], warnings: [], missingByGroup: {}, modelConsent: false, result: null, sessionId: null, proof: null }]
  });
}

async function controller(stores) {
  const sandbox = { crypto: { randomUUID: (() => { let n = 0; return () => `draft-${++n}`; })() } };
  if (stores.local !== undefined) sandbox.localStorage = stores.local;
  if (stores.session !== undefined) sandbox.sessionStorage = stores.session;
  const context = vm.createContext(sandbox);
  vm.runInContext("globalThis.window = globalThis;", context);
  for (const name of FRONTEND_FILES) {
    vm.runInContext(await readFile(resolve(REPOSITORY_ROOT, "assets/js", name), "utf8"), context, { filename: name });
  }
  return context;
}

test("drafts written by one page load are read back by the next", async () => {
  const local = store();
  const first = await controller({ local, session: store() });
  first.FC_INTAKE.create({ label: "Persisted operator" }, "manual");
  assert.ok(String(local.dump()[KEY]).includes("Persisted operator"), "the draft must reach localStorage");

  const second = await controller({ local, session: store() });
  assert.equal(second.FC_INTAKE.list().length, 1);
  assert.equal(second.FC_INTAKE.list()[0].input.label, "Persisted operator");
});

test("a legacy sessionStorage draft is migrated into localStorage and cleared", async () => {
  const local = store();
  const session = store({ [KEY]: persisted("Legacy session draft") });
  const context = await controller({ local, session });
  assert.equal(context.FC_INTAKE.list().length, 1);
  assert.equal(context.FC_INTAKE.list()[0].input.label, "Legacy session draft");
  assert.equal(context.FC_INTAKE.list()[0].draftId, "draft-legacy");
  assert.ok(String(local.dump()[KEY]).includes("Legacy session draft"), "the migrated value must be written to localStorage");
  assert.equal(session.dump()[KEY], undefined, "the legacy key must be dropped after a successful migration");
});

test("localStorage wins when both stores hold data", async () => {
  const local = store({ [KEY]: persisted("From localStorage") });
  const session = store({ [KEY]: persisted("Stale session copy") });
  const context = await controller({ local, session });
  assert.equal(context.FC_INTAKE.list()[0].input.label, "From localStorage");
  assert.ok(String(session.dump()[KEY]).includes("Stale session copy"), "a stale session copy is left untouched while localStorage answers");
});

test("blocked storage falls back to memory without breaking the controller", async () => {
  for (const stores of [{ local: blockedStore(), session: blockedStore() }, { local: undefined, session: undefined }]) {
    const context = await controller(stores);
    const draft = context.FC_INTAKE.create({ label: "Memory only" }, "manual");
    assert.equal(context.FC_INTAKE.list().length, 1);
    assert.doesNotThrow(() => context.FC_INTAKE.commit(draft, false));
    assert.doesNotThrow(() => context.FC_INTAKE.proof());
    assert.equal(context.FC_INTAKE.list()[0].input.label, "Memory only");
    assert.doesNotThrow(() => context.FC_INTAKE.clear());
    assert.equal(context.FC_INTAKE.list().length, 0);
  }
});

test("clearing removes the saved drafts from both stores", async () => {
  const local = store();
  const session = store({ [KEY]: persisted("Legacy session draft") });
  const context = await controller({ local, session });
  context.FC_INTAKE.create({ label: "Second draft" }, "manual");
  assert.equal(context.FC_INTAKE.list().length, 2);
  context.FC_INTAKE.clear();
  assert.equal(context.FC_INTAKE.list().length, 0);
  assert.equal(local.dump()[KEY], undefined);
  assert.equal(session.dump()[KEY], undefined);
});
