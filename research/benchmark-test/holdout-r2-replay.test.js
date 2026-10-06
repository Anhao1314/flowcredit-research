import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBenchmark} from '../benchmark/schema.js';
import {scoreBenchmark,evaluateGate} from '../benchmark/evaluate.js';

const holdout=loadBenchmark(new URL('../benchmark/data/real-sec-blind-holdout-v0.2b.json',import.meta.url));
const original=JSON.parse(readFileSync(new URL('../benchmark/results/real-sec-blind-holdout-v0.2b.json',import.meta.url),'utf8'));
const archivedR1=JSON.parse(readFileSync(new URL('../benchmark/results/causal-reflection-r1-replay-v0.2b.json',import.meta.url),'utf8'));
const gate=JSON.parse(readFileSync(new URL('../benchmark/phase-gate-v0.2a.json',import.meta.url),'utf8'));
const archivedR2=JSON.parse(readFileSync(new URL('../benchmark/results/causal-role-r2-replay-v0.2b.json',import.meta.url),'utf8'));

test('R2 replays the locked holdout without altering first-blind or R1 history',()=>{
 assert.equal(original.metrics.overallAccuracy,0.7083);
 assert.equal(original.counts.correct,17);
 assert.equal(archivedR1.metrics.overallAccuracy,0.75);
 assert.equal(archivedR1.counts.correct,18);

 const originalFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=()=>{calls+=1;throw new Error('R2_HOLDOUT_NETWORK_FORBIDDEN');};
 let result;
 try{result=scoreBenchmark(holdout,{runtime:'candidate-r2'});}
 finally{globalThis.fetch=originalFetch;}
 assert.equal(calls,0);

 const phase=evaluateGate(result,gate);
 console.log('CAUSAL_R2_HOLDOUT_RESULT '+JSON.stringify({
  metrics:result.metrics,
  counts:result.counts,
  byLabel:result.byLabel,
  byChallenge:result.byChallenge
 }));
 console.log('CAUSAL_R2_HOLDOUT_FAILURES '+JSON.stringify(result.rows.filter(row=>!row.correct).map(row=>({
  caseId:row.caseId,challenge:row.challenge,expected:row.expected,predicted:row.predicted,reasonCodes:row.reasonCodes
 }))));
 console.log('CAUSAL_R2_HOLDOUT_GATE '+JSON.stringify(phase));
 assert.equal(result.evaluatedCases,24);
 assert.deepEqual(result.metrics,archivedR2.metrics);
 assert.deepEqual(result.counts,archivedR2.counts);
 assert.equal(phase.status,archivedR2.phaseGate.status);
 assert.deepEqual(
  result.rows.filter(row=>!row.correct).map(row=>row.caseId),
  archivedR2.remainingFailures
 );
});
