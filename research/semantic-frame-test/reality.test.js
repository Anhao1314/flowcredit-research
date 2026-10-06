import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRealityMatrix,runRealityBenchmark} from '../eval/relation-reality/benchmark.js';

test('SemanticFrame projects all real-source pairs with explicit field origins',()=>{
 const rows=buildRealityMatrix();
 assert.equal(rows.length,128);
 for(const row of rows){
  assert.ok(row.claimFrame.frameId.startsWith('SF-'));
  assert.ok(row.evidenceFrame.frameId.startsWith('SF-'));
  assert.equal(row.claimFrame.fieldOrigins['proposition.metric'].kind,'CLAIM_DEFINITION');
  assert.equal(row.evidenceFrame.fieldOrigins['proposition.metric'].kind,'RECORDED_FIELD');
  assert.ok(row.evidenceFrame.grounding.sourceUrl);
 }
});

test('Reality benchmark uses three primary publications, 32 observations and four Claims',()=>{
 const result=runRealityBenchmark();
 assert.deepEqual({
  sources:result.corpus.sources,
  observations:result.corpus.observations,
  claims:result.corpus.claims,
  pairs:result.corpus.pairs
 },{sources:3,observations:32,claims:4,pairs:128});
 assert.equal(result.semanticRuntime.directionalPairs,5);
});

test('structured semantic runtime satisfies the explicit structured oracle without unsafe direction',()=>{
 const result=runRealityBenchmark();
 assert.equal(result.semanticRuntime.exact,128);
 assert.equal(result.semanticRuntime.exactRate,1);
 assert.equal(result.semanticRuntime.directionalCorrect,5);
 assert.equal(result.semanticRuntime.directionalAccuracy,1);
 assert.equal(result.semanticRuntime.unsafeDirectional,0);
});

test('experiment reports the text baseline separately and prints measured comparison',()=>{
 const result=runRealityBenchmark();
 assert.equal(result.textBaseline.pairs,128);
 assert.equal(result.textBaseline.directionalPairs,5);
 assert.equal(typeof result.textBaseline.exactRate,'number');
 assert.equal(typeof result.textBaseline.directionalAccuracy,'number');
 assert.ok(result.textBaseline.unsafeDirectional>result.semanticRuntime.unsafeDirectional);
 assert.equal(result.semanticRuntime.unsafeDirectional,0);
 process.stdout.write('REALITY_BENCHMARK '+JSON.stringify({
  textBaseline:result.textBaseline,
  semanticRuntime:result.semanticRuntime,
  failures:result.failures.length
 })+'\n');
});
