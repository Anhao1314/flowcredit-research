// Offline tests for the local Research Surface (UI-1).
// Hermetic: fixtures live in the system temp directory; real Research Memory
// checks are skipped when the runtime data is not present.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { buildFixture, extraEvidenceId } from './fixtures.js';
import { MemorySource, resolveMemoryPath } from '../surface/data-source.js';
import { startSurface } from '../surface/server.js';

const silentLog = { log() {}, error() {} };
const REAL_MEMORY = resolveMemoryPath();
const REAL_MEMORY_AVAILABLE = existsSync(REAL_MEMORY) && /coreweave|recovery-final/.test(REAL_MEMORY);

function httpGet(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request(url, { method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function withSurface(t, run, overrides = {}, fixtureOptions = {}) {
  const fixture = buildFixture(fixtureOptions);
  t.after(() => fixture.cleanup());
  const { server, url } = await startSurface({
    port: 0,
    log: silentLog,
    memoryPath: fixture.memoryPath,
    demoDir: fixture.demoDir,
    demoFallback: fixture.fallbackPath,
    ...overrides
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return run({ ...fixture, url, server });
}

test('server binds loopback only and serves the inbox', async (t) => {
  await withSurface(t, async ({ url, server }) => {
    assert.equal(server.address().address, '127.0.0.1');
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await httpGet(`${url}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.ok(response.body.includes('Research Inbox'));
    assert.ok(response.body.includes('Fixturecorp'));
    assert.ok(response.body.includes('2 Claims'));
    assert.ok(response.body.includes('2 Evidence'));
    assert.ok(response.body.includes('1 Sources'));
    assert.ok(response.body.includes('No belief changes recorded yet.'));
    assert.ok(!response.body.includes('NVIDIA'));
    assert.ok(!response.body.includes('Nebius'));
    assert.match(response.headers['content-security-policy'], /default-src 'none'/);
    assert.match(response.headers['content-security-policy'], /form-action 'self'/);
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    const css = await httpGet(`${url}/assets/surface.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers['content-type'], /text\/css/);
    const js = await httpGet(`${url}/assets/surface.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers['content-type'], /text\/javascript/);
    assert.doesNotThrow(() => new Function(js.body));
    assert.ok(!js.body.includes('fetch('));
    assert.ok(!css.body.includes('@import'));
  });
});

test('inbox leads with attention signals recomputed from persisted data', async (t) => {
  await withSurface(t, async ({ url }) => {
    const response = await httpGet(`${url}/`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Needs attention'));
    assert.ok(response.body.includes('Evidence not yet linked to a Claim'));
    assert.ok(response.body.includes('>30</span>'));
    assert.ok(response.body.includes('Review Evidence'));
    assert.ok(response.body.includes('href="/evidence?link=unlinked"'));
    assert.ok(response.body.includes('Claims with thin evidence coverage'));
    assert.ok(response.body.includes('2 of 2'));
    assert.ok(response.body.includes('Coverage describes linked evidence volume, not Claim truth or confidence.'));
    assert.ok(response.body.includes('Recently recorded Evidence'));
    assert.ok(response.body.includes('View recent Evidence'));
    assert.ok(response.body.includes('Research completeness'));
    assert.ok(response.body.includes('1 Evidence with deeper admission provenance'));
    assert.ok(response.body.includes('31 with partial provenance'));
    assert.ok(response.body.includes('Latest Research Memory activity: '));
    assert.ok(response.body.includes('2026-05-10 10:30 UTC'));
    assert.ok(response.body.includes('What Changed'));
    assert.ok(response.body.includes('Research Memory: 1 company under research'));
    const positionInventory = response.body.indexOf('Research Memory: 1 company under research');
    const positionAttention = response.body.indexOf('Needs attention');
    assert.ok(positionAttention < positionInventory, 'attention must lead, inventory must follow');
  }, {}, { extraEvidence: 30 });
});

test('inbox hides attention blocks that have zero records', async (t) => {
  await withSurface(t, async ({ url }) => {
    const response = await httpGet(`${url}/`);
    assert.equal(response.status, 200);
    assert.ok(!response.body.includes('Evidence not yet linked to a Claim'));
    assert.ok(!response.body.includes('Claims with no supporting Evidence'));
    assert.ok(response.body.includes('Claims with thin evidence coverage'));
    assert.ok(response.body.includes('Research Memory: 1 company under research'));
  });
});

test('company page renders all fixture claims with evidence counts', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/company/${paths.subject}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Fixture claims receipts are rising.'));
    assert.ok(response.body.includes('Fixture claims costs are contained.'));
    assert.ok(response.body.includes(`/claim/${paths.claimOne}`));
    assert.ok(response.body.includes(`/claim/${paths.claimTwo}`));
    assert.ok(response.body.includes('Knowledge-map organization is not implemented yet.'));
    assert.ok(response.body.includes('Fixture quarterly report'));
    assert.ok(response.body.includes('Back to Research Inbox'));
    assert.ok(response.body.includes('/claims?subject=fixturecorp'));
    assert.ok(response.body.includes('/evidence?subject=fixturecorp'));
  });
});

test('unknown company returns a friendly 404', async (t) => {
  await withSurface(t, async ({ url }) => {
    const response = await httpGet(`${url}/company/unknown-subject`);
    assert.equal(response.status, 404);
    assert.ok(response.body.includes('Company not found'));
    assert.ok(!response.body.includes('at Object.'));
  });
});

test('claim page shows belief, evidence links and revision history', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/claim/${paths.claimOne}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Fixture claims receipts are rising.'));
    assert.ok(response.body.includes('Evidence behind it'));
    assert.ok(response.body.includes(`/evidence/${paths.evidenceOne}`));
    assert.ok(response.body.includes('Revision history'));
    assert.ok(response.body.includes('initial_ingest'));
    assert.ok(response.body.includes('Technical details'));
    assert.ok(response.body.includes('Back to Claims'));
    assert.ok(response.body.includes('Fixture quarterly report'));
    assert.ok(response.body.includes('scope="col"'));
    assert.ok(response.body.includes('<caption'));
    const missing = await httpGet(`${url}/claim/CLAIM-0000000000000000000`);
    assert.equal(missing.status, 404);
    assert.ok(missing.body.includes('Claim not found'));
  });
});

test('evidence page puts Referenced by Claims before Recorded fact', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/evidence/${paths.evidenceOne}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Referenced by Claims'));
    assert.ok(response.body.includes('Recorded fact'));
    assert.ok(response.body.indexOf('Referenced by Claims') < response.body.indexOf('>Source</h2>'),
      'Claim references must sit high, before Source/Admission/Provenance');
    assert.ok(response.body.indexOf('Referenced by Claims') < response.body.indexOf('Provenance depth'));
    assert.ok(response.body.includes('Evidence → Admission → Source'));
    assert.ok(response.body.includes('verified_existing_evidence'));
    assert.ok(response.body.includes('Fixture excerpt &lt;b&gt;bold&lt;/b&gt; &amp; text.'));
    assert.ok(response.body.includes('Fixture quarterly report'));
    assert.ok(response.body.includes(`/claim/${paths.claimOne}`));
    assert.ok(response.body.includes('not a live SourceSpan join'));
    assert.ok(response.body.includes('Technical details'));
    assert.ok(response.body.includes('scope="col"'));
    assert.ok(response.body.includes('Admission review'));
  });
});

test('evidence page states partial provenance and unlinked state honestly', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/evidence/${paths.evidenceTwo}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Evidence → Source'));
    assert.ok(response.body.includes('No admission review recorded for this Evidence record.'));
    assert.ok(response.body.includes('Deeper SourceSpan join'));
    assert.ok(response.body.includes('&lt;script&gt;alert(&#39;escape-check&#39;)&lt;/script&gt;'));
    assert.ok(!response.body.includes('<script>alert('));
  });
});

test('evidence detail states the unlinked case without implying the record is worthless', async (t) => {
  await withSurface(t, async ({ url }) => {
    const response = await httpGet(`${url}/evidence/${extraEvidenceId(1)}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Not currently linked to a Claim.'));
    assert.ok(response.body.includes('This Evidence remains in Research Memory without an active Claim relationship.'));
    assert.ok(response.body.includes('Browse Evidence not linked to a Claim'));
  }, {}, { extraEvidence: 3 });
});

test('claims index lists every Claim with filters and honest empty states', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/claims`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('All recorded research beliefs · 2 recorded'));
    assert.ok(response.body.includes(`/claim/${paths.claimOne}`));
    assert.ok(response.body.includes(`/claim/${paths.claimTwo}`));
    assert.ok(response.body.includes('Showing 1–2 of 2'));
    assert.ok(!response.body.includes(`>${paths.claimOne}<`), 'canonical ids must stay out of the row text');
    assert.ok(!response.body.includes(`>${paths.claimTwo}<`));
    assert.ok(response.body.includes('value="revenue"'));
    assert.ok(response.body.includes('value="costs"'));
    assert.ok(response.body.includes('>Supported<'));
    const filtered = await httpGet(`${url}/claims?category=costs`);
    assert.ok(filtered.body.includes('Fixture claims costs are contained.'));
    assert.ok(!filtered.body.includes('Fixture claims receipts are rising.'));
    assert.ok(filtered.body.includes('1 of 2 match the current filters'));
    const searched = await httpGet(`${url}/claims?q=RECEIPTS`);
    assert.ok(searched.body.includes('Fixture claims receipts are rising.'));
    assert.ok(!searched.body.includes('Fixture claims costs are contained.'));
    const empty = await httpGet(`${url}/claims?q=zzz-nothing`);
    assert.ok(empty.body.includes('No Claims match these filters.'));
    assert.ok(empty.body.includes('Clear filters'));
    const invalid = await httpGet(`${url}/claims?sort=bogus&page=-9`);
    assert.equal(invalid.status, 200);
    assert.ok(invalid.body.includes('Showing 1–2 of 2'));
  });
});

test('evidence index paginates, filters and searches deterministically', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const pageOne = await httpGet(`${url}/evidence`);
    assert.equal(pageOne.status, 200);
    assert.ok(pageOne.body.includes('All recorded facts · 32 records'));
    assert.ok(pageOne.body.includes('Showing 1–20 of 32'));
    assert.ok(pageOne.body.includes('aria-label="Pagination"'));
    assert.ok(pageOne.body.includes('Next →'));
    assert.ok(pageOne.body.includes('aria-current="page"'));
    assert.ok(pageOne.body.includes('>2</a>'), 'page numbers list the total pages');
    assert.ok(pageOne.body.includes('Deterministic search · matches recorded text exactly — not AI'));
    const pageTwo = await httpGet(`${url}/evidence?page=2`);
    assert.ok(pageTwo.body.includes('Showing 21–32 of 32'));
    assert.ok(pageTwo.body.includes(`/evidence/${paths.evidenceOne}`));
    assert.ok(pageTwo.body.includes(`/evidence/${paths.evidenceTwo}`));
    assert.ok(pageTwo.body.includes('← Previous'));
    const clamped = await httpGet(`${url}/evidence?page=99`);
    assert.ok(clamped.body.includes('Showing 21–32 of 32'));
    const linked = await httpGet(`${url}/evidence?link=linked`);
    assert.ok(linked.body.includes('Showing 1–2 of 2'));
    assert.ok(linked.body.includes(`/evidence/${paths.evidenceOne}`));
    assert.ok(linked.body.includes('Linked · 1 Claim'));
    const unlinked = await httpGet(`${url}/evidence?link=unlinked`);
    assert.ok(unlinked.body.includes('Showing 1–20 of 30'));
    assert.ok(!unlinked.body.includes(`/evidence/${paths.evidenceOne}`));
    assert.ok(unlinked.body.includes('Not linked to a Claim'));
    const reviewed = await httpGet(`${url}/evidence?review=reviewed`);
    assert.ok(reviewed.body.includes('Showing 1–1 of 1'));
    assert.ok(reviewed.body.includes(`/evidence/${paths.evidenceOne}`));
    const unreviewed = await httpGet(`${url}/evidence?review=unreviewed`);
    assert.ok(unreviewed.body.includes('Showing 1–20 of 31'));
    const bySource = await httpGet(`${url}/evidence?source=SRC-FIX00000000000000000002`);
    assert.ok(bySource.body.includes('Showing 1–15 of 15'));
    const byPage = await httpGet(`${url}/evidence?sort=page`);
    assert.ok(byPage.body.indexOf(`/evidence/${paths.evidenceOne}`) < byPage.body.indexOf(`/evidence/${extraEvidenceId(1)}`));
    const searched = await httpGet(`${url}/evidence?q=COMPLIANCE%20costs%20reference%20item%207`);
    assert.ok(searched.body.includes('Showing 1–1 of 1'));
    assert.ok(searched.body.includes('/evidence/EVID-FIX0'));
    const hashFree = await httpGet(`${url}/evidence?q=sha256`);
    assert.ok(hashFree.body.includes('No Evidence records match these filters.'));
    assert.ok(hashFree.body.includes('Clear filters'));
    const exactId = await httpGet(`${url}/evidence?q=${extraEvidenceId(7)}`);
    assert.ok(exactId.body.includes('Showing 1–1 of 1'), 'exact Evidence id search is a secondary path');
    const partialHash = await httpGet(`${url}/evidence?q=${extraEvidenceId(7).slice(9, 20)}`);
    assert.ok(partialHash.body.includes('No Evidence records match these filters.'), 'partial ids/hashes are never searched');
  }, {}, { extraEvidence: 30 });
});

test('evidence index rows stay dense: one metadata line and inline state chips', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/evidence`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('class="row row-dense"'), 'dense row marker drives the compact layout');
    const rows = [...response.body.matchAll(/<li class="row row-dense">([\s\S]*?)<\/li>/g)].map((match) => match[1]);
    assert.equal(rows.length, 20, 'a full page of dense rows renders');
    for (const row of rows) {
      assert.equal([...row.matchAll(/class="row-meta"/g)].length, 1, 'exactly one metadata rhythm line per row');
      assert.ok(!row.includes('row-chips'), 'no stacked chip paragraph');
      const side = row.split('class="row-side"')[1] ?? '';
      assert.equal([...side.matchAll(/<span class="chip/g)].length, 2, 'both state chips sit inline in the side slot');
      assert.match(row, /Linked · 1 Claim|Not linked to a Claim/, 'link state stays a labelled chip, never icon-only');
      assert.match(row, /Deep trace|Partial trace/, 'provenance state stays a labelled chip');
      assert.ok(!/race">\s*(Partial|Deep) provenance/.test(row), 'the index uses the shortened chip');
    }
    assert.ok(response.body.includes('Not linked to a Claim'), 'unlinked rows keep the full caution phrase');

    const single = await httpGet(`${url}/evidence?q=Fixture%20revenue%20rose`);
    const dense = [...single.body.matchAll(/<li class="row row-dense">([\s\S]*?)<\/li>/g)].map((match) => match[1])[0];
    assert.ok(dense, 'the searched Evidence record has a dense row');
    assert.ok(dense.includes(`/evidence/${paths.evidenceOne}`));
    assert.ok(dense.includes('Fixture revenue rose in December.'), 'statement stays in the row');
    assert.ok(dense.includes('Fixture quarterly report'), 'source stays in the metadata rhythm');
    assert.ok(dense.includes('2026-01-01'), 'period stays in the metadata rhythm');
    assert.ok(dense.includes('fixture_revenue'), 'metric stays in the metadata rhythm');
    assert.equal([...dense.matchAll(/<span class="sep">·<\/span>/g)].length, 2, 'three metadata items, no more');
  }, {}, { extraEvidence: 30 });
});

test('index rows carry a return context and detail pages restore it', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const filtered = '/evidence?link=linked&sort=page';
    const evidenceIndex = await httpGet(`${url}${filtered}`);
    assert.ok(evidenceIndex.body.includes(`/evidence/${paths.evidenceOne}?from=${encodeURIComponent(filtered)}`),
      'evidence row links carry the filtered index URL');
    const detail = await httpGet(`${url}/evidence/${paths.evidenceOne}?from=${encodeURIComponent(filtered)}`);
    assert.ok(detail.body.includes('>Back to Evidence</a>'));
    assert.ok(detail.body.includes('href="/evidence?link=linked&amp;sort=page"'), 'back link restores filter + sort');

    const paged = '/evidence?sort=page&page=2';
    const pagedIndex = await httpGet(`${url}${paged}`);
    assert.ok(pagedIndex.body.includes(`from=${encodeURIComponent(paged)}`), 'page number is part of the return context');
    const pagedDetail = await httpGet(`${url}/evidence/${extraEvidenceId(1)}?from=${encodeURIComponent(paged)}`);
    assert.ok(pagedDetail.body.includes('href="/evidence?sort=page&amp;page=2"'), 'back link restores page 2');

    const claimsQuery = '/claims?q=receipts&status=supported';
    const claimsIndex = await httpGet(`${url}${claimsQuery}`);
    assert.ok(claimsIndex.body.includes(`/claim/${paths.claimOne}?from=${encodeURIComponent(claimsQuery)}`),
      'claim row links carry the searched index URL');
    const claimDetail = await httpGet(`${url}/claim/${paths.claimOne}?from=${encodeURIComponent(claimsQuery)}`);
    assert.ok(claimDetail.body.includes('>Back to Claims</a>'));
    assert.ok(claimDetail.body.includes('href="/claims?q=receipts&amp;status=supported"'), 'back link restores search + status');

    const plain = await httpGet(`${url}/evidence`);
    assert.ok(!plain.body.includes('?from='), 'a clean index adds no return context');

    const demoContext = '/evidence?link=linked&demo=1';
    const demoDetail = await httpGet(`${url}/evidence/${paths.evidenceOne}?from=${encodeURIComponent(demoContext)}&demo=1`);
    assert.ok(demoDetail.body.includes('Demo mode'));
    assert.ok(demoDetail.body.includes('href="/evidence?link=linked&amp;demo=1"'), 'demo mode survives the return');
  });
});

test('hostile returnTo values fall back to the plain index without leaking', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const hostile = ['//evil.com/evidence', 'https://evil.com/evidence', 'javascript:alert(1)', 'data:text/html,evil',
      '/evidence/../../etc/passwd', '/../../etc/passwd', '/claim/CLAIM-1', '/evidenceX', '\\\\evil.com'];
    for (const value of hostile) {
      const response = await httpGet(`${url}/evidence/${paths.evidenceOne}?from=${encodeURIComponent(value)}`);
      assert.equal(response.status, 200);
      assert.ok(response.body.includes('<p class="back-link"><a href="/evidence">Back to Evidence</a></p>'),
        `plain fallback for ${JSON.stringify(value)}`);
      assert.ok(!response.body.includes('evil.com'), 'no external host reaches the page');
      assert.ok(!response.body.includes('javascript:'), 'no script URL reaches the page');
      assert.ok(!response.body.includes('etc/passwd'), 'no traversal path reaches the page');
    }
    const crossIndex = await httpGet(`${url}/claim/${paths.claimOne}?from=${encodeURIComponent('/evidence?link=linked')}`);
    assert.ok(crossIndex.body.includes('<p class="back-link"><a href="/claims">Back to Claims</a></p>'),
      'a Claims page never returns to an Evidence URL');
  });
});

