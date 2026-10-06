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
 const first=scoreBenchmark(benchmark,{runtime:'candidate'});
 const second=scoreBenchmark(benchmark,{runtime:'candidate'});
 assert.deepEqual(second,first);
 assert.equal(first.evaluatedCases,32);
 for(const key of ['overallAccuracy','directionalAccuracy','directionalInversionRate','unsafeDirectionalErrorRate','ambiguousAbstentionRecall']){
  assert.equal(typeof first.metrics[key],'number');
 }
 const baseline=scoreBenchmark(benchmark,{runtime:'baseline'});
 console.log('REALITY_BENCHMARK_BASELINE '+JSON.stringify({metrics:baseline.metrics,counts:baseline.counts,byLabel:baseline.byLabel}));
 console.log('REALITY_BENCHMARK_CANDIDATE '+JSON.stringify({metrics:first.metrics,counts:first.counts,byLabel:first.byLabel}));
 console.log('REALITY_BENCHMARK_FAILURES '+JSON.stringify(first.rows.filter(row=>!row.correct).map(row=>({caseId:row.caseId,challenge:row.challenge,expected:row.expected,predicted:row.predicted,reasonCodes:row.reasonCodes}))));
});

test('v0.2A phase gate is allowed to fail; its failure cannot be hidden by aggregate accuracy',()=>{
 const result=scoreBenchmark(benchmark,{runtime:'candidate'});
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
 const baseline=scoreBenchmark(benchmark,{runtime:'candidate'}).rows.map(row=>row.predicted);
 const renamed=structuredClone(benchmark);
 renamed.cases.forEach((item,index)=>{item.caseId='RENAMED-'+String(index).padStart(3,'0');});
 const replay=scoreBenchmark(renamed,{runtime:'candidate'}).rows.map(row=>row.predicted);
 assert.deepEqual(replay,baseline);
});


test('candidate safety rules are content-based and cover generic non-benchmark examples',async()=>{
 const {candidateDeterministicRelation}=await import('../relation-runtime/candidate-deterministic.js');
 const temporal=candidateDeterministicRelation({
  claim:{statement:'Subscription growth was faster in 2026 than in 2025.'},
  evidence:{statement:'Subscription growth was 18 percent in 2026 and 12 percent in 2025.'}
 });
 const causalNegative=candidateDeterministicRelation({
  claim:{statement:'Infrastructure investment was the primary driver of revenue growth.'},
  evidence:{statement:'Revenue increased 20 percent and infrastructure investment also increased.'}
 });
 const causalScope=candidateDeterministicRelation({
  claim:{statement:'Premium sales caused total net sales growth.'},
  evidence:{statement:'Device net sales increased because of premium sales, while total net sales also increased.'}
 });
 const mix=candidateDeterministicRelation({
  claim:{statement:'Revenue mix shifted toward Services.'},
  evidence:{statement:'Services net sales grew 14 percent while total net sales grew 6 percent.'}
 });
 assert.deepEqual([temporal.relation,causalNegative.relation,causalScope.relation,mix.relation],['SUPPORTS','NEUTRAL','AMBIGUOUS','SUPPORTS']);
});
