// UI-only projection layer. Pure functions over a read-only MemorySource.
// These projections are additive: they do not change any domain contract and
// they never invent fields that Research Memory does not contain.
import { PAGE_SIZE, paginate } from './query.js';

const DISPLAY_NAMES = { coreweave: 'CoreWeave' };

export function displayName(subjectId) {
  if (DISPLAY_NAMES[subjectId]) return DISPLAY_NAMES[subjectId];
  return String(subjectId ?? '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function latest(current, candidate) {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate > current ? candidate : current;
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))].sort();
}

function evidenceIndex(source) {
  return new Map(source.evidenceList().map((record) => [record.id, record]));
}

function resolveEvidence(source, ids) {
  const index = evidenceIndex(source);
  const found = [];
  const missing = [];
  for (const id of ids ?? []) {
    const record = index.get(id);
    if (record) found.push(record);
    else missing.push(id);
  }
  return { found, missing };
}

function summarizeAdmission(review) {
  if (!review) return null;
  const candidate = review.snapshot?.candidate ?? null;
  return {
    reviewId: review.id,
    decision: review.decision ?? null,
    reviewerType: review.reviewerType ?? null,
    reasonCode: review.reasonCode ?? null,
    outcome: review.outcome ?? null,
    recordedAt: review.recordedAt ?? null,
    candidateId: review.candidateId ?? null,
    candidatePage: candidate?.locator?.raw?.page ?? null,
    candidateChunkId: candidate?.chunkId ?? null,
    candidateExcerpt: typeof candidate?.quotedText === 'string' ? candidate.quotedText.slice(0, 700) : null
  };
}

// Single source of truth for "which Claims reference this Evidence".
// Built from each Claim's current revision only; deterministic order.
export function evidenceLinkIndex(source) {
  const index = new Map();
  for (const identity of source.identities()) {
    const revision = source.currentRevision(identity.id);
    const claim = revision?.claim ?? null;
    if (!claim) continue;
    const add = (evidenceId, role) => {
      if (typeof evidenceId !== 'string' || !evidenceId) return;
      if (!index.has(evidenceId)) index.set(evidenceId, []);
      index.get(evidenceId).push({
        claimId: identity.id,
        role,
        status: claim.status ?? null,
        category: claim.category ?? null,
        statement: claim.statement ?? null,
        subjectId: identity.subjectId,
        updatedAt: claim.updatedAt ?? revision.createdAt ?? identity.createdAt ?? null
      });
    };
    for (const evidenceId of claim.supportingEvidenceIds ?? []) add(evidenceId, 'supporting');
    for (const evidenceId of claim.counterEvidenceIds ?? []) add(evidenceId, 'counter');
  }
  for (const links of index.values()) {
    links.sort((a, b) => a.claimId.localeCompare(b.claimId) || a.role.localeCompare(b.role));
  }
  return index;
}

// Recorded linked-Evidence counts per Claim (as stored on the current revision).
export function claimsSupportIndex(source) {
  const index = new Map();
  for (const identity of source.identities()) {
    const revision = source.currentRevision(identity.id);
    const claim = revision?.claim ?? null;
    index.set(identity.id, {
      supportCount: (claim?.supportingEvidenceIds ?? []).length,
      counterCount: (claim?.counterEvidenceIds ?? []).length
    });
  }
  return index;
}

function claimsRow(source, identity, subjects) {
  const revision = source.currentRevision(identity.id);
  const claim = revision?.claim ?? null;
  return {
    claimId: identity.id,
    subjectId: identity.subjectId,
    subjectName: subjects.get(identity.subjectId)?.displayName ?? displayName(identity.subjectId),
    statement: claim?.statement ?? null,
    category: claim?.category ?? null,
    status: claim?.status ?? null,
    version: revision?.version ?? null,
    updatedAt: claim?.updatedAt ?? revision?.createdAt ?? identity.createdAt ?? null,
    supportCount: (claim?.supportingEvidenceIds ?? []).length,
    counterCount: (claim?.counterEvidenceIds ?? []).length
  };
}

