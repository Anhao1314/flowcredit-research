import test from 'node:test';
import assert from 'node:assert/strict';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {assembleLockedRun,portablePath} from '../local-retrieval/cli.js';
import {armOf,warm,gate,context,embedding,chat,spanIndex,resource,decisions} from './fixtures.js';

test('committed artifacts record runtime paths in home-relative form',()=>{
 assert.equal(portablePath(join(homedir(),'fc-agent','research-local-retrieval','span-index.sqlite')),'~/fc-agent/research-local-retrieval/span-index.sqlite');
 assert.equal(portablePath(homedir()),'~');
 assert.equal(portablePath('/opt/external/span-index.sqlite'),'/opt/external/span-index.sqlite');
 assert.ok(!portablePath(homedir()+'-sibling').startsWith('~'));
});

test('a passing locked run assembles results, comparison and cost artifacts without undefined fields',()=>{
 const controlArm=armOf({label:'v0.10-control',target:0.6875,conversion:0.6875,tokens:480000,perCase:Array.from({length:16},()=>30000),timeouts:3,recall:0});
 const retrievalArm=armOf({label:'v0.11-hybrid',target:0.75,conversion:0.6875,tokens:120000,perCase:Array.from({length:16},()=>7500),timeouts:0,recall:0.9375});
 const assembled=assembleLockedRun({controlArm,retrievalArm,context,phaseGate:gate,embedding,chat,spanIndex,findings:[],resource,warm,decisions});
 assert.equal(assembled.decision,'LOCAL HYBRID RETRIEVAL READY');
 assert.equal(assembled.gateResult.passed,true);
 assert.equal(assembled.resultsPayload.efficiency.tokens.totalReductionRatio,0.75);
 assert.equal(assembled.resultsPayload.efficiency.timeouts.control,3);
 assert.equal(assembled.resultsPayload.efficiency.timeouts.retrieval,0);
 assert.equal(assembled.resultsPayload.safety.wrongSubject,0);
 assert.equal(assembled.resultsPayload.safety.claimMutation,0);
 assert.equal(assembled.runtimeCosts.paidInferenceApiCostUsd,0);
 assert.equal(assembled.runtimeCosts.paidEmbeddingApiCostUsd,0);
 assert.equal(assembled.resultsPayload.embedding.indexRecords,7687);
 assert.equal(assembled.resultsPayload.cases.length,16);
 assert.equal(assembled.comparison.table.find(row=>row.metric==='input tokens').retrieval,120000);
 assert.ok(assembled.resultsPayload.retrieval.limit===8);
 const flat=JSON.stringify(assembled.resultsPayload);
 assert.ok(!flat.includes('undefined'),'serialized results must not carry undefined fields');
 assert.ok(!flat.includes('NaN'),'serialized results must not carry NaN');
});
test('a retrieval recall below the registered gate stays on retrieval instead of being softened',()=>{
 const controlArm=armOf({label:'v0.10-control',target:0.6875,conversion:0.6875,tokens:480000,perCase:[30000],timeouts:3,recall:0});
 const retrievalArm=armOf({label:'v0.11-hybrid',target:0.75,conversion:0.6875,tokens:120000,perCase:[7500],timeouts:0,recall:0.5});
 const assembled=assembleLockedRun({controlArm,retrievalArm,context,phaseGate:gate,embedding,chat,spanIndex,findings:[],resource,warm,decisions});
 assert.equal(assembled.decision,'STAY ON RETRIEVAL');
 assert.deepEqual(assembled.gateResult.failed,['retrieval.goldRetrievalRecallAtK']);
});
test('a timeout regression is reported as a throughput blocker, not as success',()=>{
 const controlArm=armOf({label:'v0.10-control',target:0.6875,conversion:0.6875,tokens:480000,perCase:[30000],timeouts:3,recall:0});
 const retrievalArm=armOf({label:'v0.11-hybrid',target:0.75,conversion:0.6875,tokens:120000,perCase:[7500],timeouts:5,recall:0.9375});
 const assembled=assembleLockedRun({controlArm,retrievalArm,context,phaseGate:gate,embedding,chat,spanIndex,findings:[],resource,warm,decisions});
 assert.equal(assembled.decision,'LOCAL MODEL THROUGHPUT STILL BLOCKING');
 assert.ok(assembled.gateResult.failed.includes('efficiency.timeouts'));
});
test('cases without usage in one arm are excluded from the paired token comparison',()=>{
 const controlArm=armOf({label:'v0.10-control',target:0.6875,conversion:0.6875,tokens:390000,perCase:Array.from({length:16},()=>30000),timeouts:3,noUsage:3,recall:0});
 const retrievalArm=armOf({label:'v0.11-hybrid',target:0.75,conversion:0.6875,tokens:120000,perCase:Array.from({length:16},()=>7500),timeouts:0,recall:0.9375});
 const assembled=assembleLockedRun({controlArm,retrievalArm,context,phaseGate:gate,embedding,chat,spanIndex,findings:[],resource,warm,decisions});
 const tokens=assembled.resultsPayload.efficiency.tokens;
 assert.equal(tokens.matchedCases,13);
 assert.equal(tokens.before.total,390000);
 assert.equal(tokens.after.total,97500);
 assert.equal(tokens.totalReductionRatio,0.75);
 assert.equal(tokens.armCounts.control,13);
 assert.equal(tokens.armCounts.retrieval,16);
 assert.equal(tokens.armTotals.control,390000);
 assert.equal(tokens.armTotals.retrieval,120000);
});
