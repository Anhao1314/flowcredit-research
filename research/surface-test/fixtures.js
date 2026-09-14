// Test fixtures for the local Research Surface.
// Builds small isolated SQLite stores in a temp directory. No real Research
// Memory data is copied here, and nothing under the repository is written.
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../src/identity.js';

function record(kind, id, subjectId, payload) {
  return { kind, id, subjectId, payload, contentHash: digest(payload) };
}

export function extraEvidenceId(index) {
  return `EVID-FIX${String(index).padStart(22, '0')}`;
}

function writeMemory(path, { records, reviews = [] }) {
  const db = new DatabaseSync(path);
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
  const insert = db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)');
  for (const entry of records) {
    insert.run(entry.kind, entry.payload.id, entry.subjectId, JSON.stringify(entry.payload), entry.contentHash, entry.payload.createdAt ?? new Date().toISOString());
  }
  const insertReview = db.prepare('INSERT INTO admission_reviews VALUES(?,?,?,?,?,?,?,?,?)');
  for (const review of reviews) {
    insertReview.run(review.id, review.candidateId, review.version, review.previousId ?? null, JSON.stringify(review.payload), digest(review.payload), review.createdAt, review.evidenceKind ?? 'evidence', review.evidenceId ?? null);
  }
  db.exec('PRAGMA user_version=2');
  db.close();
}

