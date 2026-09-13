import { INTAKE_SCHEMA_V03 } from "../../agent/src/intake-v03.js";
import { contract, acceptsField, assertSchema, readJson } from "./schema.js";
import { stableId, uniqueIndex } from "./identity.js";
export const mappingRules = readJson(new URL("../rules/mappings.json", import.meta.url));
const windowDays = INTAKE_SCHEMA_V03.fields.periodStart.scoringWindowDays;
function exactCandidate(item, rule) {
  const days = (Date.parse(item.periodEnd) - Date.parse(item.periodStart)) / 86400000;
  return item.metric === rule.metric && item.unit === rule.unit && item.scope === "ai_inference_api" &&
    item.periodStart !== null && item.periodEnd !== null && days >= windowDays[0] && days <= windowDays[1] &&
    Date.parse(item.periodEnd) <= Date.parse(item.observedAt) &&
    typeof item.normalizedValue === "number" && Number.isFinite(item.normalizedValue) && acceptsField(rule.targetField, item.normalizedValue);
}
export function mapFlowCredit(evidence, rules = mappingRules) {
  for (const item of evidence) assertSchema("evidence", item);
  uniqueIndex(evidence, "mapping evidence");
  if (new Set(evidence.map(item => item.subjectId)).size > 1) throw new Error("Cannot map multiple subjects in one assessment");
  const seen = new Set();
  return rules.map(rule => {
    if (seen.has(rule.researchField)) throw new Error(`Duplicate mapping rule: ${rule.researchField}`);
    seen.add(rule.researchField);
    if (!['exact','history','traceability','integrity'].includes(rule.mode)) throw new Error(`Unknown mapping mode: ${rule.mode}`);
    if (rule.targetField && !Object.hasOwn(contract.$defs.draft.properties, rule.targetField)) throw new Error(`Mapping target absent from current contract: ${rule.targetField}`);
    const items = rule.mode === "traceability" ? evidence : evidence.filter(item => item.researchField === rule.researchField);
    const verified = items.filter(item => item.verificationLevel === "primary_source");
    const availability = verified.length ? "available" : items.length ? "unverified" : "unavailable";
    let mappingStatus = "unsupported", candidateValue = null;
    let transformation = "None. No compatible value is emitted.";
    if (verified.length && rule.targetField) {
      if (rule.mode === "traceability") {
        mappingStatus = "partial";
        transformation = "Retain research source/locator/hash only. Do not translate primary_source into an operator verification level or source domain.";
      } else if (rule.mode === "integrity") {
        transformation = "None. Legal/reporting disclosures are retained as research facts, never converted into confirmed integrityEvents.";
      } else {
        // Restrict candidates to the latest observed period; contradictory exact
        // values remain ambiguous instead of selecting an arbitrary document.
        const latestDate = verified.map(item => item.observedAt).sort().at(-1);
        const latest = verified.filter(item => item.observedAt === latestDate);
        const exact = latest.filter(item => exactCandidate(item, rule));
        const values = [...new Set(exact.map(item => item.normalizedValue))];
        const periods = new Set(exact.map(item => `${item.periodStart}/${item.periodEnd}`));
        if (values.length === 1 && periods.size === 1 && exact.length === latest.length) {
          mappingStatus = "full";
          candidateValue = values[0];
          transformation = `Use explicitly normalized ${rule.unit}; exact ${rule.metric}, AI inference API scope, ${windowDays.join('–')} day date-difference window; validate against current contract. No assessment invocation.`;
        } else if (values.length > 1 || exact.length || latest.some(item => item.metric === rule.metric)) {
          mappingStatus = "ambiguous";
          transformation = "None. Conflicting values or mixed scope/metric at the latest observation require reconciliation.";
        } else if (rule.mode === "history") {
          mappingStatus = "ambiguous";
        } else if (latest.every(item => rule.contextMetrics.includes(item.metric) && item.unit === rule.unit && typeof item.normalizedValue === "number")) {
          mappingStatus = "partial";
          transformation = "Context only. Retain period/scope/metric; no prorating, proxy substitution, Top-one/Top-three to Top-five conversion or input emission.";
        }
      }
    }
    const mapping = { researchField: rule.researchField, researchCategory: rule.label, group: rule.group,
      flowcreditField: rule.targetField, flowcreditComponent: rule.component, mappingStatus, availability,
      evidenceIds: items.map(item => item.id).sort(), transformation, notes: rule.notes, candidateValue };
    mapping.id = stableId("MAP", { researchField: rule.researchField, group: rule.group, target: rule.targetField });
    return assertSchema("mapping", mapping);
  });
}
