import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const audit=JSON.parse(readFileSync(new URL('../benchmark/safety-audit-v0.2c-s1.json',import.meta.url),'utf8'));
const result=JSON.parse(readFileSync(new URL('../benchmark/results/real-sec-fresh-blind-v0.2c-first-run.json',import.meta.url),'utf8'));

test('S1 audit covers every archived v0.2C safety failure exactly once',()=>{
 const expected=new Set([
  ...result.safety.directionalInversions,
  ...result.safety.unsafeDirectionalOnNonDirectionalGold
 ]);
 const audited=audit.families.flatMap(family=>family.cases);
 assert.equal(new Set(audited).size,audited.length);
 assert.deepEqual(new Set(audited),expected);
 assert.equal(audited.length,5);
});

test('second-order unsafe fallback is the dominant safety family',()=>{
 const family=audit.families.find(item=>item.id==='SF-SECOND-ORDER-UNSAFE-FALLBACK');
 assert.ok(family);
 assert.equal(family.severity,'CRITICAL');
 assert.equal(family.cases.length,4);
 assert.deepEqual(
  new Set(family.cases),
  new Set(['FRESH-COST-007','FRESH-JPM-004','FRESH-JPM-007','FRESH-CRM-004'])
 );
 for(const caseId of family.cases){
  const failure=result.failures.find(item=>item.caseId===caseId);
  assert.ok(failure,caseId);
  assert.deepEqual(failure.reasonCodes,['RT_SECOND_ORDER_SERIES']);
 }
});

test('causal contradiction family isolates the COUNTERS to SUPPORTS inversion',()=>{
 const family=audit.families.find(item=>item.id==='SF-CAUSAL-CONTRADICTION-PRECEDENCE');
 assert.ok(family);
 assert.deepEqual(family.cases,['FRESH-CAT-008']);
 const failure=result.failures.find(item=>item.caseId==='FRESH-CAT-008');
 assert.equal(failure.expected.relation,'COUNTERS');
 assert.equal(failure.predicted.relation,'SUPPORTS');
 assert.deepEqual(failure.reasonCodes,['RT_EXPLICIT_CAUSAL_ATTRIBUTION']);
});

test('S1 repair order prioritizes fail-closed second-order safety before causal expansion',()=>{
 assert.deepEqual(
  audit.repairPriority.map(item=>item.repairId),
  ['S1-R1-SECOND-ORDER-FAIL-CLOSED','S1-R2-CAUSAL-CONTRADICTION-VETO']
 );
 assert.ok(audit.nonGoals.some(item=>item.includes('overall accuracy')));
});

test('S1 audit is analysis-only and does not import candidate runtime code',()=>{
 const source=readFileSync(new URL('./safety-audit-v0.2c-s1.test.js',import.meta.url),'utf8');
 const imports=source.split('\n').filter(line=>line.trim().startsWith('import ')).join('\n');
 assert.ok(!/candidate-|relation-runtime|benchmark\/evaluate/.test(imports));
});
