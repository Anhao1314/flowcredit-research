#!/usr/bin/env node
// Deterministic public-demo builder for the FlowCredit Research Surface.
//
// Reads the human-readable seed.json next to this file and expands it into a
// read-only Research Memory SQLite database (storage version 2) that the
// surface opens exactly like a real Research Memory.
//
// Public-safety / determinism contract:
//   - the subject, sources, facts and figures are entirely synthetic;
//   - no wall clock, no randomness, no network, no machine/user paths;
//   - every id and timestamp is fixed by this file, so two builds emit the
//     same logical records (same ids, same counts, same timestamps);
//   - the output lives outside the repository (default /tmp) and is the only
//     thing written. Nothing under the repository is created or modified.
//
// Usage:
//   node research/surface/fixtures/public-demo/build.js [output.sqlite]
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../../../src/identity.js';

export const DEFAULT_OUTPUT = '/tmp/flowcredit-public-demo.sqlite';
const SEED_PATH = fileURLToPath(new URL('./seed.json', import.meta.url));

// Fixed ingestion clock. These are *record* timestamps (when the synthetic
// facts were admitted to this synthetic memory), not the current time.
const SOURCE_AT = '2026-08-10T08:00:00Z';
const EVIDENCE_BASE = '2026-08-10T09:00:00Z';
const CLAIM_AT = '2026-08-10T12:00:00Z';
const REVIEW_BASE = '2026-08-10T13:00:00Z';