export function buildFixture({ extraEvidence = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fc-surface-'));
  const memoryPath = join(root, 'fixture-memory.sqlite');
  const demoDir = join(root, 'demo');
  const demoCaseDir = join(demoDir, 'LOCK-99');
  mkdirSync(demoCaseDir, { recursive: true });
  const demoMemoryPath = join(demoCaseDir, 'memory.sqlite');
  const demoProposalsPath = join(demoCaseDir, 'proposals.sqlite');
  const fallbackPath = join(root, 'demo-fallback.json');
  const missingPath = join(root, 'missing-memory.sqlite');

  const sourceRecord = {
    id: 'SRC-FIX00000000000000000001',
    subjectId: 'fixturecorp',
    title: 'Fixture quarterly report',
    publisher: 'Fixture Corp',
    url: 'https://example.invalid/fixture.pdf',
    sourceType: 'sec_10q',
    isPrimarySource: true,
    documentDate: '2026-05-01',
    fiscalPeriod: 'Q1 2026',
    fiscalYear: 2026,
    retrievedAt: '2026-05-02T00:00:00Z',
    contentHash: null,
    metadata: {},
    createdAt: '2026-05-02T00:00:00Z'
  };
  const evidenceOne = {
    id: 'EVID-FIX000000000000000001',
    subjectId: 'fixturecorp',
    sourceId: sourceRecord.id,
    statement: 'Fixture revenue rose in December.',
    category: 'revenue',
    metric: 'fixture_revenue',
    scope: 'consolidated_company',
    rawValue: 100,
    rawUnit: 'USD_millions',
    unit: 'USD',
    normalization: 'usd_millions_to_usd',
    normalizedValue: 100000000,
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    observedAt: '2026-03-31',
    page: 12,
    section: 'Note 1 - revenue',
    location: 'Printed p12; revenue row',
    confidence: 0.9,
    verificationLevel: 'primary_source',
    provenance: { method: 'reviewed_primary_disclosure', publisher: 'Fixture Corp', sourceContentHash: null },
    contentHash: null,
    createdAt: '2026-05-03T00:00:00Z'
  };
  const evidenceTwo = {
    ...evidenceOne,
    id: 'EVID-FIX000000000000000002',
    metric: 'fixture_other',
    page: 13,
    statement: "Unreferenced fixture note <script>alert('escape-check')</script> and receipts commentary.",
    createdAt: '2026-05-04T00:00:00Z'
  };
  const claimOne = {
    id: 'CLAIM-FIX0000000000000000001',
    subjectId: 'fixturecorp',
    createdAt: '2026-05-05T00:00:00Z'
  };
  const claimTwo = {
    id: 'CLAIM-FIX0000000000000000002',
    subjectId: 'fixturecorp',
    createdAt: '2026-05-05T00:00:00Z'
  };
  const revisionOne = {
    id: 'CLAIM-FIX0000000000000000001:v1',
    claimId: claimOne.id,
    subjectId: 'fixturecorp',
    version: 1,
    previousVersion: null,
    previousRevisionId: null,
    revisionReason: 'initial_ingest',
    note: '',
    effectiveAt: '2026-05-05T00:00:00Z',
    createdAt: '2026-05-05T00:00:00Z',
    staleEvaluation: null,
    claim: {
      id: claimOne.id,
      subjectId: 'fixturecorp',
      statement: 'Fixture claims receipts are rising.',
      status: 'supported',
      confidence: 0.9,
      category: 'revenue',
      method: 'Fixture predicate for surface tests.',
      supportingEvidenceIds: [evidenceOne.id],
      counterEvidenceIds: [],
      createdAt: '2026-05-05T00:00:00Z',
      updatedAt: '2026-05-05T00:00:00Z'
    }
  };
  const revisionTwo = {
    ...structuredClone(revisionOne),
    id: 'CLAIM-FIX0000000000000000002:v1',
    claimId: claimTwo.id,
    claim: {
      ...structuredClone(revisionOne.claim),
      id: claimTwo.id,
      statement: 'Fixture claims costs are contained.',
      category: 'costs',
      supportingEvidenceIds: [evidenceTwo.id]
    }
  };
  const review = {
    id: 'REVIEW-FIX0000000000000000001',
    candidateId: 'CANDIDATE-FIX00000000000000001',
    version: 1,
    payload: {
      id: 'REVIEW-FIX0000000000000000001',
      candidateId: 'CANDIDATE-FIX00000000000000001',
      subjectId: 'fixturecorp',
      decision: 'accepted',
      reviewerType: 'system_test',
      reviewerId: 'fixture-reviewer',
      reasonCode: 'verified_existing_evidence',
      outcome: 'already_accepted',
      recordedAt: '2026-05-06T00:00:00Z',
      resultingEvidenceId: evidenceOne.id,
      snapshot: {
        candidate: {
          id: 'CANDIDATE-FIX00000000000000001',
          chunkId: 'CHUNK-FIX0000000000000000001',
          locator: { raw: { page: 12 } },
          quotedText: 'Fixture excerpt <b>bold</b> & text.'
        }
      }
    },
    createdAt: '2026-05-06T00:00:00Z'
  };

  // Optional scale-up used by pagination/filter tests; the default fixture
  // stays exactly as UI-0 left it.
  const sourceRecordTwo = {
    ...sourceRecord,
    id: 'SRC-FIX00000000000000000002',
    title: 'Fixture annual report',
    sourceType: 'sec_10k',
    documentDate: '2026-02-01',
    fiscalPeriod: 'FY2025'
  };
  const extraRecords = [];
  for (let index = 1; index <= extraEvidence; index += 1) {
    const minutes = String(index % 60).padStart(2, '0');
    const hours = 10 + Math.floor(index / 60);
    extraRecords.push(record('evidence', extraEvidenceId(index), 'fixturecorp', {
      ...evidenceOne,
      id: extraEvidenceId(index),
      sourceId: index % 2 === 0 ? sourceRecordTwo.id : sourceRecord.id,
      statement: `Fixture extra evidence record ${index}: compliance costs reference item ${index}.`,
      category: ['revenue', 'costs', 'margin'][index % 3],
      metric: `fixture_extra_metric_${index}`,
      rawValue: 100 + index,
      normalizedValue: (100 + index) * 1000000,
      page: 20 + index,
      section: `Extra note ${index}`,
      location: `Printed p${20 + index}`,
      createdAt: `2026-05-10T${String(hours).padStart(2, '0')}:${minutes}:00Z`
    }));
  }

  writeMemory(memoryPath, {
    records: [
      record('source', sourceRecord.id, sourceRecord.subjectId, sourceRecord),
      ...(extraEvidence > 0 ? [record('source', sourceRecordTwo.id, sourceRecordTwo.subjectId, sourceRecordTwo)] : []),
      record('evidence', evidenceOne.id, evidenceOne.subjectId, evidenceOne),
      record('evidence', evidenceTwo.id, evidenceTwo.subjectId, evidenceTwo),
      ...extraRecords,
      record('identity', claimOne.id, claimOne.subjectId, claimOne),
      record('identity', claimTwo.id, claimTwo.subjectId, claimTwo),
      record('revision', revisionOne.id, 'fixturecorp', revisionOne),
      record('revision', revisionTwo.id, 'fixturecorp', revisionTwo)
    ],
    reviews: [review]
  });

  const syntheticSource = {
    id: 'SRC-SYN00000000000000000001',
    subjectId: 'synthetic-case',
    title: 'Synthetic fixture source',
    publisher: 'Synthetic',
    url: 'https://example.invalid/synthetic.pdf',
    sourceType: 'synthetic',
    isPrimarySource: true,
    documentDate: '2026-01-01',
    fiscalPeriod: 'FY2025',
    fiscalYear: 2025,
    retrievedAt: '2026-01-02T00:00:00Z',
    contentHash: null,
    metadata: {},
    createdAt: '2026-01-02T00:00:00Z'
  };
  const syntheticEvidence = {
    id: 'EVID-SYN0000000000000000001',
    subjectId: 'synthetic-case',
    sourceId: syntheticSource.id,
    statement: 'In February, a smaller division declined.',
    category: 'revenue',
    metric: 'synthetic_receipts',
    scope: 'consolidated_company',
    rawValue: 10,
    rawUnit: 'USD_millions',
    unit: 'USD',
    normalization: 'usd_millions_to_usd',
    normalizedValue: 10000000,
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    observedAt: '2026-02-28',
    page: 3,
    section: 'Synthetic note',
    location: 'p3',
    confidence: 0.8,
    verificationLevel: 'synthetic',
    provenance: { method: 'synthetic_fixture', publisher: 'Synthetic', sourceContentHash: null },
    contentHash: null,
    createdAt: '2026-02-02T00:00:00Z'
  };
  const syntheticClaim = { id: 'CLAIM-SYN0000000000000000001', subjectId: 'synthetic-case', createdAt: '2026-01-02T00:00:00Z' };
  const syntheticRevision = {
    id: 'CLAIM-SYN0000000000000000001:v1',
    claimId: syntheticClaim.id,
    subjectId: 'synthetic-case',
    version: 1,
    previousVersion: null,
    previousRevisionId: null,
    revisionReason: 'initial_ingest',
    note: '',
    effectiveAt: '2026-01-02T00:00:00Z',
    createdAt: '2026-01-02T00:00:00Z',
    staleEvaluation: null,
    claim: {
      id: syntheticClaim.id,
      subjectId: 'synthetic-case',
      statement: 'Synthetic claims receipts are broadly maintained.',
      status: 'supported',
      confidence: 0.8,
      category: 'revenue',
      method: 'Synthetic case predicate.',
      supportingEvidenceIds: [syntheticEvidence.id],
      counterEvidenceIds: [],
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z'
    }
  };
  writeMemory(demoMemoryPath, {
    records: [
      record('source', syntheticSource.id, syntheticSource.subjectId, syntheticSource),
      record('evidence', syntheticEvidence.id, syntheticEvidence.subjectId, syntheticEvidence),
      record('identity', syntheticClaim.id, syntheticClaim.subjectId, syntheticClaim),
      record('revision', syntheticRevision.id, 'synthetic-case', syntheticRevision)
    ]
  });

  const proposal = {
    proposalVersion: 'claim-revision-proposal/v0.12',
    proposalId: 'CRP-FIXTURE000000000000001',
    subjectId: 'synthetic-case',
    claimId: syntheticClaim.id,
    baseRevisionId: syntheticRevision.id,
    baseRevisionHash: 'sha256:fixture',
    evidenceIds: [syntheticEvidence.id],
    impact: 'weaken',
    suggestedStatus: 'partially_supported',
    suggestedConfidenceDirection: 'decrease',
    reasonCode: 'new_counter_evidence',
    reasonSummary: 'counters: In February, a smaller division declined.',
    attributions: [{ evidenceId: syntheticEvidence.id, relation: 'counters', quote: 'In February, a smaller division declined', contextOnly: false }],
    modelProvider: 'ollama',
    modelName: 'fixture-model',
    proposalCreatedAt: '2026-02-03T00:00:00Z',
    asOf: '2026-03-01T00:00:00Z',
    newEvidenceAvailableAt: [{ evidenceId: syntheticEvidence.id, availableAt: '2026-02-02T00:00:00Z', knowledgeAt: '2026-02-02T00:00:00Z' }],
    inputSnapshot: { secret_token: 'DO-NOT-RENDER-INPUT-SNAPSHOT' },
    modelOutput: { raw: 'DO-NOT-RENDER-MODEL-OUTPUT' },
    modelConfig: { endpointOrigin: 'http://127.0.0.1:11434' }
  };
  const proposals = new DatabaseSync(demoProposalsPath);
  proposals.exec(`CREATE TABLE proposals(id TEXT PRIMARY KEY,input_hash TEXT NOT NULL UNIQUE,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL) STRICT;
    CREATE TABLE reviews(id TEXT PRIMARY KEY,proposal_id TEXT NOT NULL,version INTEGER NOT NULL,previous_id TEXT,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL,UNIQUE(proposal_id,version)) STRICT;`);
  proposals.prepare('INSERT INTO proposals VALUES(?,?,?,?)').run(proposal.proposalId, digest({ fixture: true }), JSON.stringify(proposal), digest(proposal));
  proposals.close();

  writeFileSync(fallbackPath, JSON.stringify({
    kind: 'isolated synthetic locked artifact, not a post-gate demo',
    caseId: 'LOCK-77',
    proposalId: 'CRP-FALLBACK000000000001',
    claimId: 'CLAIM-FALLBACK00000000001',
    baseRevisionId: 'CLAIM-FALLBACK00000000001:v1',
    impact: 'strengthen',
    suggestedStatus: 'supported',
    evidenceIds: ['EVID-FALLBACK0000000001'],
    reasonSummary: 'supports: Fallback synthetic quote.',
    validated: true,
    state: 'pending',
    reviewCount: 0,
    authoritativeRevisionWritten: false
  }, null, 2));

  return {
    root,
    memoryPath,
    demoDir,
    fallbackPath,
    missingPath,
    paths: { claimOne: claimOne.id, claimTwo: claimTwo.id, evidenceOne: evidenceOne.id, evidenceTwo: evidenceTwo.id, subject: 'fixturecorp', syntheticClaim: syntheticClaim.id, syntheticEvidence: syntheticEvidence.id },
    cleanup: () => rmSync(root, { recursive: true, force: true })
  };
}
