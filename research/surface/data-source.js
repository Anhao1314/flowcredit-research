// Read-only data access for the local Research Surface (UI-0).
//
// This module reads existing persisted artifacts only:
//   - Research Memory SQLite (records + optional admission_reviews tables)
//   - v0.12 locked synthetic proposal artifacts (demo mode only)
//
// It never opens a writable connection, never migrates, never mutates, and
// never writes runtime data. Hash verification mirrors research/claim-revision/reader.js.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../src/identity.js';

export const DEFAULT_MEMORY_DIR = join(homedir(), 'fc-agent', 'research-memory');
export const DEFAULT_MEMORY_CANDIDATES = ['v0.4-recovery-final.sqlite', 'v0.2-coreweave.sqlite'];
export const DEFAULT_DEMO_DIR = join(homedir(), 'fc-agent', 'research-claim-revision', 'locked');
export const DEMO_FALLBACK_FILE = fileURLToPath(new URL('../eval/claim-revision/pending-example.json', import.meta.url));

export class SurfaceDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SurfaceDataError';
    this.code = code;
  }
}

export function resolveMemoryPath(env = process.env) {
  if (env.FC_SURFACE_MEMORY_DB) return env.FC_SURFACE_MEMORY_DB;
  for (const name of DEFAULT_MEMORY_CANDIDATES) {
    const candidate = join(DEFAULT_MEMORY_DIR, name);
    if (existsSync(candidate)) return candidate;
  }
  return join(DEFAULT_MEMORY_DIR, DEFAULT_MEMORY_CANDIDATES[0]);
}

export function resolveDemoDir(env = process.env) {
  return env.FC_SURFACE_DEMO_DIR || DEFAULT_DEMO_DIR;
}

export class MemorySource {
  #db;
  #cache = new Map();
  #reviews = null;

  constructor(filename) {
    this.filename = filename;
    this.fileLabel = basename(filename);
    let db;
    try {
      db = new DatabaseSync(filename, { readOnly: true, allowExtension: false });
    } catch {
      throw new SurfaceDataError('MEMORY_MISSING', `Research Memory file not found: ${filename}`);
    }
    this.#db = db;
    try {
      db.exec('PRAGMA query_only=ON');
      const version = db.prepare('PRAGMA user_version').get().user_version;
      if (version !== 2) throw new SurfaceDataError('MEMORY_VERSION', `Unsupported Research Memory storage version: ${version}`);
    } catch (error) {
      db.close();
      if (error instanceof SurfaceDataError) throw error;
      throw new SurfaceDataError('MEMORY_UNREADABLE', `Research Memory is not readable: ${error.message}`);
    }
  }

  static open(filename = resolveMemoryPath()) {
    return new MemorySource(filename);
  }

