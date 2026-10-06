import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {investigatePair} from '../investigate/loop.js';

const fixture=JSON.parse(readFileSync(new URL('../investigate/fixtures/northstar-acceleration.json',import.meta.url),'utf8'));

test('investigation converts the frozen acceleration abstention into an explicit research question',()=>{
 const result=investigatePair(fixture);
 assert.equal(result.initial.processingStatus,'ABSTAINED');
 assert.equal(result.initial.relation,'AMBIGUOUS');
 assert.equal(result.plan.requirement,'PRIOR_COMPARABLE_RATE');
 assert.match(result.plan.question,/previous comparable-period rate/);
 assert.equal(result.plan.claimMutationAllowed,false);
});

test('controlled local retrieval resolves 22% -> 40% acceleration without network access',()=>{
 const originalFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=()=>{calls++;throw new Error('NETWORK_FORBIDDEN');};
 let result;
 try{result=investigatePair(fixture);}finally{globalThis.fetch=originalFetch;}
 assert.equal(calls,0);
 assert.equal(result.retrieved.evidenceId,'EVID-NST-GROWTH-2025');
 assert.equal(result.state,'RESOLVED_AFTER_INVESTIGATION');
 assert.equal(result.final.processingStatus,'RESOLVED');
 assert.equal(result.final.relation,'SUPPORTS');
 assert.deepEqual(result.trace.map(item=>item.type),[
  'RELATION_EVALUATED','INVESTIGATION_PLANNED','CONTEXT_RETRIEVED','RELATION_REEVALUATED'
 ]);
});

test('missing context stays safely unresolved rather than fabricating a direction',()=>{
 const result=investigatePair({...fixture,evidencePool:[]});
 assert.equal(result.state,'NEEDS_MORE_EVIDENCE');
 assert.equal(result.final.processingStatus,'ABSTAINED');
 assert.equal(result.final.relation,'AMBIGUOUS');
 assert.equal(result.trace.at(-1).type,'CONTEXT_NOT_FOUND');
});
