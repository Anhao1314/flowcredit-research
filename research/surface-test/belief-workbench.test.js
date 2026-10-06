// UI-2.0B Belief Reasoning Workbench contract tests.
//
// These tests protect a semantic boundary that the UI must not blur:
// current Claim supporting/counter links are recorded link roles, not persisted
// pairwise RelationReceipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { buildFixture } from './fixtures.js';
import { startSurface } from '../surface/server.js';

const silentLog = { log() {}, error() {} };

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function withBelief(t, run, options = {}) {
  const fixture = buildFixture(options);
  t.after(() => fixture.cleanup());
  const { server, url } = await startSurface({
    port: 0,
    log: silentLog,
    memoryPath: fixture.memoryPath,
    demoDir: fixture.demoDir,
    demoFallback: fixture.fallbackPath
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return run({ ...fixture, url });
}

test('Belief page exposes current belief, supporting evidence and counter evidence as separate recorded-link groups', async (t) => {
  await withBelief(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/claim/${paths.claimOne}`);
    assert.equal(response.status, 200);
    for (const label of [
      'Current belief',
      'Reasoning',
      'Supporting evidence',
      'Counter evidence',
      'Fixture revenue rose in December.',
      'Unreferenced fixture note'
    ]) {
      assert.ok(response.body.includes(label), `missing Belief workbench content: ${label}`);
    }
    assert.ok(response.body.includes('Recorded supporting link'));
    assert.ok(response.body.includes('Recorded counter link'));
    assert.ok(response.body.includes('1 supporting link'));
    assert.ok(response.body.includes('1 counter link'));
  }, { counterLink: true });
});

test('Relation inspector preserves the link-vs-receipt boundary instead of inventing runtime output', async (t) => {
  await withBelief(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/claim/${paths.claimOne}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Relation inspector'));
    assert.ok(response.body.includes('Recorded link role ≠ RelationReceipt.'));
    assert.ok(response.body.includes('RelationReceipt not persisted'));
    for (const field of ['Claim revision', 'Recorded link role', 'Revision effective', 'RelationReceipt', 'as-of', 'Compatibility', 'Relation', 'Reason code', 'Runtime']) {
      assert.ok(response.body.includes(field), `missing inspector field: ${field}`);
    }
    assert.ok(response.body.includes('Not persisted'));
    assert.ok(response.body.includes('Not recorded'));
    assert.ok(!response.body.includes('relation-candidate/'), 'real Belief UI must not manufacture a runtime id');
    assert.ok(!response.body.includes('RT_SECOND_ORDER_SERIES'), 'real Belief UI must not manufacture a reason code');
    assert.ok(!response.body.includes('processingStatus'), 'internal runtime object fields must not be fabricated into the real page');
  }, { counterLink: true });
});

test('reasoning selector has one initial selection and no mutation controls', async (t) => {
  await withBelief(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/claim/${paths.claimOne}`);
    const triggers = [...response.body.matchAll(/<button class="reasoning-open"[^>]+>/g)].map((match) => match[0]);
    assert.equal(triggers.length, 2);
    assert.equal(triggers.filter((button) => button.includes('aria-pressed="true"')).length, 1);
    assert.equal(triggers.filter((button) => button.includes('aria-pressed="false"')).length, 1);
    assert.equal((response.body.match(/data-reasoning-panel/g) ?? []).length, 2);
    assert.equal((response.body.match(/data-reasoning-panel hidden/g) ?? []).length, 1);
    for (const mutationCopy of ['>Accept<', '>Reject<', '>Needs Review<']) {
      assert.ok(!response.body.includes(mutationCopy), `Belief page exposed disabled mutation affordance: ${mutationCopy}`);
    }
  }, { counterLink: true });
});

test('absence of counter Evidence remains an explicit empty state, never an inferred directional relation', async (t) => {
  await withBelief(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/claim/${paths.claimOne}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('No counter Evidence is linked to this Belief.'));
    assert.ok(response.body.includes('Pairwise RelationReceipts are not persisted for real Research Memory yet'));
    assert.ok(!response.body.includes('No counter Evidence therefore SUPPORTS'));
    assert.ok(!response.body.includes('COUNTERS relation'));
  });
});

test('Belief inspector client behavior stays local-only with no fetch or storage', async (t) => {
  await withBelief(t, async ({ url }) => {
    const response = await httpGet(`${url}/assets/surface.js`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('[data-reasoning-target]'));
    assert.ok(response.body.includes('[data-reasoning-panel]'));
    assert.ok(!response.body.includes('fetch('));
    assert.ok(!response.body.includes('localStorage'));
    assert.ok(!response.body.includes('sessionStorage'));
  });
});
