import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertSchema, readJson, contract } from "../src/schema.js";
import { digest, stableId } from "../src/identity.js";
import { normalizeSource, normalizeSources } from "../src/normalize-source.js";
import { extractEvidence, validateEvidence, evidencePayload } from "../src/extract-evidence.js";
import { buildClaims, validateClaims } from "../src/build-claims.js";
import { mapFlowCredit, mappingRules } from "../src/map-flowcredit.js";
import { calculateCoverage, runAudit, renderMatrix } from "../src/coverage.js";

const result = runAudit("coreweave");
const fixture = readJson(new URL("../fixtures/coreweave/observations.json", import.meta.url));
const rawSources = readJson(new URL("../fixtures/coreweave/sources.json", import.meta.url));
function modifiedEvidence(changes) {
  const item = { ...structuredClone(result.evidence.find(e => e.researchField === 'revenue')), ...changes };
  item.contentHash = digest(evidencePayload(item));
  item.id = stableId('EVID', evidencePayload(item));
  return item;
}
function mappedRevenue(changes) { return mapFlowCredit([modifiedEvidence(changes)]).find(item => item.researchField === 'revenue'); }

for (const [name, valid] of Object.entries({source: result.sources[0], evidence: result.evidence[0], claim: result.claims[0], mapping: result.mappings[0]})) {
  test(`${name} schema accepts valid and rejects missing/extra fields`, () => {
    assert.equal(assertSchema(name, valid), valid);
    const missing = structuredClone(valid); delete missing.subjectId;
    if (name === 'mapping') delete missing.mappingStatus;
    assert.throws(() => assertSchema(name, missing), /schema/);
    assert.throws(() => assertSchema(name, { ...valid, unexpected: true }), /schema/);
  });
}
test('source supports all seven publication types and rejects malformed dates/hash', () => {
  for (const sourceType of ['sec_10k','sec_10q','sec_8k','earnings_release','investor_presentation','earnings_call_transcript','official_announcement']) {
    assertSchema('source', { ...result.sources[0], sourceType });
  }
  assert.throws(() => assertSchema('source', { ...result.sources[0], documentDate: '2026-02-30' }), /schema/);
  assert.throws(() => assertSchema('source', { ...result.sources[0], sourceType: 'news' }), /schema/);
  assert.throws(() => assertSchema('source', { ...result.sources.find(s => s.contentHash), contentHash: null }), /schema/);
  const unavailable = result.sources.find(s => !s.contentHash);
  assertSchema('source', unavailable);
  assert.throws(() => assertSchema('source', { ...unavailable, contentHash: 'sha256:'+'a'.repeat(64) }), /schema/);
});
test('source identity is stable across URL/retrieval changes and keyed by document not URL', () => {
  const source = rawSources[0];
  assert.equal(normalizeSource(source).id, normalizeSource({ ...source, url: 'https://example.org/alternate', retrievedAt: '2026-09-14T00:00:00Z' }).id);
  assert.notEqual(normalizeSource(source).id, normalizeSource({ ...source, metadata: { ...source.metadata, documentKey: 'different-accession' } }).id);
  assert.throws(() => normalizeSources([source, source]), /Duplicate/);
});
test('evidence requires source, locator, subject consistency and matching provenance', () => {
  validateEvidence(result.sources, result.evidence);
  assert.throws(() => validateEvidence([], result.evidence), /Orphan/);
  assert.throws(() => validateEvidence(result.sources, [modifiedEvidence({ subjectId: 'other' })]), /Cross-subject/);
  assert.throws(() => validateEvidence(result.sources, [modifiedEvidence({ location: '' })]), /schema/);
  assert.throws(() => validateEvidence(result.sources, [modifiedEvidence({ provenance: { ...result.evidence.find(e=>e.researchField==='revenue').provenance, publisher: 'Other' } })]), /provenance/);
});
test('content hashes detect evidence mutation and secondary sources never become primary', () => {
  assert.throws(() => validateEvidence(result.sources, [{ ...result.evidence[0], statement: 'Tampered' }]), /hash/);
  const id = result.evidence[0].sourceId;
  const secondary = result.sources.map(s=> s.id === id ? { ...s, isPrimarySource: false } : s);
  assert.throws(() => validateEvidence(secondary, [result.evidence[0]]), /Secondary/);
});
test('explicit USD scaling preserves raw facts; identity cannot silently change units', () => {
  const item = result.evidence.find(e => e.metric === 'remaining_performance_obligations');
  assert.equal(item.rawValue, 103.7); assert.equal(item.normalizedValue, 103700000000);
  const input = fixture.observations[0];
  assert.throws(() => extractEvidence(result.sources, [{ ...input, normalization:'identity' }], fixture.asOf), /Identity/);
  assert.throws(() => extractEvidence(result.sources, [{ ...input, sourceKey:'missing' }], fixture.asOf), /Unknown source/);
  assert.throws(() => extractEvidence(result.sources, [{ ...input, rawValue:'not numeric' }], fixture.asOf), /unit conversion/);
});
test('supported claims require actual, same-subject, primary evidence', () => {
  assert.throws(() => assertSchema('claim', { ...result.claims[0], supportingEvidenceIds: [] }), /schema/);
  assert.throws(() => validateClaims(result.evidence, [{ ...result.claims[0], supportingEvidenceIds: ['EVID-missing'] }]), /Orphan/);
  assert.throws(() => validateClaims(result.evidence, [{ ...result.claims[0], subjectId: 'other' }]), /Cross-subject/);
  const claim = result.claims[0], ref = claim.supportingEvidenceIds[0];
  assert.throws(() => validateClaims(result.evidence.map(e=>e.id===ref?{...e,verificationLevel:'unverified'}:e), [claim]), /verified/);
});
test('all claim statuses are representable; deterministic builder handles unverified/stale/disputed', () => {
  for (const status of ['supported','partially_supported','disputed','unverified','stale']) assertSchema('claim', {...result.claims[0], status});
  const spec = readJson(new URL('../fixtures/coreweave/claims.json', import.meta.url))[0];
  assert.equal(buildClaims('coreweave', [], [spec], fixture.asOf)[0].status, 'unverified');
  assert.equal(buildClaims('coreweave', result.evidence, [spec], '2028-01-01T00:00:00Z')[0].status, 'stale');
  const top = result.evidence.find(e=>e.metric==='top1_revenue_share' && e.observedAt==='2026-06-30');
  const counter = modifiedEvidence({...top, rawValue: 10, normalizedValue:10});
  assert.equal(buildClaims('coreweave', [top,counter], [spec], fixture.asOf)[0].status, 'disputed');
  assert.throws(()=>buildClaims('coreweave',result.evidence,[spec],'2020-01-01T00:00:00Z'),/after as-of/);
});
test('exact monthly inference revenue maps FULL after current contract validation', () => {
  const mapping = mappedRevenue({ scope:'ai_inference_api', metric:'inference_revenue', periodStart:'2026-08-01',periodEnd:'2026-08-31', observedAt:'2026-08-31', normalizedValue:100000, unit:'USD' });
  assert.equal(mapping.mappingStatus,'full'); assert.equal(mapping.flowcreditField,'revenueUsd'); assert.equal(mapping.candidateValue,100000);
});
test('quarterly consolidated revenue is PARTIAL with no prorating or candidate emission', () => {
  const row = result.mappings.find(m=>m.researchField==='revenue');
  assert.equal(row.mappingStatus,'partial'); assert.equal(row.candidateValue,null);
  assert.match(row.transformation,/no prorating/);
});
test('window/rate/scope/metric mismatch cannot emit a FULL mapping', () => {
  const exact = { scope:'ai_inference_api', metric:'inference_revenue', periodStart:'2026-08-01',periodEnd:'2026-08-31', observedAt:'2026-08-31', normalizedValue:100000,unit:'USD' };
  for (const change of [{periodEnd:'2026-09-30'},{normalizedValue:-1},{unit:'EUR'},{scope:'consolidated_company'}]) assert.notEqual(mappedRevenue({...exact,...change}).mappingStatus,'full');
  assert.equal(mappedRevenue({...exact,metric:'unrelated_metric'}).mappingStatus,'unsupported');
});
test('conflicting exact input facts become AMBIGUOUS, not an arbitrary source choice', () => {
  const base = { scope:'ai_inference_api', metric:'inference_revenue', periodStart:'2026-08-01',periodEnd:'2026-08-31',observedAt:'2026-08-31',unit:'USD' };
  const row = mapFlowCredit([modifiedEvidence({...base,normalizedValue:100}),modifiedEvidence({...base,normalizedValue:200})]).find(m=>m.researchField==='revenue');
  assert.equal(row.mappingStatus,'ambiguous'); assert.equal(row.candidateValue,null);
});
test('debt/cash flow/backlog do not map to counterparty exposure or risk scores', () => {
  for (const field of ['debt','cash_flow','backlog_rpo','liquidity','guidance','valuation','industry_context']) {
    const row=result.mappings.find(m=>m.researchField===field); assert.equal(row.mappingStatus,'unsupported'); assert.equal(row.candidateValue,null);
  }
  assert.equal(result.mappings.some(m=>m.flowcreditField==='currentExposure'),false);
});
test('Top-one/Top-three, founding date and legal/control events keep semantic restrictions', () => {
  assert.equal(result.mappings.find(m=>m.researchField==='customer_concentration').mappingStatus,'partial');
  assert.equal(result.mappings.find(m=>m.researchField==='operating_history').mappingStatus,'ambiguous');
  assert.equal(result.mappings.find(m=>m.researchField==='integrity_legal_reporting').mappingStatus,'unsupported');
  assert.equal(result.mappings.find(m=>m.researchField==='provenance').mappingStatus,'partial');
});
test('mapping targets are present in actual contract; stale target/rules fail explicitly', () => {
  for (const rule of mappingRules.filter(r=>r.targetField)) assert.ok(Object.hasOwn(contract.$defs.draft.properties,rule.targetField));
  assert.throws(()=>mapFlowCredit([], [{...mappingRules[0],targetField:'overdue30d'}]),/absent/);
  assert.throws(()=>mapFlowCredit([], [mappingRules[0],mappingRules[0]]),/Duplicate/);
});
test('coverage formula is deterministic, distinguishes ambiguous, excludes operator rows', () => {
  const rows=['full','partial','unsupported','ambiguous'].map((mappingStatus,i)=>({researchField:String(i),group:'public',mappingStatus}));
  const c=calculateCoverage([...rows,{researchField:'operator',group:'operator',mappingStatus:'full'}]);
  assert.deepEqual(c.counts,{full:1,partial:1,unsupported:1,ambiguous:1});
  assert.equal(c.strictCoveragePct,25);assert.equal(c.weightedCompatibilityPct,37.5);
  assert.equal(calculateCoverage([]).weightedCompatibilityPct,0);
  assert.throws(()=>calculateCoverage([rows[0],rows[0]]),/Duplicate/);
  assert.throws(()=>calculateCoverage([{...rows[0],mappingStatus:'approved'}]),/Unknown/);
});
test('CoreWeave result is stable, real-source backed and not a risk result', () => {
  assert.deepEqual(runAudit('coreweave'),result);
  assert.equal(result.sources.length,3);assert.equal(result.evidence.length,32);assert.equal(result.claims.length,4);
  assert.equal(result.coverage.dimensions,21);
  assert.deepEqual(result.coverage.counts,{full:0,partial:4,unsupported:16,ambiguous:1});
  assert.equal(result.coverage.weightedCompatibilityPct,9.52);
  for(const forbidden of ['TAI','CCI','grade','riskGrade','recommendedLimit','investmentScore']) assert.equal(Object.hasOwn(result,forbidden),false);
  assert.match(renderMatrix(result),/overdue30Pct/);assert.equal(renderMatrix(result).includes('overdue30d'),false);
});
test('CLI runs from another directory, produces JSON and rejects unknown subject/flags', () => {
  const cli=fileURLToPath(new URL('../src/coverage.js',import.meta.url));
  const good=spawnSync(process.execPath,[cli,'coreweave','--json'],{cwd:'/tmp',encoding:'utf8'});
  assert.equal(good.status,0,good.stderr);assert.deepEqual(JSON.parse(good.stdout).coverage,result.coverage);
  const bad=spawnSync(process.execPath,[cli,'unknown'],{encoding:'utf8'});assert.equal(bad.status,1);assert.match(bad.stderr,/Unknown/);
  const flag=spawnSync(process.execPath,[cli,'coreweave','--score'],{encoding:'utf8'});assert.equal(flag.status,1);
});
test('normalization corruption fails even if an evidence checksum is recomputed', () => {
  const original=result.evidence.find(e=>e.normalization==='usd_millions_to_usd');
  const changed=modifiedEvidence({...original,normalizedValue:original.normalizedValue+1});
  assert.throws(()=>validateEvidence(result.sources,[changed]),/normalization mismatch/);
});
test('mapping schema forbids full null candidates and partial input emission', () => {
  const partial=result.mappings.find(m=>m.mappingStatus==='partial');
  assert.throws(()=>assertSchema('mapping',{...partial,candidateValue:100}),/schema/);
  assert.throws(()=>assertSchema('mapping',{...partial,mappingStatus:'full',candidateValue:null}),/schema/);
});
test('committed report matrix matches the runtime-generated current contract audit', () => {
  const report=readFileSync(new URL('../../docs/research-evidence-bridge-v0.1.md',import.meta.url),'utf8');
  assert.ok(report.includes(renderMatrix(result)));
});
test('equal values from different windows or future unobserved windows cannot be FULL', () => {
  const base={scope:'ai_inference_api',metric:'inference_revenue',unit:'USD',normalizedValue:100,observedAt:'2026-08-31'};
  const a=modifiedEvidence({...base,periodStart:'2026-08-01',periodEnd:'2026-08-31'});
  const b=modifiedEvidence({...base,periodStart:'2026-07-01',periodEnd:'2026-07-31'});
  assert.equal(mapFlowCredit([a,b]).find(m=>m.researchField==='revenue').mappingStatus,'ambiguous');
  assert.notEqual(mappedRevenue({...base,periodStart:'2026-09-01',periodEnd:'2026-09-30'}).mappingStatus,'full');
});
