import { assertSchema } from "./schema.js";
import { stableId, uniqueIndex } from "./identity.js";
export function validateClaims(evidence, claims) {
  const index = uniqueIndex(evidence, "evidence");
  uniqueIndex(claims, "claim");
  for (const claim of claims) {
    assertSchema("claim", claim);
    const references = [...claim.supportingEvidenceIds, ...claim.counterEvidenceIds];
    if (claim.supportingEvidenceIds.some(id => claim.counterEvidenceIds.includes(id))) throw new Error("Evidence cannot both support and counter a claim");
    for (const id of references) {
      const item = index.get(id);
      if (!item) throw new Error(`Orphan claim reference: ${id}`);
      if (item.subjectId !== claim.subjectId) throw new Error("Cross-subject claim");
      if (claim.status === "supported" && item.verificationLevel !== "primary_source") throw new Error("Supported claim requires verified source evidence");
    }
    if (claim.status === "supported" && claim.counterEvidenceIds.length) throw new Error("Supported claim has counter evidence; use disputed or partially_supported");
  }
  return claims;
}
export function buildClaims(subjectId, evidence, specs, asOf) {
  if (!Number.isFinite(Date.parse(asOf))) throw new Error("Explicit valid claim as-of required");
  const claims = specs.map(spec => {
    if (!['gte', 'lt'].includes(spec.operator) || typeof spec.threshold !== "number" || !Number.isFinite(spec.threshold) || !Number.isInteger(spec.maxAgeDays) || spec.maxAgeDays < 0) throw new Error("Unsupported claim predicate");
    const candidates = evidence.filter(item => item.subjectId === subjectId && item.researchField === spec.researchField && item.metric === spec.metric && item.unit === spec.unit && typeof item.normalizedValue === "number" && item.verificationLevel === "primary_source");
    const latestDate = candidates.map(item => item.observedAt).sort().at(-1);
    const latest = candidates.filter(item => item.observedAt === latestDate);
    const supports = latest.filter(item => spec.operator === "gte" ? item.normalizedValue >= spec.threshold : item.normalizedValue < spec.threshold);
    const counters = latest.filter(item => !supports.includes(item));
    const future = latestDate && Date.parse(latestDate) > Date.parse(asOf);
    if (future) throw new Error("Claim evidence after as-of");
    let status = supports.length ? counters.length ? "disputed" : "supported" : "unverified";
    if (latestDate && (Date.parse(asOf) - Date.parse(latestDate)) / 86400000 > spec.maxAgeDays) status = "stale";
    const claim = { subjectId, statement: spec.statement, category: spec.researchField,
      supportingEvidenceIds: supports.map(item => item.id).sort(), counterEvidenceIds: counters.map(item => item.id).sort(),
      confidence: supports.length ? Math.min(...supports.map(item => item.confidence)) : 0, status,
      method: `Latest observed ${spec.metric} ${spec.operator} ${spec.threshold} ${spec.unit}; stale after ${spec.maxAgeDays} days. This is an explicit research predicate, not a risk decision.`,
      createdAt: asOf, updatedAt: asOf };
    claim.id = stableId("CLAIM", { subjectId, spec });
    return claim;
  });
  return validateClaims(evidence, claims);
}
