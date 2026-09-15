import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { buildPublicDemo } from '../surface/fixtures/public-demo/build.js';
import { createSurfaceServer } from '../surface/server.js';
import { MemorySource } from '../surface/data-source.js';
import { publicSourceLabel } from '../surface/render/layout.js';

const ABS_PATH = /\/Users\/|\/home\/|[A-Za-z]:[\\/]Users[\\/]/;

function buildDb(name) {
  const path = join(tmpdir(), name);
  const summary = buildPublicDemo(path);
  return { path, summary };
}

function logicalDump(path) {
  const source = MemorySource.open(path);
  const dump = {
    counts: source.counts(),
    sources: source.sources().map((record) => [record.id, record.title, record.createdAt]),
    evidence: source.evidenceList().map((record) => [record.id, record.createdAt, record.sourceId, record.category, record.page]),
    claims: source.identities().map((record) => record.id),
    revisions: source.revisions().map((record) => [record.id, record.createdAt]),
    reviews: source.reviews().map((record) => [record.id, record.recordedAt, record.resultingEvidenceId]),
    digest: source.authorityDigest()
  };
  source.close();
  return dump;
}

// Spin the real HTTP surface (public-demo vs real mode) on an ephemeral port.
async function withServer(options, fn) {
  const server = createSurfaceServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('public demo builder is deterministic across rebuilds (counts, ids, timestamps, digest)', () => {
  const a = buildDb('fc-public-demo-a.sqlite');
  const b = buildDb('fc-public-demo-b.sqlite');
  assert.deepEqual(a.summary.counts, { sources: 3, evidence: 18, claims: 5, revisions: 5, reviews: 3 });
  assert.deepEqual(a.summary.ids, b.summary.ids);
  assert.deepEqual(a.summary.timestamps, b.summary.timestamps);
  const dumpA = logicalDump(a.path);
  const dumpB = logicalDump(b.path);
  assert.deepEqual(dumpA, dumpB);
  assert.equal(dumpA.digest, dumpB.digest);
});

test('public demo fixture uses a clearly fictional subject and writes no Claim confidence score', () => {
  const { path } = buildDb('fc-public-demo-conf.sqlite');
  const source = MemorySource.open(path);
  assert.equal(source.identities()[0]?.subjectId, 'northstar-compute');
  for (const revision of source.revisions()) {
    assert.equal(revision.claim?.confidence, undefined, 'no generic Claim confidence score');
  }
  source.close();
});

test('public demo inbox loads with PUBLIC DEMO / READ ONLY / AI OFF labels and no LOCAL label', async () => {
  const { path } = buildDb('fc-public-demo-labels.sqlite');
  await withServer({ memoryPath: path, publicDemo: true, log: { log() {}, error() {} } }, async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /PUBLIC DEMO/);
    assert.match(html, /READ ONLY/);
    assert.match(html, /AI OFF/);
    assert.doesNotMatch(html, />LOCAL</);
    assert.match(html, /Synthetic demo data/);
    // The on-disk database path must never reach the page.
    assert.ok(!html.includes(path), 'output DB path must not render');
  });
});

test('absolute machine paths never render on any public demo page', async () => {
  const { path } = buildDb('fc-public-demo-paths.sqlite');
  const routes = ['/', '/claims', '/evidence', '/changes',
    '/claim/CLAIM-NST-0001', '/evidence/EVID-NST-0001', '/company/northstar-compute',
    '/changes?demo=1'];
  await withServer({ memoryPath: path, publicDemo: true, log: { log() {}, error() {} } }, async (base) => {
    for (const route of routes) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 200, `${route} should load`);
      const html = await res.text();
      assert.ok(!ABS_PATH.test(html), `${route} must not contain a home path`);
      assert.ok(!html.includes(path), `${route} must not echo the DB path`);
    }
  });
});

test('inbox evidence rows render Source title · Category · page', async () => {
  const { path } = buildDb('fc-public-demo-source.sqlite');
  await withServer({ memoryPath: path, publicDemo: true, log: { log() {}, error() {} } }, async (base) => {
    const html = await (await fetch(`${base}/`)).text();
    // Unlinked example row: source title, human category and page in secondary meta.
    assert.match(html, /Investor Day 2026 Transcript/);
    assert.match(html, /Geography\s*<span class="sep">·<\/span>\s*p\.19/);
    // Acronym category is upper-cased, not sentence-cased to "Esg".
    assert.match(html, /ESG/);
    assert.doesNotMatch(html, /Esg/);
  });
});

test('public demo stays read-only: state-changing POST is still refused', async () => {
  const { path } = buildDb('fc-public-demo-ro.sqlite');
  await withServer({ memoryPath: path, publicDemo: true, log: { log() {}, error() {} } }, async (base) => {
    const res = await fetch(`${base}/claims/review`, { method: 'POST', body: '{}' });
    assert.equal(res.status, 405);
  });
});

test('real (non-public) mode keeps LOCAL label and shows basename only, never the full path', async () => {
  const { path } = buildDb('fc-public-demo-real.sqlite');
  await withServer({ memoryPath: path, publicDemo: false, log: { log() {}, error() {} } }, async (base) => {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, />LOCAL</);
    assert.doesNotMatch(html, /PUBLIC DEMO/);
    assert.match(html, /fc-public-demo-real\.sqlite \(read-only\)/);
    assert.ok(!html.includes(path), 'full path must not render in real mode either');
    assert.ok(!ABS_PATH.test(html));
  });
});

test('publicSourceLabel reduces an absolute home path to its basename', () => {
  const cleaned = publicSourceLabel('/Users/analyst/memory/research.sqlite');
  assert.ok(!ABS_PATH.test(cleaned));
  assert.match(cleaned, /research\.sqlite/);
  assert.equal(publicSourceLabel('research/eval/example.json'), 'research/eval/example.json');
  assert.equal(publicSourceLabel('v0.12 locked synthetic proposals'), 'v0.12 locked synthetic proposals');
});