function fixedMinute(baseIso, index) {
  const base = new Date(baseIso);
  return new Date(base.getTime() + index * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function loadSeed(seedPath = SEED_PATH) {
  return JSON.parse(readFileSync(seedPath, 'utf8'));
}

// Expand the compact, human-readable seed into fully-shaped, immutable records.
export function expandSeed(seed) {
  const subjectId = seed.subject.id;
  const sourcesByKey = new Map(seed.sources.map((source) => [source.key, source]));

  const sourceRecords = seed.sources.map((source) => ({
    id: source.id,
    subjectId,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    sourceType: source.sourceType,
    isPrimarySource: true,
    documentDate: source.documentDate,
    fiscalPeriod: source.fiscalPeriod,
    fiscalYear: source.fiscalYear,
    retrievedAt: SOURCE_AT,
    contentHash: null,
    metadata: {},
    createdAt: SOURCE_AT
  }));

  const evidenceRecords = seed.evidence.map((entry, index) => {
    const source = sourcesByKey.get(entry.source);
    if (!source) throw new Error(`Evidence ${entry.id} references unknown source key ${entry.source}`);
    return {
      id: entry.id,
      subjectId,
      sourceId: source.id,
      statement: entry.statement,
      category: entry.category,
      metric: entry.metric ?? null,
      scope: 'consolidated_company',
      rawValue: entry.rawValue ?? null,
      rawUnit: entry.rawUnit ?? null,
      unit: entry.rawUnit ?? null,
      periodStart: entry.periodStart ?? null,
      periodEnd: entry.periodEnd ?? null,
      observedAt: entry.observedAt ?? null,
      page: entry.page ?? null,
      section: entry.section ?? null,
      location: entry.location ?? null,
      verificationLevel: 'primary_source',
      provenance: { method: 'reviewed_primary_disclosure', publisher: source.publisher, sourceContentHash: null },
      contentHash: null,
      // Fixed, monotonically non-decreasing admission time (index follows seed order).
      createdAt: fixedMinute(EVIDENCE_BASE, index)
    };
  });

  const evidenceIds = new Set(evidenceRecords.map((record) => record.id));
  const identityRecords = [];
  const revisionRecords = [];
  for (const claim of seed.claims) {
    for (const id of [...claim.supporting, ...claim.counter]) {
      if (!evidenceIds.has(id)) throw new Error(`Claim ${claim.id} references unknown Evidence ${id}`);
    }
    // Deliberately no generic Claim confidence score is written.
    const storedClaim = {
      id: claim.id,
      subjectId,
      statement: claim.statement,
      status: claim.status,
      category: claim.category,
      method: 'Synthetic public-demo record; human-researched belief, not model output.',
      supportingEvidenceIds: [...claim.supporting],
      counterEvidenceIds: [...claim.counter],
      createdAt: CLAIM_AT,
      updatedAt: CLAIM_AT
    };
    identityRecords.push({ id: claim.id, subjectId, createdAt: CLAIM_AT });
    revisionRecords.push({
      id: `${claim.id}:v1`,
      claimId: claim.id,
      subjectId,
      version: 1,
      previousVersion: null,
      previousRevisionId: null,
      revisionReason: 'initial_ingest',
      note: '',
      effectiveAt: CLAIM_AT,
      createdAt: CLAIM_AT,
      staleEvaluation: null,
      claim: storedClaim
    });
  }

  const reviewRecords = seed.reviews.map((entry, index) => {
    if (!evidenceIds.has(entry.evidenceId)) throw new Error(`Review ${entry.reviewId} references unknown Evidence ${entry.evidenceId}`);
    const evidence = evidenceRecords.find((record) => record.id === entry.evidenceId);
    const recordedAt = fixedMinute(REVIEW_BASE, index);
    return {
      id: entry.reviewId,
      candidateId: entry.reviewId.replace('REVIEW-', 'CANDIDATE-'),
      version: 1,
      previousId: null,
      evidenceKind: 'evidence',
      evidenceId: entry.evidenceId,
      recordedAt,
      payload: {
        id: entry.reviewId,
        candidateId: entry.reviewId.replace('REVIEW-', 'CANDIDATE-'),
        subjectId,
        decision: 'accepted',
        reviewerType: 'human',
        reviewerId: 'research-desk',
        reasonCode: 'verified_primary_source',
        outcome: 'accepted',
        recordedAt,
        resultingEvidenceId: entry.evidenceId,
        snapshot: {
          candidate: {
            id: entry.reviewId.replace('REVIEW-', 'CANDIDATE-'),
            chunkId: entry.reviewId.replace('REVIEW-', 'CHUNK-'),
            locator: { raw: { page: evidence.page } },
            quotedText: entry.excerpt
          }
        }
      }
    };
  });

  return { subjectId, sourceRecords, evidenceRecords, identityRecords, revisionRecords, reviewRecords };
}

function createSchema(db) {
  db.exec('PRAGMA journal_mode=MEMORY');
  db.exec(`CREATE TABLE records (
    kind TEXT NOT NULL CHECK(kind IN ('source','evidence','identity','revision','correction')),
    id TEXT NOT NULL, subject_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
    content_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(kind,id)
  ) STRICT;
  CREATE TABLE admission_reviews (
    id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
    previous_id TEXT, payload TEXT NOT NULL CHECK(json_valid(payload)),
    content_hash TEXT NOT NULL, created_at TEXT NOT NULL,
    evidence_kind TEXT CHECK(evidence_kind='evidence'), evidence_id TEXT,
    UNIQUE(candidate_id,version)
  ) STRICT;`);
}

// Build the SQLite file. Returns a deterministic logical summary used by tests.
export function buildPublicDemo(outputPath = DEFAULT_OUTPUT, { seed = loadSeed(), log = null } = {}) {
  const expanded = expandSeed(seed);
  mkdirSync(dirname(outputPath), { recursive: true });
  if (existsSync(outputPath)) rmSync(outputPath, { force: true });

  const db = new DatabaseSync(outputPath);
  try {
    createSchema(db);
    const insertRecord = db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)');
    const ordered = [
      ...expanded.sourceRecords.map((payload) => ['source', payload, payload.createdAt]),
      ...expanded.evidenceRecords.map((payload) => ['evidence', payload, payload.createdAt]),
      ...expanded.identityRecords.map((payload) => ['identity', payload, payload.createdAt]),
      ...expanded.revisionRecords.map((payload) => ['revision', payload, payload.createdAt])
    ];
    for (const [kind, payload, createdAt] of ordered) {
      insertRecord.run(kind, payload.id, payload.subjectId, JSON.stringify(payload), digest(payload), createdAt);
    }
    const insertReview = db.prepare('INSERT INTO admission_reviews VALUES(?,?,?,?,?,?,?,?,?)');
    for (const review of expanded.reviewRecords) {
      insertReview.run(review.id, review.candidateId, review.version, review.previousId,
        JSON.stringify(review.payload), digest(review.payload), review.recordedAt,
        review.evidenceKind, review.evidenceId);
    }
    db.exec('PRAGMA user_version=2');
  } finally {
    db.close();
  }

  const summary = {
    outputPath,
    subjectId: expanded.subjectId,
    counts: {
      sources: expanded.sourceRecords.length,
      evidence: expanded.evidenceRecords.length,
      claims: expanded.identityRecords.length,
      revisions: expanded.revisionRecords.length,
      reviews: expanded.reviewRecords.length
    },
    ids: {
      sources: expanded.sourceRecords.map((record) => record.id),
      evidence: expanded.evidenceRecords.map((record) => record.id),
      claims: expanded.identityRecords.map((record) => record.id)
    },
    timestamps: {
      evidence: expanded.evidenceRecords.map((record) => record.createdAt),
      reviews: expanded.reviewRecords.map((record) => record.recordedAt)
    }
  };
  log?.log?.(`Public demo Research Memory written: ${outputPath}`);
  log?.log?.(`  ${summary.counts.claims} Claims · ${summary.counts.evidence} Evidence · ${summary.counts.sources} Sources · ${summary.counts.reviews} human admission reviews`);
  return summary;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const outputPath = process.argv[2] ?? DEFAULT_OUTPUT;
  const summary = buildPublicDemo(outputPath, { log: console });
  process.stdout.write(`${JSON.stringify(summary.counts)}\n`);
}
