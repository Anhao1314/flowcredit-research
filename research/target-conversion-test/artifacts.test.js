import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {decide} from '../target-conversion/eval.js';
import {assertIntent} from '../target-conversion/contract.js';
import {frozenHashes,conversionHashes} from '../target-conversion/cli.js';
const read=n=>JSON.parse(readFileSync(new URL('../eval/target-conversion/'+n+'.json',import.meta.url),'utf8'));
test('one locked run preserves frozen selector/history and recomputes strict intent success',()=>{
 const r=read('results'),g=read('phase-gate'),old=JSON.parse(readFileSync(new URL('../eval/selector-ranking/results.json',import.meta.url),'utf8'));
 assert.equal(digest(frozenHashes()),digest(g.frozenHashes));assert.equal(digest(conversionHashes()),digest(g.codeHashes));assert.equal(g.historyHash,digest(old));assert.equal(r.binding.gateHash,digest(g));
 assert.equal(r.rows.length,16);assert.equal(new Set(r.rows.map(x=>x.caseId)).size,16);assert.equal(r.rows.filter(x=>x.targetInTop3).length,14);
 assert.equal(r.metrics.strictTargetConversion,r.rows.filter(x=>x.targetCorrect).length);assert.equal(r.metrics.strictTargetConversionRate,r.metrics.strictTargetConversion/16);assert.equal(r.metrics.strictGivenTop3.denominator,14);
 assert.equal(r.metrics.validButWrongTargetCandidates,r.rows.filter(x=>x.genericCandidate&&!x.targetCorrect).length);
 assert.equal(r.decision,decide({metrics:r.metrics,safety:r.safety,gate:g}).decision);
 for(const row of r.rows){
  const historical=old.rows.find(x=>x.caseId===row.caseId);assert.deepEqual(row.rankedHandles,historical.rankedHandles);assert.deepEqual(row.selectedSpanIds,historical.selectedSpanIds);assertIntent(row.intent);
  assert.ok(row.attempts.length<=3);assert.deepEqual(row.attempts.map(x=>x.spanId),row.selectedSpanIds.slice(0,row.attempts.length));
  for(const a of row.attempts.filter(x=>x.status==='converted')){assert.equal(a.targetMatch,'supported');assert.equal(a.targetVerdict.valid,true);assert.equal(a.sidecar.intentId,row.intent.intentId);assert.equal(a.sidecar.intentHash,digest(row.intent));assert.equal(a.sidecar.sourceSupportId,a.spanId);assert.equal(a.sidecar.rankUsed,a.rank);}
  if(row.targetCorrect){assert.equal(row.targetScore.chainCorrect,true);assert.ok(historical.expectedSpanIds.includes(row.attempts.at(-1).spanId));}
 }
 assert.equal(r.claimsProtection.after.claims,4);assert.equal(r.claimsProtection.after.revisions,4);assert.equal(r.claimsProtection.unchanged,true);assert.equal(r.claimsProtection.after.payloadHash,old.claimsProtection.after.payloadHash);
 assert.equal(r.resource.retrievalCalls,0);assert.equal(r.resource.embeddingCalls,0);assert.equal(r.resource.rankingCalls,0);assert.equal(r.resource.realSmokeCases,0);assert.equal(r.paidInferenceApiCostUsd,0);assert.equal(r.paidEmbeddingApiCostUsd,0);
});