test('evidence detail answers relationship and trace depth above the recorded fact', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const response = await httpGet(`${url}/evidence/${paths.evidenceOne}`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('class="context-strip"'));
    assert.ok(response.body.includes('<span class="strip-key">Referenced by</span>'));
    assert.ok(response.body.includes('<span class="strip-key">Provenance</span>'));
    assert.ok(response.body.includes('Linked to 1 Claim'));
    assert.ok(response.body.includes('Deep provenance'));
    assert.ok(response.body.includes('SourceSpan<span class="prov-note">not available yet</span>'),
      'unavailable trace depth is stated in words, not only as a shape');
    assert.ok(response.body.indexOf('class="context-strip"') < response.body.indexOf('Recorded fact'),
      'summary sits above the recorded fact');
    assert.ok(response.body.indexOf('class="context-strip"') < response.body.indexOf('Referenced by Claims'),
      'summary sits above the full context column');
    assert.ok(response.body.includes('>Provenance depth</h2>'), 'the full provenance section is still rendered');
    assert.ok(response.body.includes('Evidence → Admission → Source'));

    const unlinked = await httpGet(`${url}/evidence/${extraEvidenceId(1)}`);
    assert.ok(unlinked.body.includes('Not currently linked to a Claim.'));
    assert.ok(unlinked.body.includes('Partial provenance'));
    assert.ok(unlinked.body.includes('Admission review<span class="prov-note">not recorded</span>'));
  }, {}, { extraEvidence: 3 });
});

