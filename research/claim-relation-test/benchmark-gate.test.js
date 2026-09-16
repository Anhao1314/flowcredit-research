import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compatibilityAssessment} from '../claim-relation/compatibility.js';
import {relationGate} from '../claim-relation/gate.js';
import {relationLabels} from '../claim-relation/contract.js';
import {importClosure} from '../claim-revision/conformance.js';
import {buildGateFixture,publishedFixture} from './regression-fixture.js';

const asOf='2026-03-01T12:00:00.000Z';
const {document:fixture}=publishedFixture('gate-regression-41.json');
// Pinned from the frozen 2.6B-3 derivation over the 41 Relation spike pairs: the
// refusals are the four kind-rule cases plus the eight kind-rule-adjacent
// readability cases. Relation is not executed here (session 2.7B section 16), so no
// Relation accuracy is claimed or measured.
const refusedIds=['DEV-019','DEV-020','DEV-024','DEV-026','DEV-027','DEV-029','DEV-030','DEV-031','DEV-033','DEV-034','DEV-035','DEV-036'];

function gateOf(item,index){
 const relationInput={evidence:{evidenceId:`EVIDENCE-${index}`},claim:{claimId:`CLAIM-${index}`,revisionId:`CLAIM-${index}:v1`},asOf,evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},claimSide:{semantics:{state:'NOT_MATERIALIZED'}}};
 const material={evidenceId:`EVIDENCE-${index}`,claimId:`CLAIM-${index}`,revisionId:`CLAIM-${index}:v1`,asOf,claim:{statement:item.claim},evidence:{statement:item.evidence}};
 return relationGate({relationInput,assessment:compatibilityAssessment(relationInput,material)});
}

test('the 41 frozen Relation pairs split into exactly 29 permitted and 12 refused',()=>{
 // The published document is re-derived from public sources alone: the pairs from the tracked
 // dev-set, the frozen dispositions from the contract's 41.5 table (session 2.7B section 5).
 assert.deepEqual(fixture,buildGateFixture(),'the published gate fixture drifted from the contract table and the tracked dev-set');
 assert.deepEqual(fixture.expected,{pairs:41,permitted:29,refused:12});
 const permitted=[],refused=[];
 for(const [index,item] of fixture.cases.entries()){
  const gate=gateOf(item,index);
  if(gate.mayExecute)permitted.push(item.caseId);else refused.push(item.caseId);
 }
 assert.deepEqual(refused,refusedIds);
 assert.deepEqual(permitted,fixture.cases.map(item=>item.caseId).filter(id=>!refusedIds.includes(id)));
 assert.equal(permitted.length,29);
 assert.equal(refused.length,12);
});

test('every refused pair is NOT_EVALUATED with relation null and no Relation label',()=>{
 for(const [index,item] of fixture.cases.entries()){
  const gate=gateOf(item,index);
  const expected=!refusedIds.includes(item.caseId);
  assert.equal(gate.mayExecute,expected,item.caseId);
  if(expected){
   assert.equal(gate.processingStatus,null);
   assert.equal(gate.relation,null);
   assert.equal(gate.refusal,null);
   continue;
  }
  assert.equal(gate.processingStatus,'NOT_EVALUATED',item.caseId);
  assert.equal(gate.relation,null,item.caseId);
  assert.equal(gate.refusal.stage,'COMPATIBILITY',item.caseId);
  assert.ok(['NOT_COMMENSURABLE','INDETERMINATE'].includes(gate.refusal.disposition),item.caseId);
  for(const label of relationLabels)assert.ok(!JSON.stringify(gate).includes(label),`${item.caseId} leaked ${label}`);
 }
});

test('no Relation model, provider or network call is reachable from the 2.7B runtime',()=>{
 // Runtime closure without the regression helper: the runtime may reach no test material, no
 // gold and no case-id table, and none of its sources may name them either (section 6).
 const closure=importClosure(['research/claim-relation/contract.js','research/claim-relation/legacy-read.js','research/claim-relation/compatibility.js','research/claim-relation/resolve.js','research/claim-relation/gate.js']);
 assert.ok(closure.files.length>0);
 for(const file of closure.files){
  assert.ok(!/(?:^|\/)(?:test|[^/]+-test)\//.test(file),`runtime reaches test material ${file}`);
  assert.ok(!/(?:local-model|provider|prompts|openai|deepseek|ollama|anthropic|nvidia|mcp|server)/i.test(file),`unexpected import ${file}`);
  const source=readFileSync(new URL(`../../${file}`,import.meta.url),'utf8');
  assert.ok(!/regression|fixture|docs\/audit|compatibility-regression|gate-regression/i.test(source),`runtime names gold material ${file}`);
 }
 const helper=importClosure(['research/claim-relation-test/regression-fixture.js']);
 for(const file of helper.files)assert.ok(!/(?:local-model|provider|prompts|openai|deepseek|ollama|anthropic|nvidia|mcp|server)/i.test(file),`unexpected import ${file}`);
 const originalFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=()=>{calls++;throw new Error('NETWORK_CALL_FORBIDDEN');};
 try{for(const [index,item] of fixture.cases.entries())gateOf(item,index);}finally{globalThis.fetch=originalFetch;}
 assert.equal(calls,0);
});

test('the gate decides on pair content, not on case identity (session 2.7B section 6)',()=>{
 const baseline=fixture.cases.map((item,index)=>gateOf(item,index).mayExecute);
 // The same content under different Evidence/Claim identities and a renamed case: the split
 // must not move, so no answer can come from a case-id lookup table.
 const renamed=fixture.cases.map((item,index)=>gateOf({...item,caseId:`RENAMED-${index}`},index+1000).mayExecute);
 assert.deepEqual(renamed,baseline);
 assert.deepEqual(baseline,fixture.cases.map(item=>!refusedIds.includes(item.caseId)));
});
