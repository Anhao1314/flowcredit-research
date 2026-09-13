import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readJson, contract } from "./schema.js";
import { digest } from "./identity.js";
import { normalizeSources } from "./normalize-source.js";
import { extractEvidence } from "./extract-evidence.js";
import { buildClaims } from "./build-claims.js";
import { mapFlowCredit } from "./map-flowcredit.js";

export function calculateCoverage(mappings) {
  for (const item of mappings) {
    if (!["public", "operator"].includes(item.group)) throw new Error("Unknown coverage group");
    if (!["full", "partial", "unsupported", "ambiguous"].includes(item.mappingStatus)) throw new Error("Unknown coverage status");
  }
  const publicRows = mappings.filter(item => item.group === "public");
  const names = new Set();
  const counts = { full: 0, partial: 0, unsupported: 0, ambiguous: 0 };
  for (const item of publicRows) {
    if (names.has(item.researchField)) throw new Error("Duplicate coverage dimension");
    names.add(item.researchField);
    if (!Object.hasOwn(counts, item.mappingStatus)) throw new Error("Unknown coverage status");
    counts[item.mappingStatus]++;
  }
  const dimensions = publicRows.length;
  const percent = value => dimensions ? Number((value / dimensions * 100).toFixed(2)) : 0;
  return { dimensions, counts, strictCoveragePct: percent(counts.full), weightedCompatibilityPct: percent(counts.full + 0.5 * counts.partial),
    algorithm: "v0.1: one vote per public taxonomy dimension; full=1, partial=0.5, ambiguous=0, unsupported=0; operator rows excluded. Strict coverage=full/N. Empty denominator=0. Neither percentage is a risk score or readiness." };
}
export function runAudit(subject) {
  if (subject !== "coreweave") throw new Error(`Unknown reviewed fixture subject: ${subject}`);
  const folder = new URL(`../fixtures/${subject}/`, import.meta.url);
  const fixture = readJson(new URL("observations.json", folder));
  const sources = normalizeSources(readJson(new URL("sources.json", folder)));
  if (sources.some(item => item.subjectId !== fixture.subjectId)) throw new Error("Fixture source subject mismatch");
  const evidence = extractEvidence(sources, fixture.observations, fixture.asOf);
  const claims = buildClaims(fixture.subjectId, evidence, readJson(new URL("claims.json", folder)), fixture.asOf);
  const mappings = mapFlowCredit(evidence);
  return { bridgeVersion: "flowcredit.research/v0.1", subjectId: fixture.subjectId, label: "CoreWeave", asOf: fixture.asOf,
    contractHash: digest(contract), sources, evidence, claims, mappings, coverage: calculateCoverage(mappings),
    limitations: ["Reviewed observations from three primary publications, not an exhaustive financial dataset or automatic document parser.",
      "Primary publication is not independent truth verification; document hashes are integrity checks only.",
      "Categories may share evidence; this taxonomy describes compatibility breadth, not independent risk factors.",
      "No FlowCredit risk computation or API invocation is performed. Coverage is not TAI, CCI, grade, credit or investment score."] };
}
export function renderMatrix(result) {
  const rows = result.mappings.map(item => `| ${item.researchCategory} | ${item.flowcreditField || '—'} | ${item.mappingStatus.toUpperCase()} | ${item.availability} | ${item.evidenceIds.length} | ${item.notes} |`);
  return ['| Research field | Current FC target | Status | Corpus availability | Evidence | Restriction |','|---|---|---|---|---:|---|', ...rows].join('\n');
}
export function renderAudit(result) {
  const c = result.coverage;
  return [`FlowCredit Research Compatibility Audit — ${result.label}`, `As of: ${result.asOf}`, `Sources: ${result.sources.length}; Evidence: ${result.evidence.length}; Claims: ${result.claims.length}`,
    `Public research dimensions: ${c.dimensions}`, `Full: ${c.counts.full}; Partial: ${c.counts.partial}; Unsupported: ${c.counts.unsupported}; Ambiguous: ${c.counts.ambiguous}`,
    `Strict coverage: ${c.strictCoveragePct}%; Weighted compatibility: ${c.weightedCompatibilityPct}%`, c.algorithm, '', renderMatrix(result), '',
    'Major gaps: ' + result.mappings.filter(item => item.group === 'public' && ['unsupported','ambiguous'].includes(item.mappingStatus)).map(item => item.researchCategory).join(', '),
    ...result.limitations].join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [subject = "coreweave", format] = process.argv.slice(2);
    if (process.argv.length > 4 || (format && format !== "--json")) throw new Error("Usage: node research/src/coverage.js coreweave [--json]");
    const result = runAudit(subject);
    console.log(format === "--json" ? JSON.stringify(result, null, 2) : renderAudit(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