  #decode(row) {
    const payload = JSON.parse(row.payload);
    if (digest(payload) !== row.content_hash) throw new SurfaceDataError('MEMORY_HASH', `Research Memory hash mismatch for record ${row.id}`);
    return payload;
  }

  #list(kind) {
    if (!this.#cache.has(kind)) {
      const rows = this.#db.prepare('SELECT kind,id,payload,content_hash FROM records WHERE kind=? ORDER BY id').all(kind);
      this.#cache.set(kind, rows.map((row) => this.#decode(row)));
    }
    return this.#cache.get(kind);
  }

  #index(kind) {
    const key = `${kind}Index`;
    if (!this.#cache.has(key)) this.#cache.set(key, new Map(this.#list(kind).map((record) => [record.id, record])));
    return this.#cache.get(key);
  }

  identities() { return this.#list('identity'); }
  revisions() { return this.#list('revision'); }
  evidenceList() { return this.#list('evidence'); }
  sources() { return this.#list('source'); }
  corrections() { return this.#list('correction'); }

  identity(id) { return this.#index('identity').get(id) ?? null; }
  revision(id) { return this.#index('revision').get(id) ?? null; }
  evidence(id) { return this.#index('evidence').get(id) ?? null; }
  source(id) { return this.#index('source').get(id) ?? null; }

  revisionsOf(claimId) {
    return this.revisions().filter((revision) => revision.claimId === claimId).sort((a, b) => a.version - b.version);
  }

  currentRevision(claimId) {
    return this.revisionsOf(claimId).at(-1) ?? null;
  }

  evidenceBySubject(subjectId) {
    return this.evidenceList().filter((record) => record.subjectId === subjectId);
  }

  sourcesBySubject(subjectId) {
    return this.sources().filter((record) => record.subjectId === subjectId);
  }

  hasAdmissionTable() {
    return Boolean(this.#db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admission_reviews'").get());
  }

  reviews() {
    if (this.#reviews) return this.#reviews;
    this.#reviews = this.hasAdmissionTable()
      ? this.#db.prepare('SELECT id,payload,content_hash FROM admission_reviews ORDER BY created_at,id').all().map((row) => this.#decode(row))
      : [];
    return this.#reviews;
  }

  reviewsForEvidence(evidenceId) {
    return this.reviews().filter((review) => review.resultingEvidenceId === evidenceId);
  }

  reviewedEvidenceIds() {
    return new Set(this.reviews().map((review) => review.resultingEvidenceId).filter(Boolean));
  }

  claimReferences(evidenceId) {
    const references = [];
    for (const revision of this.revisions()) {
      const claim = revision.claim ?? {};
      if ((claim.supportingEvidenceIds ?? []).includes(evidenceId)) references.push({ claimId: revision.claimId, statement: claim.statement ?? null, role: 'supporting' });
      else if ((claim.counterEvidenceIds ?? []).includes(evidenceId)) references.push({ claimId: revision.claimId, statement: claim.statement ?? null, role: 'counter' });
    }
    return references;
  }

  counts() {
    return {
      claims: this.identities().length,
      revisions: this.revisions().length,
      evidence: this.evidenceList().length,
      sources: this.sources().length,
      reviews: this.reviews().length,
      corrections: this.corrections().length
    };
  }

  // Stable digest over persisted hashes only; used by tests as a no-mutation proof.
  authorityDigest() {
    const records = this.#db.prepare('SELECT kind,id,content_hash FROM records ORDER BY kind,id').all();
    const reviews = this.hasAdmissionTable() ? this.#db.prepare('SELECT id,content_hash FROM admission_reviews ORDER BY id').all() : [];
    return digest({ records, reviews });
  }

  close() {
    this.#db.close();
  }
}

function normalizeLockedCase(caseId, proposal, memory) {
  const claimId = proposal.claimId;
  const revision = memory?.currentRevision(claimId) ?? null;
  const claim = revision?.claim ?? null;
  const availability = new Map((proposal.newEvidenceAvailableAt ?? []).map((entry) => [entry.evidenceId, entry]));
  const evidence = (proposal.evidenceIds ?? []).map((id) => {
    const record = memory?.evidence(id) ?? null;
    return {
      id,
      statement: record?.statement ?? null,
      page: record?.page ?? null,
      availableAt: availability.get(id)?.availableAt ?? null,
      knowledgeAt: availability.get(id)?.knowledgeAt ?? null
    };
  });
  return {
    caseId,
    origin: 'v0.12 locked synthetic benchmark case',
    proposalId: proposal.proposalId,
    impact: proposal.impact ?? null,
    suggestedStatus: proposal.suggestedStatus ?? null,
    suggestedConfidenceDirection: proposal.suggestedConfidenceDirection ?? null,
    reasonCode: proposal.reasonCode ?? null,
    reasonSummary: proposal.reasonSummary ?? null,
    proposalCreatedAt: proposal.proposalCreatedAt ?? null,
    asOf: proposal.asOf ?? null,
    model: proposal.modelProvider ? `${proposal.modelProvider} ${proposal.modelName ?? ''}`.trim() : null,
    baseRevisionId: proposal.baseRevisionId ?? null,
    claim: claim
      ? { claimId, statement: claim.statement ?? null, status: claim.status ?? null, confidence: claim.confidence ?? null, category: claim.category ?? null }
      : null,
    evidence,
    attributions: (proposal.attributions ?? []).map((attribution) => ({
      evidenceId: attribution.evidenceId ?? null,
      relation: attribution.relation ?? 'unclear',
      quote: attribution.quote ?? '',
      contextOnly: Boolean(attribution.contextOnly)
    }))
  };
}

function loadLockedCase(folderName, folder) {
  const proposalFile = join(folder, 'proposals.sqlite');
  if (!existsSync(proposalFile)) return null;
  let proposalsDb;
  try {
    proposalsDb = new DatabaseSync(proposalFile, { readOnly: true, allowExtension: false });
    proposalsDb.exec('PRAGMA query_only=ON');
  } catch {
    return null;
  }
  try {
    const rows = proposalsDb.prepare('SELECT payload,hash FROM proposals ORDER BY id').all();
    const cases = [];
    let memory = null;
    const memoryFile = join(folder, 'memory.sqlite');
    if (existsSync(memoryFile)) {
      try { memory = MemorySource.open(memoryFile); } catch { memory = null; }
    }
    try {
      for (const row of rows) {
        const proposal = JSON.parse(row.payload);
        if (row.hash && digest(proposal) !== row.hash) continue;
        if (!proposal.proposalId || !proposal.claimId) continue;
        cases.push(normalizeLockedCase(folderName, proposal, memory));
      }
    } finally {
      memory?.close();
    }
    return cases;
  } catch {
    return [];
  } finally {
    proposalsDb.close();
  }
}

function loadFrozenExample(file) {
  if (!existsSync(file)) return null;
  try {
    const record = JSON.parse(readFileSync(file, 'utf8'));
    const attributions = String(record.reasonSummary ?? '')
      .split('\n')
      .map((line) => {
        const split = line.indexOf(':');
        if (split <= 0) return null;
        return { evidenceId: null, relation: line.slice(0, split).trim(), quote: line.slice(split + 1).trim(), contextOnly: false };
      })
      .filter(Boolean);
    return {
      caseId: record.caseId ?? 'SYNTHETIC',
      origin: 'v0.12 frozen pending example (isolated synthetic locked artifact)',
      proposalId: record.proposalId ?? null,
      impact: record.impact ?? null,
      suggestedStatus: record.suggestedStatus ?? null,
      suggestedConfidenceDirection: null,
      reasonCode: null,
      reasonSummary: record.reasonSummary ?? null,
      proposalCreatedAt: null,
      asOf: null,
      model: null,
      baseRevisionId: record.baseRevisionId ?? null,
      claim: null,
      evidence: (record.evidenceIds ?? []).map((id) => ({ id, statement: null, page: null, availableAt: null, knowledgeAt: null })),
      attributions,
      validated: Boolean(record.validated),
      state: record.state ?? 'pending',
      reviewCount: record.reviewCount ?? 0,
      authoritativeRevisionWritten: Boolean(record.authoritativeRevisionWritten)
    };
  } catch {
    return null;
  }
}

export function loadDemoCases({ dir = resolveDemoDir(), fallback = DEMO_FALLBACK_FILE } = {}) {
  const cases = [];
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).sort()) {
      if (!name.startsWith('LOCK-')) continue;
      const loaded = loadLockedCase(name, join(dir, name));
      if (loaded?.length) cases.push(...loaded);
      if (cases.length >= 3) break;
    }
  }
  if (cases.length) {
    return { source: 'locked-runtime', label: `v0.12 locked synthetic proposals (${dir})`, cases: cases.slice(0, 3) };
  }
  const example = loadFrozenExample(fallback);
  if (example) {
    return { source: 'frozen-artifact', label: 'v0.12 frozen synthetic pending example (research/eval/claim-revision/pending-example.json)', cases: [example] };
  }
  return { source: 'none', label: 'no synthetic demo cases available', cases: [] };
}
