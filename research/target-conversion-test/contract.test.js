import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntent,assertIntent,parseBound} from '../target-conversion/contract.js';
import {request} from '../target-conversion/dev.js';
import {bindSourceWhitespace,extractCompound} from '../target-conversion/extraction.js';
import {decide} from '../target-conversion/eval.js';
test('intent rejects answer injection, unsupported taxonomy and invalid time semantics',()=>{
 const intent=createIntent(request,{createdAt:'2028-04-01T00:00:00Z'});
 for(const extra of [{expectedValue:37},{expectedSpanId:'SPAN-X'},{goldAnnotation:{}},{normalizedAnswer:37000000},{targetCategory:'GOLD_01_TYPE'},{timeScope:{kind:'period',start:null,end:'2027-12-31'}},{dimension:{kind:'customer_label',value:null}}])assert.throws(()=>assertIntent({...intent,...extra}));
 assert.equal(intent.targetCategory,'revenue');assert.equal(intent.targetMetricOrConcept,'consolidated_revenue');
});
test('not-supported cannot smuggle a financial fact or authority',()=>{
 assert.deepEqual(parseBound('{"targetMatch":"ambiguous","fact":null}'),{targetMatch:'ambiguous',fact:null});
 for(const output of [{targetMatch:'not_supported',fact:{}},{targetMatch:'supported',fact:null},{targetMatch:'not_supported',fact:null,Admission:'ACCEPTED'}])assert.throws(()=>parseBound(JSON.stringify(output)));
});
test('source whitespace copy is unique and cannot repair words, values or dates',()=>{
 const support={type:'text',text:'Revenue was $17 million for the year ended\nDecember 31, 2027.',spanId:'source',supportHash:'hash'};
 const result=bindSourceWhitespace(support,{rawValueText:'$17 million',rawUnitText:null,periodText:'year ended December 31, 2027'});
 assert.equal(result.fact.periodText,'year ended\nDecember 31, 2027');assert.equal(result.proof.length,1);
 for(const periodText of ['year ended December 31, 2026','six months ended December 31, 2027'])assert.equal(bindSourceWhitespace(support,{periodText}).proof.length,0);
 const repeated={...support,text:support.text+' '+support.text};assert.equal(bindSourceWhitespace(repeated,{periodText:'year ended December 31, 2027'}).proof.length,0);
});
test('compound extraction cannot associate respectively, shared units or unnamed values',()=>{
 const intent=createIntent(request),fact={rawValueText:'$17 million and $25 million'};
 for(const text of ['Revenue and cash flow were $17 million and $25 million, respectively.','Revenue was $17 and $25 million.','Values were $17 million and $25 million.'])assert.ok(extractCompound({type:'text',text},intent,fact).failure);
});
test('readiness uses all 16 plus fixed 14 reachability and zero wrong-target/safety errors',()=>{
 const gate={safety:{falseAccept:0,providerTimeout:0},capability:{minimumStrictTargetConversions:10,minimumConditionalTargetConversion:10/14,maximumValidButWrongTargetCandidates:0}},metrics={cases:16,strictTargetConversion:10,strictGivenTop3:{rate:10/14},validButWrongTargetCandidates:0};
 assert.equal(decide({metrics,safety:{falseAccept:0,providerTimeout:0},gate}).decision,'EVIDENCE ACQUISITION READY');
 assert.equal(decide({metrics:{...metrics,validButWrongTargetCandidates:1},safety:{falseAccept:1,providerTimeout:0},gate}).decision,'STAY ON TARGET CONVERSION');
 assert.equal(decide({metrics:{...metrics,cases:14},safety:{falseAccept:0,providerTimeout:0},gate}).passed,false);
});
