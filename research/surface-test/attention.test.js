// Attention-layer tests (UI-1): every Inbox number must be recomputed from
// persisted records, never hard-coded, and no invented signals may exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { buildAttention } from '../surface/projection.js';
import { MemorySource, resolveMemoryPath } from '../surface/data-source.js';
import { buildFixture } from './fixtures.js';

const REAL_MEMORY = resolveMemoryPath();
const REAL_MEMORY_AVAILABLE = existsSync(REAL_MEMORY) && /coreweave|recovery-final/.test(REAL_MEMORY);

function expectedFromSource(source) {
  const linked = new Set();
  for (const identity of source.identities()) {
    const revision = source.currentRevision(identity.id);
    for (const id of revision?.claim?.supportingEvidenceIds ?? []) linked.add(id);
    for (const id of revision?.claim?.counterEvidenceIds ?? []) linked.add(id);
  }
  const evidence = source.evidenceList();
  const reviewed = source.reviewedEvidenceIds();
  const thinClaims = source.identities().filter((identity) => {
    const revision = source.currentRevision(identity.id);
    return (revision?.claim?.supportingEvidenceIds ?? []).length <= 1;
  });
  const timestamps = [
    ...evidence.map((record) => record.createdAt),
    ...source.revisions().map((revision) => revision.createdAt),
    ...source.reviews().map((review) => review.recordedAt)
  ].filter(Boolean).sort();
  return {
    unlinked: evidence.filter((record) => !linked.has(record.id)).length,
    reviewed: evidence.filter((record) => reviewed.has(record.id)).length,
    thin: thinClaims.length,
    totalClaims: source.identities().length,
    latestActivityAt: timestamps.at(-1) ?? null
  };
}

test('attention counts match the fixture records exactly', () => {
  const fixture = buildFixture({ extraEvidence: 30 });
  const source = MemorySource.open(fixture.memoryPath);
  try {
    const attention = buildAttention(source);
    const expected = expectedFromSource(source);
    assert.equal(attention.unlinked.count, expected.unlinked);
    assert.equal(attention.unlinked.count, 30);
    assert.equal(attention.unlinked.examples.length, 3, 'examples are capped');
    assert.equal(attention.recent.items.length, 5, 'recent list is capped');
    assert.equal(attention.recent.count, 32);
    assert.equal(attention.reviewed.count, expected.reviewed);
    assert.equal(attention.reviewed.count, 1);
    assert.equal(attention.partialProvenance.count, 31);
    assert.equal(attention.thinSupport.count, expected.thin);
    assert.equal(attention.thinSupport.total, expected.totalClaims);
    assert.equal(attention.zeroSupport.count, 0);
    assert.equal(attention.latestActivityAt, expected.latestActivityAt);
    assert.equal(attention.latestActivityAt, '2026-05-10T10:30:00Z');
    const rows = [...attention.unlinked.examples, ...attention.recent.items];
    for (const row of rows) {
      assert.ok(row.evidenceId.startsWith('EVID-'));
      assert.ok(!('risk' in row) && !('score' in row) && !('severity' in row));
    }
  } finally {
    source.close();
    fixture.cleanup();
  }
});

test('attention carries no invented risk or scoring signals', () => {
  const fixture = buildFixture();
  const source = MemorySource.open(fixture.memoryPath);
  try {
    const attention = buildAttention(source);
    for (const forbidden of ['risk', 'score', 'severity', 'alert', 'priority', 'confidence']) {
      assert.ok(!(forbidden in attention), `attention must not expose ${forbidden}`);
    }
    for (const block of ['unlinked', 'recent', 'reviewed', 'thinSupport', 'zeroSupport']) {
      assert.ok(block in attention || block === 'zeroSupport');
    }
    assert.equal(attention.zeroSupport.count, 0);
    assert.equal(attention.thinSupport.count, 2);
    assert.equal(attention.thinSupport.total, 2);
  } finally {
    source.close();
    fixture.cleanup();
  }
});

test('real Research Memory attention numbers are recomputed, not stored', { skip: !REAL_MEMORY_AVAILABLE ? 'real Research Memory not present' : false }, () => {
  const source = MemorySource.open(REAL_MEMORY);
  try {
    const attention = buildAttention(source);
    const expected = expectedFromSource(source);
    assert.equal(attention.unlinked.count, expected.unlinked);
    assert.equal(attention.reviewed.count, expected.reviewed);
    assert.equal(attention.thinSupport.count, expected.thin);
    assert.equal(attention.thinSupport.total, expected.totalClaims);
    assert.equal(attention.zeroSupport.count, 0);
    assert.equal(attention.latestActivityAt, expected.latestActivityAt);
    if (REAL_MEMORY.includes('v0.4-recovery-final')) {
      assert.equal(attention.unlinked.count, 28);
      assert.equal(attention.recent.count, 32);
      assert.equal(attention.reviewed.count, 13);
      assert.equal(attention.thinSupport.count, 4);
      assert.equal(attention.thinSupport.total, 4);
    }
  } finally {
    source.close();
  }
});
