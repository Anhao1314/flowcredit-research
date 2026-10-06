import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateRelation} from '../relation-runtime/runtime.js';
import {deterministicRelation} from '../relation-runtime/deterministic.js';
import {runWhatChangedBatch} from '../what-changed/index.js';

const asOf='2026-08-15T12:00:00.000Z';
const demo=JSON.parse(readFileSync(new URL('../what-changed/fixtures/northstar-demo.json',import.meta.url),'utf8'));

function pair(claimStatement,evidenceStatement,index=1){
 const relationInput={
  evidence:{evidenceId:'EVID-'+index},
  claim:{claimId:'CLAIM-'+index,revisionId:'CLAIM-'+index+':v1'},
  asOf,
  evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},
  claimSide:{semantics:{state:'NOT_MATERIALIZED'}}
 };
 const material={
  evidenceId:'EVID-'+index,
  claimId:'CLAIM-'+index,
  revisionId:'CLAIM-'+index+':v1',
  asOf,
  claim:{statement:claimStatement},
  evidence:{statement:evidenceStatement}
 };
 return {relationInput,material};
}

test('deterministic runtime resolves numeric support and counter without confidence or impact',()=>{
 const support=evaluateRelation(pair('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.',1));
 const counter=evaluateRelation(pair('December tool revenue was greater than 40 USD.','December tool revenue was 35 USD.',2));
 assert.equal(support.processingStatus,'RESOLVED');
 assert.equal(support.relation,'SUPPORTS');
 assert.equal(counter.processingStatus,'RESOLVED');
 assert.equal(counter.relation,'COUNTERS');
 for(const receipt of [support,counter]){
  const serialized=JSON.stringify(receipt);
  assert.ok(!serialized.includes('"confidence"'));
  assert.ok(!serialized.includes('"impact"'));
  assert.equal(receipt.authority,'ANALYTICAL_ONLY');
 }
});

test('permitted but non-bearing evidence is NEUTRAL rather than an uncertainty bucket',()=>{
 const receipt=evaluateRelation(pair('December tool revenue was greater than 40 USD.','December cash balance was 57 USD.',3));
 assert.equal(receipt.processingStatus,'RESOLVED');
 assert.equal(receipt.relation,'NEUTRAL');
});

test('the frozen acceleration example abstains instead of inventing support',()=>{
 const receipt=evaluateRelation(pair('Revenue growth is accelerating.','Revenue grew 40 percent in 2026.',4));
 assert.equal(receipt.processingStatus,'ABSTAINED');
 assert.equal(receipt.relation,'AMBIGUOUS');
 assert.deepEqual(receipt.reasonCodes,['RT_SECOND_ORDER_CONTEXT_MISSING']);
});

test('compatibility refusal stays NOT_EVALUATED with relation null',()=>{
 const receipt=evaluateRelation(pair('December tool revenue was greater than 40 USD.','The tool revenue reporting team moved to another office.',5));
 assert.equal(receipt.processingStatus,'NOT_EVALUATED');
 assert.equal(receipt.relation,null);
 assert.equal(receipt.route,'compatibility-gate');
});

test('receipt identity is deterministic for the same pair and as-of',()=>{
 const input=pair('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.',6);
 assert.equal(evaluateRelation(input).receiptId,evaluateRelation(input).receiptId);
});

test('runtime performs no network call',()=>{
 const originalFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=()=>{calls+=1;throw new Error('NETWORK_FORBIDDEN');};
 try{
  evaluateRelation(pair('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.',7));
 }finally{
  globalThis.fetch=originalFetch;
 }
 assert.equal(calls,0);
});

