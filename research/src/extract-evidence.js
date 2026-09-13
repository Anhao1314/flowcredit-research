import { assertSchema } from "./schema.js";
import { digest, stableId, uniqueIndex } from "./identity.js";

export function evidencePayload(item) {
  const { id, contentHash, createdAt, ...payload } = item;
  return payload;
}
function normalizeValue(item) {
  if (item.normalization === "identity") {
    if (item.rawUnit !== item.unit) throw new Error("Identity conversion cannot change units");
    return item.rawValue;
  }
  const factors = { usd_millions_to_usd: 1e6, usd_billions_to_usd: 1e9 };
  const expected = item.normalization === "usd_millions_to_usd" ? "USD_millions" : "USD_billions";
  if (!factors[item.normalization] || typeof item.rawValue !== "number" || !Number.isFinite(item.rawValue) || item.rawUnit !== expected || item.unit !== "USD") throw new Error("Invalid explicit unit conversion");
  return item.rawValue * factors[item.normalization];
}
export function validateEvidence(sources, evidence) {
  for (const source of sources) assertSchema("source", source);
  const index = uniqueIndex(sources, "source");
  uniqueIndex(evidence, "evidence");
  for (const item of evidence) {
    assertSchema("evidence", item);
    if (digest(item.normalizedValue) !== digest(normalizeValue(item))) throw new Error("Evidence normalization mismatch");
    const source = index.get(item.sourceId);
    if (!source) throw new Error(`Orphan evidence: ${item.id}`);
    if (source.subjectId !== item.subjectId) throw new Error("Cross-subject evidence");
    if (item.provenance.publisher !== source.publisher || item.provenance.sourceContentHash !== source.contentHash) throw new Error("Evidence provenance mismatch");
    if (item.verificationLevel === "primary_source" && !source.isPrimarySource) throw new Error("Secondary source cannot be primary evidence");
    if (Date.parse(item.observedAt) > Date.parse(source.documentDate)) throw new Error("Evidence observation after document publication");
    if (Date.parse(item.createdAt) < Date.parse(source.retrievedAt)) throw new Error("Evidence created before retrieval");
    if (item.periodStart && item.periodEnd && Date.parse(item.periodStart) > Date.parse(item.periodEnd)) throw new Error("Reversed evidence period");
    if (item.contentHash !== digest(evidencePayload(item))) throw new Error("Evidence content hash mismatch");
    if (item.id !== stableId("EVID", evidencePayload(item))) throw new Error("Evidence identity mismatch");
  }
  return evidence;
}

// Deterministic extraction from explicitly reviewed observations. Not a PDF parser,
// financial interpretation model, independent verification or live connector.
export function extractEvidence(sources, observations, createdAt) {
  const byKey = new Map(sources.map(source => [source.metadata.documentKey, source]));
  if (byKey.size !== sources.length) throw new Error("Duplicate document key");
  const evidence = observations.map(input => {
    const { sourceKey, ...observation } = structuredClone(input);
    const source = byKey.get(sourceKey);
    if (!source) throw new Error(`Unknown source key: ${sourceKey}`);
    const normalizedValue = normalizeValue(observation);
    const item = { ...observation, subjectId: source.subjectId, sourceId: source.id, normalizedValue,
      provenance: { publisher: source.publisher, method: "reviewed_primary_disclosure", sourceContentHash: source.contentHash },
      verificationLevel: source.isPrimarySource ? "primary_source" : "unverified", createdAt };
    const payload = evidencePayload(item);
    item.contentHash = digest(payload);
    item.id = stableId("EVID", payload);
    return item;
  }).sort((a, b) => a.id.localeCompare(b.id));
  return validateEvidence(sources, evidence);
}
