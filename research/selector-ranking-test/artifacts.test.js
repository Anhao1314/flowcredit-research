import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {rankingMetrics,selectorDecision} from '../selector-ranking/metrics.js';
const read=n=>JSON.parse(readFileSync(new URL('../eval/selector-ranking/'+n+'.json',import.meta.url),'utf8'));
test('locked artifacts recompute primary scores without broad selection or target-driven fallback',()=>{
 const r=read('results'),gate=read('phase-gate');
 assert.equal(r.rows.length,16);assert.equal(new Set(r.rows.map(x=>x.caseId)).size,16);
 assert.deepEqual(r.metrics.ranked,rankingMetrics(r.rows));
 assert.deepEqual(r.retrievalBaseline,rankingMetrics(r.rows.map(x=>({...x,selectedSpanIds:x.retrievedSpanIds})),{ks:[1,2,3,5,8]}));
 assert.equal(r.binding.gateHash,digest(gate));
 assert.equal(gate.developmentHash,digest(read('development')));
 assert.equal(r.injection.passed,true);
 assert.equal(r.decision,selectorDecision({baseline:r.retrievalBaseline,ranked:r.metrics.ranked,safety:r.safety,gate}));
 for(const row of r.rows){
  assert.ok(row.selectedSpanIds.length<=3);assert.equal(new Set(row.rankedHandles).size,row.rankedHandles.length);
  assert.ok(row.selectedSpanIds.every(id=>row.retrievedSpanIds.includes(id)));
  assert.ok(row.attempts.length<=row.selectedSpanIds.length);
  assert.deepEqual(row.attempts.map(a=>a.spanId),row.selectedSpanIds.slice(0,row.attempts.length));
  if(row.candidateFoundAtRank!==null){assert.equal(row.attempts.length,row.candidateFoundAtRank);assert.equal(row.attempts.at(-1).status,'converted');}
  if(row.targetConverted){assert.equal(row.targetScore.chainCorrect,true);assert.ok(row.expectedSpanIds.includes(row.attempts.at(-1).spanId));}
 }
 assert.equal(r.rows.find(x=>x.caseId==='GOLD-11').failure,'RETRIEVAL_MISS');
 assert.equal(r.paidInferenceApiCostUsd,0);assert.equal(r.paidEmbeddingApiCostUsd,0);assert.equal(r.claimsProtection.unchanged,true);
});