test('changes page is honest in real mode and offers an explicit demo switch', async (t) => {
  await withSurface(t, async ({ url }) => {
    const response = await httpGet(`${url}/changes`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('No real Claim changes yet.'));
    assert.ok(response.body.includes('has not yet produced an authoritative real proposal'));
    assert.ok(response.body.includes('<strong>0</strong> real Claim revision proposals'));
    assert.ok(response.body.includes('/changes?demo=1'));
    assert.ok(response.body.includes('base revision → new evidence → relation → impact'));
    assert.ok(response.body.includes('Browse Claims'));
    assert.ok(response.body.includes('Browse Evidence'));
    assert.ok(!response.body.includes('LOCK-99'));
    assert.ok(!response.body.includes('Synthetic proposal preview'));
  });
});

test('demo mode renders synthetic locked cases with strict isolation', async (t) => {
  await withSurface(t, async ({ url }) => {
    const response = await httpGet(`${url}/changes?demo=1`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('Synthetic proposal examples — not Research Memory.'));
    assert.ok(response.body.includes('>Demo<'));
    assert.ok(response.body.includes('case <code>LOCK-99</code>'));
    assert.ok(response.body.includes('In February, a smaller division declined'));
    assert.ok(response.body.includes('Synthetic claims receipts are broadly maintained.'));
    assert.ok(response.body.includes('href="/changes?demo=1"'));
    assert.ok(response.body.includes('role="group"'));
    assert.ok(response.body.includes('aria-pressed="false"'));
    assert.ok(response.body.includes('ClaimRevisionProposal'));
    assert.ok(response.body.includes('authoritative revision written: no'));
    assert.ok(!response.body.includes('DO-NOT-RENDER'));
    assert.ok(!response.body.includes('11434'));
  });
});