const CLAIM_COMPARATORS = {
  recent: (a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')) || a.claimId.localeCompare(b.claimId),
  oldest: (a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')) || a.claimId.localeCompare(b.claimId),
  category: (a, b) => String(a.category ?? '').localeCompare(String(b.category ?? '')) || a.claimId.localeCompare(b.claimId),
  status: (a, b) => String(a.status ?? '').localeCompare(String(b.status ?? '')) || a.claimId.localeCompare(b.claimId)
};

export function buildClaimsIndex(source, query) {
  const subjects = new Map(listSubjects(source).map((subject) => [subject.subjectId, subject]));
  const rows = source.identities().map((identity) => claimsRow(source, identity, subjects));
  const categories = uniqueSorted(rows.map((row) => row.category));
  const statuses = uniqueSorted(rows.map((row) => row.status));
  const needle = String(query.q ?? '').toLowerCase();
  const filtered = rows.filter((row) => {
    if (query.category && row.category !== query.category) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.subject && row.subjectId !== query.subject) return false;
    if (needle) {
      const haystack = `${row.statement ?? ''} ${row.category ?? ''} ${row.subjectName} ${row.subjectId}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  const comparator = CLAIM_COMPARATORS[query.sort] ?? CLAIM_COMPARATORS.recent;
  filtered.sort(comparator);
  const pagination = paginate(filtered, query.page, PAGE_SIZE.claims);
  return {
    query,
    categories,
    statuses,
    total: rows.length,
    filtersActive: Boolean(query.q || query.category || query.status || query.subject || query.sort !== 'recent'),
    pagination,
    rows: pagination.items
  };
}

const EVIDENCE_COMPARATORS = {
  recent: (a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) || a.evidenceId.localeCompare(b.evidenceId),
  oldest: (a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || a.evidenceId.localeCompare(b.evidenceId),
  category: (a, b) => String(a.category ?? '').localeCompare(String(b.category ?? '')) || a.evidenceId.localeCompare(b.evidenceId),
  page: (a, b) => (Number.isFinite(Number(a.page)) ? Number(a.page) : Number.MAX_SAFE_INTEGER) - (Number.isFinite(Number(b.page)) ? Number(b.page) : Number.MAX_SAFE_INTEGER) || a.evidenceId.localeCompare(b.evidenceId)
};

export function buildEvidenceIndex(source, query) {
  const linkIndex = evidenceLinkIndex(source);
  const reviewedIds = source.reviewedEvidenceIds();
  const sourceRecords = new Map(source.sources().map((record) => [record.id, record]));
  const subjects = new Map(listSubjects(source).map((subject) => [subject.subjectId, subject]));
  const rows = source.evidenceList().map((evidence) => {
    const sourceRecord = sourceRecords.get(evidence.sourceId) ?? null;
    const links = linkIndex.get(evidence.id) ?? [];
    return {
      evidenceId: evidence.id,
      subjectId: evidence.subjectId,
      subjectName: subjects.get(evidence.subjectId)?.displayName ?? displayName(evidence.subjectId),
      statement: evidence.statement ?? null,
      category: evidence.category ?? null,
      metric: evidence.metric ?? null,
      page: evidence.page ?? null,
      observedAt: evidence.observedAt ?? null,
      periodStart: evidence.periodStart ?? null,
      periodEnd: evidence.periodEnd ?? null,
      sourceId: evidence.sourceId ?? null,
      sourceTitle: sourceRecord?.title ?? null,
      publisher: sourceRecord?.publisher ?? null,
      createdAt: evidence.createdAt ?? null,
      reviewed: reviewedIds.has(evidence.id),
      linkCount: links.length,
      links,
      searchText: [
        evidence.statement,
        evidence.category,
        evidence.metric,
        evidence.scope,
        evidence.section,
        evidence.location,
        evidence.rawValue,
        evidence.rawUnit,
        evidence.normalizedValue,
        evidence.unit,
        evidence.periodStart,
        evidence.periodEnd,
        evidence.observedAt,
        evidence.verificationLevel,
        sourceRecord?.title,
        sourceRecord?.publisher,
        subjects.get(evidence.subjectId)?.displayName,
        evidence.subjectId
      ].filter((value) => value !== null && value !== undefined && value !== '')
        .map(String)
        .join(' \u0000 ')
        .toLowerCase()
    };
  });
  const needle = String(query.q ?? '').toLowerCase();
  const filtered = rows.filter((row) => {
    if (query.source && row.sourceId !== query.source) return false;
    if (query.subject && row.subjectId !== query.subject) return false;
    if (query.link === 'linked' && row.linkCount === 0) return false;
    if (query.link === 'unlinked' && row.linkCount > 0) return false;
    if (query.review === 'reviewed' && !row.reviewed) return false;
    if (query.review === 'unreviewed' && row.reviewed) return false;
    if (needle) {
      if (row.evidenceId.toLowerCase() === needle) return true;
      if (!row.searchText.includes(needle)) return false;
    }
    return true;
  });
  const comparator = EVIDENCE_COMPARATORS[query.sort] ?? EVIDENCE_COMPARATORS.recent;
  filtered.sort(comparator);
  const pagination = paginate(filtered, query.page, PAGE_SIZE.evidence);
  const sources = source.sources()
    .map((record) => ({ id: record.id, title: record.title ?? record.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    query,
    sources,
    total: rows.length,
    filtersActive: Boolean(query.q || query.source || query.link || query.review || query.subject || query.sort !== 'recent'),
    pagination,
    rows: pagination.items
  };
}

function latestActivityAt(source) {
  let latest = null;
  const consider = (value) => { if (value && value > (latest ?? '')) latest = value; };
  for (const evidence of source.evidenceList()) consider(evidence.createdAt);
  for (const record of source.sources()) consider(record.createdAt ?? record.retrievedAt);
  for (const revision of source.revisions()) consider(revision.createdAt ?? revision.effectiveAt);
  for (const review of source.reviews()) consider(review.recordedAt ?? review.createdAt);
  for (const correction of source.corrections()) consider(correction.createdAt ?? correction.recordedAt);
  return latest;
}

export function buildAttention(source) {
  const linkIndex = evidenceLinkIndex(source);
  const evidence = source.evidenceList();
  const reviewedIds = source.reviewedEvidenceIds();
  const byRecency = evidence.slice().sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) || a.id.localeCompare(b.id));
  const unlinked = byRecency.filter((record) => (linkIndex.get(record.id)?.length ?? 0) === 0);
  const reviewed = byRecency.filter((record) => reviewedIds.has(record.id));
  const subjects = new Map(listSubjects(source).map((subject) => [subject.subjectId, subject]));
  const claims = source.identities().map((identity) => claimsRow(source, identity, subjects));
  const thin = claims.filter((claim) => claim.supportCount <= 1);
  const zero = claims.filter((claim) => claim.supportCount === 0);
  const toRow = (record) => ({
    evidenceId: record.id,
    subjectId: record.subjectId,
    statement: record.statement ?? null,
    metric: record.metric ?? null,
    page: record.page ?? null,
    createdAt: record.createdAt ?? null
  });
  return {
    unlinked: { count: unlinked.length, examples: unlinked.slice(0, 3).map(toRow) },
    recent: { count: evidence.length, items: byRecency.slice(0, 5).map(toRow) },
    reviewed: { count: reviewed.length, examples: reviewed.slice(0, 3).map(toRow) },
    partialProvenance: { count: evidence.length - reviewed.length },
    thinSupport: {
      count: thin.length,
      total: claims.length,
      claims: thin.slice(0, 4).map((claim) => ({ claimId: claim.claimId, statement: claim.statement, supportCount: claim.supportCount }))
    },
    zeroSupport: {
      count: zero.length,
      claims: zero.slice(0, 4).map((claim) => ({ claimId: claim.claimId, statement: claim.statement }))
    },
    latestActivityAt: latestActivityAt(source)
  };
}

export function listSubjects(source) {
  const subjects = new Map();
  const ensure = (subjectId) => {
    if (!subjects.has(subjectId)) {
      subjects.set(subjectId, {
        subjectId,
        displayName: displayName(subjectId),
        claims: 0,
        revisions: 0,
        evidence: 0,
        sources: 0,
        reviewedProvenance: 0,
        latestEvidenceAt: null,
        latestRevisionAt: null,
        latestReviewAt: null
      });
    }
    return subjects.get(subjectId);
  };
  for (const identity of source.identities()) {
    ensure(identity.subjectId).claims += 1;
  }
  for (const revision of source.revisions()) {
    const entry = ensure(revision.subjectId);
    entry.revisions += 1;
    entry.latestRevisionAt = latest(entry.latestRevisionAt, revision.createdAt);
  }
  const reviewed = source.reviewedEvidenceIds();
  for (const evidence of source.evidenceList()) {
    const entry = ensure(evidence.subjectId);
    entry.evidence += 1;
    entry.latestEvidenceAt = latest(entry.latestEvidenceAt, evidence.createdAt);
    if (reviewed.has(evidence.id)) entry.reviewedProvenance += 1;
  }
  for (const record of source.sources()) {
    ensure(record.subjectId).sources += 1;
  }
  for (const review of source.reviews()) {
    const entry = subjects.get(review.subjectId);
    if (entry) entry.latestReviewAt = latest(entry.latestReviewAt, review.recordedAt);
  }
  return [...subjects.values()].sort((a, b) => a.subjectId.localeCompare(b.subjectId));
}

export function buildInbox(source) {
  const subjects = listSubjects(source);
  return {
    subjects,
    totals: {
      subjects: subjects.length,
      claims: source.identities().length,
      revisions: source.revisions().length,
      evidence: source.evidenceList().length,
      sources: source.sources().length,
      reviews: source.reviews().length,
      reviewedProvenance: source.reviewedEvidenceIds().size
    },
    revisionsAllVersionOne: source.revisions().every((revision) => revision.version === 1),
    attention: buildAttention(source)
  };
}

export function buildCompany(source, subjectId) {
  const subject = listSubjects(source).find((entry) => entry.subjectId === subjectId) ?? null;
  if (!subject) return null;
  const linkIndex = evidenceLinkIndex(source);
  const claims = source.identities()
    .filter((identity) => identity.subjectId === subjectId)
    .map((identity) => {
      const revision = source.currentRevision(identity.id);
      const claim = revision?.claim ?? null;
      const supporting = resolveEvidence(source, claim?.supportingEvidenceIds);
      const counter = resolveEvidence(source, claim?.counterEvidenceIds);
      return {
        claimId: identity.id,
        statement: claim?.statement ?? null,
        status: claim?.status ?? null,
        confidence: claim?.confidence ?? null,
        category: claim?.category ?? null,
        version: revision?.version ?? null,
        revisionReason: revision?.revisionReason ?? null,
        updatedAt: claim?.updatedAt ?? revision?.createdAt ?? identity.createdAt,
        supportCount: supporting.found.length,
        counterCount: counter.found.length,
        missingReferences: supporting.missing.length + counter.missing.length
      };
    })
    .sort((a, b) => String(a.category ?? '').localeCompare(String(b.category ?? '')) || a.claimId.localeCompare(b.claimId));
  const recentEvidence = source.evidenceBySubject(subjectId)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6)
    .map((evidence) => ({
      evidenceId: evidence.id,
      statement: evidence.statement ?? null,
      metric: evidence.metric ?? null,
      page: evidence.page ?? null,
      createdAt: evidence.createdAt ?? null,
      linkCount: (linkIndex.get(evidence.id) ?? []).length,
      reviewed: source.reviewedEvidenceIds().has(evidence.id)
    }));
  return {
    subject,
    claims,
    categories: [...new Set(claims.map((claim) => claim.category).filter(Boolean))].sort(),
    recentEvidence,
    sources: source.sourcesBySubject(subjectId)
  };
}

export function buildClaim(source, claimId) {
  const identity = source.identity(claimId);
  if (!identity) return null;
  const revisions = source.revisionsOf(claimId);
  const current = revisions.at(-1) ?? null;
  const claim = current?.claim ?? null;
  const supporting = resolveEvidence(source, claim?.supportingEvidenceIds);
  const counter = resolveEvidence(source, claim?.counterEvidenceIds);
  const toProvenance = (evidence) => {
    const sourceRecord = source.source(evidence.sourceId) ?? null;
    const admissions = source.reviewsForEvidence(evidence.id);
    return {
      evidenceId: evidence.id,
      statement: evidence.statement ?? null,
      metric: evidence.metric ?? null,
      page: evidence.page ?? null,
      section: evidence.section ?? null,
      createdAt: evidence.createdAt ?? null,
      sourceTitle: sourceRecord?.title ?? null,
      publisher: sourceRecord?.publisher ?? null,
      admission: summarizeAdmission(admissions.at(-1)),
      depth: admissions.length ? 'evidence-admission-source' : 'evidence-source'
    };
  };
  const provenance = supporting.found.map(toProvenance);
  const counterProvenance = counter.found.map(toProvenance);
  return {
    identity,
    subjectId: identity.subjectId,
    subjectName: displayName(identity.subjectId),
    revisions,
    current,
    claim,
    supporting,
    counter,
    provenance,
    counterProvenance
  };
}

export function buildEvidence(source, evidenceId) {
  const evidence = source.evidence(evidenceId);
  if (!evidence) return null;
  const sourceRecord = source.source(evidence.sourceId) ?? null;
  const admissions = source.reviewsForEvidence(evidenceId).map(summarizeAdmission);
  const superseded = source.corrections().some((correction) => correction.supersedesEvidenceId === evidenceId);
  const linkedClaims = evidenceLinkIndex(source).get(evidenceId) ?? [];
  return {
    evidence,
    source: sourceRecord,
    admissions,
    references: source.claimReferences(evidenceId),
    linkedClaims,
    superseded,
    provenanceDepth: admissions.length ? 'evidence-admission-source' : 'evidence-source'
  };
}

export function buildChanges(source) {
  const revisions = source.revisions();
  return {
    claimCount: source.identities().length,
    revisionCount: revisions.length,
    revisionVersions: [...new Set(revisions.map((revision) => revision.version))].sort((a, b) => a - b),
    evidenceCount: source.evidenceList().length,
    sourceCount: source.sources().length,
    proposals: 0
  };
}
