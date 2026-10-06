import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const auditText=readFileSync(new URL('../benchmark/safety-audit-v0.2c-s1.json',import.meta.url),'utf8');
const resultText=readFileSync(new URL('../benchmark/results/real-sec-fresh-blind-v0.2c-first-run.json',import.meta.url),'utf8');
const datasetText=readFileSync(new URL('../benchmark/data/real-sec-fresh-blind-v0.2c.json',import.meta.url),'utf8');
const runtimeText=readFileSync(new URL('../relation-runtime/candidate-r2-deterministic.js',import.meta.url),'utf8');

const audit=JSON.parse(auditText);
const result=JSON.parse(resultText);

function gitBlobSha(text){
 const body=Buffer.from(text,'utf8');
 return createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex');
}

test('S1 audit pins immutable first-blind result, dataset and evaluated R2 bytes',()=>{
 assert.equal(gitBlobSha(resultText),'0916d30a964d6878d1de8b683c42d37ae9773527');
 assert.equal(gitBlobSha(resultText),audit.sourceResult.gitBlobSha);
 assert.equal(result.status,audit.sourceResult.status);

 assert.equal(gitBlobSha(datasetText),'5602c516d3333f1fde665738fc8385bcd7b8a6d0');
 assert.equal(gitBlobSha(datasetText),audit.sourceDataset.gitBlobSha);
 assert.equal(result.dataset.gitBlobSha,audit.sourceDataset.gitBlobSha);
 assert.equal(result.dataset.cases,audit.sourceDataset.cases);
 assert.equal(result.dataset.issuers,audit.sourceDataset.issuers);

 assert.equal(gitBlobSha(runtimeText),'2b8b612e2f27fbf67722ba26a9f8e06cb6244676');
 assert.equal(gitBlobSha(runtimeText),audit.sourceRuntime.gitBlobSha);
 assert.equal(result.runtime,audit.sourceRuntime.name);
});

test('S1 audit covers every archived v0.2C safety failure exactly once',()=>{
 const expected=new Set([
  ...result.safety.directionalInversions,
  ...result.safety.unsafeDirectionalOnNonDirectionalGold
 ]);
 const audited=audit.cases.map(item=>item.caseId);
 assert.equal(new Set(audited).size,audited.length);
 assert.deepEqual(new Set(audited),expected);
 assert.equal(audited.length,5);
 assert.equal(audit.safetySummary.auditedCases,5);
});

test('every safety case has explicit root cause, severity and affected rule',()=>{
 for(const item of audit.cases){
  assert.ok(item.rootCauseFamily,item.caseId);
  assert.ok(['CRITICAL','HIGH'].includes(item.severity),item.caseId);
  assert.ok(item.affectedRule,item.caseId);
  const family=audit.families.find(candidate=>candidate.id===item.rootCauseFamily);
  assert.ok(family,item.caseId);
  assert.ok(family.cases.includes(item.caseId),item.caseId);
  const failure=result.failures.find(candidate=>candidate.caseId===item.caseId);
  assert.ok(failure,item.caseId);
  assert.deepEqual(item.expected,failure.expected,item.caseId);
  assert.deepEqual(item.predicted,failure.predicted,item.caseId);
  assert.deepEqual(failure.reasonCodes,[item.affectedRule],item.caseId);
 }
});

test('second-order unsafe fallback is the dominant generic defect',()=>{
 const family=audit.families.find(item=>item.id==='SF-SECOND-ORDER-UNSAFE-FALLBACK');
 assert.ok(family);
 assert.equal(family.cases.length,4);
 assert.deepEqual(
  new Set(family.cases),
  new Set(['FRESH-COST-007','FRESH-JPM-004','FRESH-JPM-007','FRESH-CRM-004'])
 );
 for(const caseId of family.cases){
  const item=audit.cases.find(candidate=>candidate.caseId===caseId);
  assert.equal(item.affectedRule,'RT_SECOND_ORDER_SERIES');
  assert.equal(item.repairPriority,1);
 }
});

test('rate-series binding gap is recorded as a trigger, not conflated with the generic safety defect',()=>{
 const withCoverageGap=audit.cases
  .filter(item=>item.contributingDefects.includes('RATE_SERIES_TEMPORAL_BINDING_GAP'))
  .map(item=>item.caseId);
 assert.deepEqual(new Set(withCoverageGap),new Set(['FRESH-JPM-004','FRESH-CRM-004']));
 assert.ok(audit.followUps.some(item=>item.id==='FOLLOWUP-RATE-SERIES-TEMPORAL-BINDING'&&item.status==='DEFERRED'));
 assert.ok(audit.nonGoals.includes('Do not repair rate-series parser coverage during S1.'));
});

test('causal contradiction family isolates the COUNTERS to SUPPORTS inversion',()=>{
 const item=audit.cases.find(candidate=>candidate.caseId==='FRESH-CAT-008');
 assert.equal(item.rootCauseFamily,'SF-CAUSAL-CONTRADICTION-PRECEDENCE');
 assert.equal(item.severity,'CRITICAL');
 assert.equal(item.affectedRule,'RT_EXPLICIT_CAUSAL_ATTRIBUTION');
 assert.equal(item.expected.relation,'COUNTERS');
 assert.equal(item.predicted.relation,'SUPPORTS');
 assert.equal(item.repairPriority,2);
});

test('S1 repair order prioritizes fail-closed second-order safety before causal veto',()=>{
 assert.deepEqual(
  audit.repairPriority.map(item=>item.repairId),
  ['S1-R1-SECOND-ORDER-FAIL-CLOSED','S1-R2-CAUSAL-CONTRADICTION-VETO']
 );
 assert.ok(audit.repairPriority[0].acceptance.some(item=>item.includes('Do not require overall accuracy to improve')));
 assert.ok(audit.nonGoals.some(item=>item.includes('overall accuracy')));
 assert.ok(audit.nonGoals.some(item=>item.includes('replay')&&item.includes('blind')));
});

test('S1 audit test does not import or execute candidate runtime code',()=>{
 const source=readFileSync(new URL('./safety-audit-v0.2c-s1.test.js',import.meta.url),'utf8');
 const imports=source.split('\n').filter(line=>line.trim().startsWith('import ')).join('\n');
 assert.ok(!/candidate-|relation-runtime|benchmark\/evaluate/.test(imports));
});
