import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBenchmark} from '../benchmark/schema.js';
import {scoreBenchmark,evaluateGate} from '../benchmark/evaluate.js';
import {importClosure} from '../claim-revision/conformance.js';

const benchmark=loadBenchmark(new URL('../benchmark/data/real-sec-pilot-v0.1.json',import.meta.url));
const gate=JSON.parse(readFileSync(new URL('../benchmark/phase-gate-v0.2a.json',import.meta.url),'utf8'));

test('real SEC pilot has 32 unique cases across three independently addressable filings',()=>{
 assert.equal(benchmark.cases.length,32);
 assert.equal(benchmark.sources.length,3);
 assert.equal(new Set(benchmark.cases.map(item=>item.caseId)).size,32);
 assert.deepEqual([...new Set(benchmark.sources.map(item=>item.form))],['10-K']);
 assert.ok(benchmark.sources.every(item=>item.url.startsWith('https://www.sec.gov/')));
});

test('pilot is explicitly not publication gold and every case preserves review basis and locator',()=>{
 assert.equal(benchmark.status,'PILOT_SINGLE_REVIEW_NOT_PUBLICATION_GOLD');
 for(const item of benchmark.cases){
  assert.equal(item.annotation.tier,'pilot-single-review');
  assert.ok(item.annotation.basis.length>10);
  assert.ok(item.annotation.locator.length>3);
 }
});

test('benchmark evaluator is deterministic and reports safety metrics separately from aggregate accuracy',()=>{
 const first=scoreBenchmark(benchmark);
 const second=scoreBenchmark(benchmark);
 assert.deepEqual(second,first);
 assert.equal(first.evaluatedCases,32);
 for(const key of ['overallAccuracy','directionalAccuracy','directionalInversionRate','unsafeDirectionalErrorRate','ambiguousAbstentionRecall']){
  assert.equal(typeof first.metrics[key],'number');
 }
 console.log('REALITY_BENCHMARK_RESULT '+JSON.stringify({metrics:first.metrics,counts:first.counts,byLabel:first.byLabel}));
});

test('v0.2A phase gate is allowed to fail; its failure cannot be hidden by aggregate accuracy',()=>{
 const result=scoreBenchmark(benchmark);
 const phase=evaluateGate(result,gate);
 assert.ok(['PASS','FAIL'].includes(phase.status));
 if(phase.status==='FAIL')assert.ok(Object.values(phase.checks).some(value=>value===false));
 console.log('REALITY_BENCHMARK_GATE '+JSON.stringify(phase));
});

test('runtime import closure cannot reach benchmark cases, gold labels or phase gate',()=>{
 const closure=importClosure([
  'research/claim-relation/contract.js',
  'research/claim-relation/legacy-read.js',
  'research/claim-relation/compatibility.js',
  'research/claim-relation/gate.js',
  'research/relation-runtime/deterministic.js',
  'research/relation-runtime/receipt.js',
  'research/relation-runtime/runtime.js'
 ]);
 for(const file of closure.files){
  assert.ok(!file.includes('/benchmark/'),file);
  const source=readFileSync(new URL('../../'+file,import.meta.url),'utf8');
  assert.ok(!/REAL-AAPL|REAL-MSFT|REAL-NVDA|REAL-HARD|real-sec-pilot|phase-gate-v0\.2a/.test(source),file);
 }
});

test('renaming benchmark case ids cannot change runtime predictions',()=>{
 const baseline=scoreBenchmark(benchmark).rows.map(row=>row.predicted);
 const renamed=structuredClone(benchmark);
 renamed.cases.forEach((item,index)=>{item.caseId='RENAMED-'+String(index).padStart(3,'0');});
 const replay=scoreBenchmark(renamed).rows.map(row=>row.predicted);
 assert.deepEqual(replay,baseline);
});