test('demo links keep demo=1 and other pages keep real mode', async (t) => {
  await withSurface(t, async ({ url }) => {
    const demoInbox = await httpGet(`${url}/?demo=1`);
    assert.equal(demoInbox.status, 200);
    assert.ok(demoInbox.body.includes('Demo mode'));
    assert.ok(demoInbox.body.includes('/company/fixturecorp?demo=1'));
    const demoClaims = await httpGet(`${url}/claims?demo=1`);
    assert.ok(demoClaims.body.includes('/claims?demo=1'));
    assert.ok(demoClaims.body.includes('name="demo" value="1"'));
    const demoEvidence = await httpGet(`${url}/evidence?demo=1`);
    assert.ok(demoEvidence.body.includes('/claims?demo=1'));
    const realInbox = await httpGet(`${url}/`);
    assert.ok(!realInbox.body.includes('Demo mode'));
  });
});

test('demo fallback artifact is used when no locked runtime exists', async (t) => {
  const fixture = buildFixture();
  t.after(() => fixture.cleanup());
  const { server, url } = await startSurface({
    port: 0,
    log: silentLog,
    memoryPath: fixture.memoryPath,
    demoDir: join(fixture.root, 'no-such-demo-dir'),
    demoFallback: fixture.fallbackPath
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await httpGet(`${url}/changes?demo=1`);
  assert.equal(response.status, 200);
  assert.ok(response.body.includes('LOCK-77'));
  assert.ok(response.body.includes('>Demo<'));
  assert.ok(response.body.includes('Fallback synthetic quote.'));
});

test('favicon is served locally and referenced from every page', async (t) => {
  await withSurface(t, async ({ url }) => {
    const svg = await httpGet(`${url}/favicon.svg`);
    assert.equal(svg.status, 200);
    assert.match(svg.headers['content-type'], /image\/svg\+xml/);
    assert.ok(svg.body.includes('<svg'));
    const legacy = await httpGet(`${url}/favicon.ico`);
    assert.equal(legacy.status, 200);
    assert.match(legacy.headers['content-type'], /image\/svg\+xml/);
    const head = await httpGet(`${url}/`);
    assert.ok(head.body.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'));
  });
});

test('accessibility basics: skip link, main target, scopes, initial aria state', async (t) => {
  await withSurface(t, async ({ url, paths }) => {
    const inbox = await httpGet(`${url}/`);
    assert.ok(inbox.body.includes('>Skip to main content</a>'));
    assert.ok(inbox.body.includes('<main class="page" id="main"'));
    const claim = await httpGet(`${url}/claim/${paths.claimOne}`);
    assert.ok(!/<th(?=[\s>])(?![^>]*scope=)/.test(claim.body), 'every th needs scope');
    assert.ok(claim.body.includes('aria-current="true"'), 'Claim detail marks the Claims section');
    const claimsIndex = await httpGet(`${url}/claims`);
    assert.ok(claimsIndex.body.includes('aria-current="page"'));
    const evidence = await httpGet(`${url}/evidence/${paths.evidenceOne}`);
    assert.ok(!/<th(?=[\s>])(?![^>]*scope=)/.test(evidence.body), 'every th needs scope');
    const demo = await httpGet(`${url}/changes?demo=1`);
    const buttons = [...demo.body.matchAll(/<button[^>]*data-preview-button[^>]*>/g)].map((match) => match[0]);
    assert.equal(buttons.length, 3);
    for (const button of buttons) assert.ok(button.includes('aria-pressed="false"'));
  });
});

test('unsupported methods return 405 and HEAD returns headers only', async (t) => {
  await withSurface(t, async ({ url }) => {
    const post = await httpGet(`${url}/`, 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    const head = await httpGet(`${url}/`, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.match(head.headers['content-type'], /text\/html/);
  });
});

test('identifiers are validated and traversal attempts are rejected', async (t) => {
  await withSurface(t, async ({ url }) => {
    for (const path of ['/company/..%2f..%2fetc%2fpasswd', '/evidence/%2e%2e%2fserver.js', '/claim/a%2Fb', '/assets/../server.js', '/assets/does-not-exist.css', '/nope']) {
      const response = await httpGet(`${url}${path}`);
      assert.equal(response.status, 404, `expected 404 for ${path}`);
    }
  });
});

test('unknown routes list the new index routes in the 404 copy', async (t) => {
  await withSurface(t, async ({ url }) => {
    const response = await httpGet(`${url}/nothing-here`);
    assert.equal(response.status, 404);
    assert.ok(response.body.includes('/claims'));
    assert.ok(response.body.includes('/evidence'));
  });
});

test('unavailable Research Memory renders a friendly read-only notice', async (t) => {
  const fixture = buildFixture();
  t.after(() => fixture.cleanup());
  const { server, url } = await startSurface({
    port: 0,
    log: silentLog,
    memoryPath: join(fixture.root, 'missing.sqlite'),
    demoDir: fixture.demoDir,
    demoFallback: fixture.fallbackPath
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await httpGet(`${url}/`);
  assert.equal(response.status, 200);
  assert.ok(response.body.includes('Research Memory unavailable'));
  assert.ok(response.body.includes('MEMORY_MISSING'));
  assert.ok(!response.body.includes('at Object.'));
});

test('browsing every route leaves all stores byte-identical (no mutation proof)', async (t) => {
  const fixture = buildFixture({ extraEvidence: 30 });
  t.after(() => fixture.cleanup());
  const proposalsPath = join(fixture.demoDir, 'LOCK-99', 'proposals.sqlite');
  const before = { memory: fileHash(fixture.memoryPath), proposals: fileHash(proposalsPath) };
  const reader = MemorySource.open(fixture.memoryPath);
  const authorityBefore = reader.authorityDigest();
  const countsBefore = reader.counts();
  reader.close();
  const { server, url } = await startSurface({ port: 0, log: silentLog, memoryPath: fixture.memoryPath, demoDir: fixture.demoDir, demoFallback: fixture.fallbackPath });
  try {
    for (const path of ['/', `/company/${fixture.paths.subject}`, `/claim/${fixture.paths.claimOne}`, `/evidence/${fixture.paths.evidenceOne}`, '/claims', '/claims?q=fixture&category=revenue', '/evidence', '/evidence?page=2', '/evidence?link=unlinked&sort=category', '/changes', '/changes?demo=1', '/?demo=1']) {
      const response = await httpGet(`${url}${path}`);
      assert.equal(response.status, 200, `expected 200 for ${path}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(fileHash(fixture.memoryPath), before.memory);
  assert.equal(fileHash(proposalsPath), before.proposals);
  const after = MemorySource.open(fixture.memoryPath);
  assert.equal(after.authorityDigest(), authorityBefore);
  assert.deepEqual(after.counts(), countsBefore);
  after.close();
});

test('real Research Memory renders with its recorded counts', { skip: !REAL_MEMORY_AVAILABLE ? 'real Research Memory not present' : false }, async (t) => {
  const source = MemorySource.open(REAL_MEMORY);
  try {
    const counts = source.counts();
    assert.equal(counts.claims, 4);
    assert.equal(counts.revisions, 4);
    assert.equal(counts.evidence, 32);
    assert.equal(counts.sources, 3);
    if (REAL_MEMORY.includes('v0.4-recovery-final')) assert.equal(counts.reviews, 13);
  } finally {
    source.close();
  }
  const { server, url } = await startSurface({ port: 0, log: silentLog, memoryPath: REAL_MEMORY });
  try {
    const response = await httpGet(`${url}/company/coreweave`);
    assert.equal(response.status, 200);
    assert.ok(response.body.includes('CoreWeave'));
    assert.match(response.body, /Current Research Claims/);
    const evidence = await httpGet(`${url}/evidence/EVID-01e98f7104a3898b78561892`);
    assert.equal(evidence.status, 200);
    assert.ok(evidence.body.includes('Provenance depth'));
    const claims = await httpGet(`${url}/claims`);
    assert.ok(claims.body.includes('All recorded research beliefs · 4 recorded'));
    assert.ok(claims.body.includes('Showing 1–4 of 4'));
    const index = await httpGet(`${url}/evidence`);
    assert.ok(index.body.includes('All recorded facts · 32 records'));
    assert.ok(index.body.includes('Showing 1–20 of 32'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
