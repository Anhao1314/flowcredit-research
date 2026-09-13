import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const files = ['data.js','state.js','ui.js','risk-engine-v021.js','example-v03.js','intake-v03.js','view-ingest.js','view-ai.js','view-audit.js','view-report.js','view-workspace.js'];
async function frontend(memory = new Map()) {
  const context = vm.createContext({
    crypto: { randomUUID: (() => { let n = 0; return () => `product-${++n}`; })() },
    localStorage: { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) },
    setTimeout, clearTimeout
  });
  vm.runInContext('window = globalThis', context);
  for (const name of files) vm.runInContext(await readFile(new URL(`../../assets/js/${name}`, import.meta.url),'utf8'), context);
  return context;
}
function host() {
  const nodes = new Map();
  return { innerHTML: '', querySelectorAll: () => [], querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { addEventListener() {}, setAttribute() {}, textContent: '' });
    return nodes.get(selector);
  } };
}
function score(c, input = c.FC_EXAMPLE.draft) {
  const draft = c.FC_INTAKE.create(input, 'example');
  const outcome = c.FC_RISK_RUN(draft.input, draft.draftId);
  assert.equal(outcome.ok, true);
  c.FC_INTAKE.setResult(outcome.result);
  return draft;
}

test('offline and online status share one result layout without saved or legacy scores', async () => {
  const c = await frontend(); score(c);
  const assessment = host(), report = host();
  c.FC_LIVE = false; c.App.views.audit.render(assessment); c.App.views.report.render(report);
  const offline = [assessment.innerHTML, report.innerHTML];
  c.FC_LIVE = true; c.App.views.audit.render(assessment); c.App.views.report.render(report);
  assert.deepEqual([assessment.innerHTML, report.innerHTML], offline);
  for (const html of offline) {
    assert.match(html, /929/);
    assert.doesNotMatch(html, /Legacy|Saved AI|Report & Monitor|v0\.1|795/);
  }
  assert.match(report.innerHTML, /not a statutory audit/);
  assert.match(report.innerHTML, /Print \/ Save PDF/);
  assert.equal(c.FC_INTAKE.active().proof, null, 'the report must not require a proof');
});

test('nine basic fields give a limited result and the form keeps enhancements collapsed', async () => {
  const c = await frontend();
  const input = { label:'Basic operator', periodStart:'2026-08-01', periodEnd:'2026-08-31', inputTokensM:64, outputTokensM:16, gpuModel:'h100-equivalent', gpuHours:4200, revenueUsd:100000, computeSpendUsd:58000 };
  const draft = score(c, input);
  assert.equal(draft.result.cci, null);
  assert.equal(draft.result.decisionStatus, 'insufficient-evidence');
  assert.ok(draft.result.requiredActions.length > 0);
  const page = host(); c.App.views.ingest.render(page);
  const primary = page.innerHTML.split('</section>')[0];
  assert.equal((primary.match(/data-field=/g) || []).length, 9);
  assert.doesNotMatch(page.innerHTML, /id="intake-(?:token|credit|history|evidence)-details" open/);
  assert.doesNotMatch(page.innerHTML, /id="anchor-btn"/);
});

test('changing assessed facts clears stale scores, proof, session and explanation consent', async () => {
  const c = await frontend(); const draft = score(c);
  draft.sessionId = 'old-session'; draft.proof = {root:'old-root'}; draft.explanationConsent = true;
  c.FC_INTAKE.update({...draft.input, revenueUsd:90000}, {silent:true});
  assert.equal(draft.status, 'draft');
  for (const key of ['result','proof','sessionId']) assert.equal(draft[key], null);
  assert.equal(draft.explanationConsent, false);
  const page = host(); c.App.views.report.render(page);
  assert.match(page.innerHTML, /No completed assessment/);
  assert.doesNotMatch(page.innerHTML, /929/);
});

test('extraction permission never authorizes explanation and imports do not retain permission', async () => {
  const c = await frontend(); const draft = score(c);
  draft.extractionConsent = true;
  const page = host(); c.App.views.audit.render(page);
  assert.doesNotMatch(page.innerHTML, /id="custom-ask-consent" type="checkbox" checked/);
  draft.explanationConsent = true; draft.modelConsent = true; draft.sessionId = 'session-only';
  const snapshot = c.FC_INTAKE.snapshot();
  snapshot.draft.modelConsent = true;
  const restored = c.FC_INTAKE.restore(snapshot).draft;
  assert.equal(restored.extractionConsent, false);
  assert.equal(restored.explanationConsent, false);
  assert.equal(restored.modelConsent, false);
  assert.equal(restored.sessionId, null);
});

test('reload recovers interrupted drafts and revokes session permissions without losing facts', async () => {
  const memory = new Map(); const first = await frontend(memory);
  const draft = first.FC_INTAKE.create({label:'Interrupted business'});
  draft.status = 'running'; draft.explanationConsent = true; draft.extractionConsent = true;
  first.FC_INTAKE.commit(draft, false);
  const next = await frontend(memory), recovered = next.FC_INTAKE.active();
  assert.equal(recovered.status, 'draft');
  assert.equal(recovered.input.label, 'Interrupted business');
  assert.equal(recovered.explanationConsent, false);
  assert.equal(recovered.extractionConsent, false);
});