test('Northstar What Changed demo exercises all four legal processing outcomes and keeps human authority',()=>{
 const result=runWhatChangedBatch(demo);
 assert.deepEqual(result.counts,{pairs:5,resolved:3,abstained:1,notEvaluated:1,errors:0,candidates:2,investigations:1});
 assert.deepEqual(result.receipts.map(item=>item.relation),['SUPPORTS','COUNTERS','AMBIGUOUS',null,'NEUTRAL']);
 assert.equal(result.candidates.length,2);
 assert.equal(result.investigations.length,1);
 assert.equal(result.investigations[0].state,'NEEDS_INVESTIGATION');
 assert.equal(result.investigations[0].requirement,'PRIOR_COMPARABLE_RATE');
 assert.equal(result.investigations[0].claimMutationAllowed,false);
 for(const candidate of result.candidates){
  assert.equal(candidate.state,'PENDING_HUMAN_REVIEW');
  assert.deepEqual(candidate.humanReview,{required:true,claimMutationAllowed:false});
  const serialized=JSON.stringify(candidate);
  assert.ok(!serialized.includes('"impact"'));
  assert.ok(!serialized.includes('"suggestedStatus"'));
  assert.ok(!serialized.includes('"confidence"'));
 }
});


test('deterministic relation orders explicit rates by year instead of mention order',()=>{
 const decision=deterministicRelation({
  claim:{statement:'Subscription growth was faster in 2026 than in 2025.'},
  evidence:{statement:'Subscription growth was 18 percent in 2026 and 12 percent in 2025.'}
 });
 assert.equal(decision.relation,'SUPPORTS');
 assert.equal(decision.rule,'RT_SECOND_ORDER_SERIES');
});

test('broad financial words do not collapse different metrics or business lines',()=>{
 const lineMismatch=deterministicRelation({
  claim:{statement:'Services net sales increased in 2026.'},
  evidence:{statement:'Hardware net sales increased 15 percent in 2026.'}
 });
 const metricMismatch=deterministicRelation({
  claim:{statement:'Gross margin improved in 2026.'},
  evidence:{statement:'Data Center revenue grew 70 percent in 2026.'}
 });
 assert.equal(lineMismatch.relation,'NEUTRAL');
 assert.equal(metricMismatch.relation,'NEUTRAL');
 assert.equal(metricMismatch.rule,'RT_NON_BEARING_METRIC');
});

test('causal claims require an explicit causal link rather than co-occurrence',()=>{
 const decision=deterministicRelation({
  claim:{statement:'AI infrastructure investment was the primary driver of revenue growth in 2026.'},
  evidence:{statement:'Revenue increased 20 percent in 2026 and AI infrastructure investment also increased.'}
 });
 assert.equal(decision.relation,'NEUTRAL');
 assert.equal(decision.rule,'RT_CAUSAL_LINK_ABSENT');
});

test('explicit causal attribution can support a causal claim',()=>{
 const decision=deterministicRelation({
  claim:{statement:'AI infrastructure investment pressured cloud gross margin in 2026.'},
  evidence:{statement:'Cloud gross margin decreased in 2026, driven by scaling AI infrastructure.'}
 });
 assert.equal(decision.relation,'SUPPORTS');
 assert.equal(decision.rule,'RT_EXPLICIT_CAUSAL_ATTRIBUTION');
});

test('causal evidence at a narrower scope does not silently prove a total-company claim',()=>{
 const decision=deterministicRelation({
  claim:{statement:'Premium product sales caused total net sales growth in 2026.'},
  evidence:{statement:'Device net sales increased because of premium product sales, while total net sales also increased.'}
 });
 assert.equal(decision.relation,'AMBIGUOUS');
 assert.equal(decision.rule,'RT_CAUSAL_SCOPE_MISSING');
});

test('mix shift uses target growth relative to total growth',()=>{
 const decision=deterministicRelation({
  claim:{statement:'Revenue mix shifted toward Services in 2026.'},
  evidence:{statement:'Services net sales grew 14 percent in 2026 while total net sales grew 6 percent in 2026.'}
 });
 assert.equal(decision.relation,'SUPPORTS');
 assert.equal(decision.rule,'RT_MIX_SHARE_INFERENCE');
});
