import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleHandleRun} from '../selection-handles/assembly.js';
import {rate} from '../selection-handles/eval.js';
import {retrievalMetrics} from '../local-retrieval/eval.js';

const caseIds=Array.from({length:16},(_,index)=>'GOLD-'+String(index+1).padStart(2,'0'));
export const gate={version:'selection-handles-gate/v0.11.1',registeredAt:'2026-09-14T00:00:00.000Z',goldHash:'sha256:'+'c'.repeat(64),frozenK:8,fusionMode:'hybrid',retrieval:{k:8,limit:8,goldRetrievalRecallAtK:0.9},embedding:{model:'nomic-embed-text',modelDigest:'sha256:'+'a'.repeat(64)},baseline:{phase:'v0.11',decision:'STAY ON RETRIEVAL',targetSelectionRate:0.75,candidateConversionRate:0.6875,timeouts:0,invalidSelectionHandles:null,fabricatedSupport:1,chainCorrectRate:0.375},safety:{invalidSelectionHandles:0,fabricatedSupport:0,sourceSupportFidelity:1,falseAccept:0,futureLeakage:0,wrongSubject:0,claimMutation:0},capability:{targetSelectionRate:0.75,candidateConversionRate:0.6875},efficiency:{timeoutsExact:0}};
const context={annotation:{cases:caseIds.map((caseId,index)=>({caseId,expectedSpanIds:['SPAN-'+index]}))}};
const embedding={metadata:{provider:'ollama',model:'nomic-embed-text',modelVersion:'sha256:'+'a'.repeat(64),dimension:768,runtime:{name:'ollama',version:'0.34.0'}},describe:()=>({endpoint:'http://127.0.0.1:11434'}),receipts:[]};
const chat={metadata:{provider:'ollama',model:'qwen3.5:9b',modelVersion:'sha256:model',runtime:{name:'ollama',version:'0.34.0'}},describe:()=>({endpoint:'http://127.0.0.1:11434'}),receipts:[{usage:{inputTokens:100,outputTokens:10,totalTokens:110},latencyMs:5000,tokensPerSecond:16}]};
const spanIndex={count:()=>7687};
const deps={context,embedding,chat,spanIndex,findings:[],resource:{samples:4,swapDeltaBytes:0},warm:{coldStartMs:900,loadMs:8},hardware:{platform:'darwin',cpuModel:'Apple M5',cpuCount:10,totalMemoryBytes:17179869184},sessionUsage:{calls:97,inputTokens:96512,outputTokens:10466,totalTokens:106978,footprint:null}};

export function armOf({invalid=0,invalidCases=[],fabricated=0,timeouts=0,target=0.75,conversion=0.6875,recall=0.9375,claimsUnchanged=true}={}){
 const cases=caseIds.map((caseId,index)=>({caseId,expectedSpanIds:['SPAN-'+index]}));
 const responses=cases.map((entry,index)=>({caseId:entry.caseId,candidateCount:40,visibleCount:40,abstained:false,results:[{spanId:index<Math.round(recall*16)?'SPAN-'+index:'SPAN-other',finalRank:1,lexicalRank:1,semanticRank:1,lexicalScore:1,semanticScore:0.7,hybridScore:0.03}],filtered:{wrongSubject:0,future:0,unavailable:0},latencyMs:{filter:1,lexical:2,semantic:12,fusion:1,total:16}}));
 const scores=cases.map((entry,index)=>({caseId:entry.caseId,expectedSupportType:index<12?'table':'text',targetSelected:true,numericCorrect:true,unitCorrect:true,periodCorrect:true,categoryCorrect:true,chainParseOnly:true,chainCorrect:true,proposalValidated:true,converted:true,conversionStatus:'converted',validatorFalseReject:false,selectedCount:1,nonTargetSelections:0,findings:[]}));
 const caseRecords=new Map(cases.map((entry,index)=>[entry.caseId,{caseId:entry.caseId,status:invalidCases.includes(entry.caseId)?'INVALID_SELECTION_HANDLE':'generated',candidateCount:40,retrievedCount:8,selectedSpanIds:invalidCases.includes(entry.caseId)?[]:['SPAN-'+index],invalidHandles:invalidCases.includes(entry.caseId)?['S9']:[],selectionInterface:{version:'selection-handles/v1',handles:[{handle:'S1',spanId:'SPAN-'+index,rank:1}]},retrieval:{results:[{spanId:'SPAN-'+index}],filtered:{wrongSubject:0}}}]));
 const caseRows=cases.map((entry,index)=>({caseId:entry.caseId,failure:timeouts&&index<timeouts?'PROVIDER_TIMEOUT':invalidCases.includes(entry.caseId)?'INVALID_SELECTION_HANDLE':'NONE',detail:null}));
 return {label:'v0.11.1-handles',caseRecords,caseRows,responses,result:{metrics:{fabricatedSupportRate:{numerator:fabricated,denominator:96,rate:fabricated/96},sourceSupportFidelity:rate(1,1),validatorFalseAccepts:0,targetSelectionRate:rate(Math.round(target*16),16),candidateConversionRate:rate(Math.round(conversion*16),16),chainCorrectRate:rate(6,16)},claimsProtection:{before:null,after:null,unchanged:claimsUnchanged},scores,results:cases.map(()=>({status:'generated',endToEndLatencyMs:70000}))},payload:{extra:{tokenStats:{perCase:cases.map(()=>5000),median:5000,p95:8000,total:80000},phaseLatencyMs:{selection:{count:16,median:18000,p95:32000},interpretation:{count:81,median:7400,p95:8600}},injection:{summary:{fabricatedTotal:0}}}},measurement:{retrievalMetrics:retrievalMetrics({cases,responses})},tokens:{calls:97,inputTokens:96512,outputTokens:10466,totalTokens:106978,failureCodes:[]},injectionUsage:{calls:0},futureLeakage:{count:0,leaks:[]}};
}

test('a clean handle run is declared ready and keeps canonical ids in provenance',()=>{
 const assembled=assembleHandleRun({arm:armOf(),gate,...deps});
 assert.equal(assembled.decision,'LOCAL HYBRID RETRIEVAL READY');
 assert.equal(assembled.gateResult.passed,true);
 assert.equal(assembled.safety.invalidSelectionHandles,0);
 assert.equal(assembled.efficiency.timeouts,0);
 assert.equal(assembled.resultsPayload.selection.canonicalIdsExposedToModel,false);
 assert.equal(assembled.resultsPayload.cases[0].selectedHandles[0],'S1');
 assert.equal(assembled.resultsPayload.cases[0].selectedSpanIds[0],'SPAN-0');
 assert.equal(assembled.comparison.table.find(row=>row.metric==='invalid selection handles').v0111,0);
 assert.equal(assembled.comparison.resolvedHandles.length,16);
 const flat=JSON.stringify(assembled.resultsPayload);
 assert.equal(flat.includes('undefined'),false);
 assert.equal(flat.includes('NaN'),false);
});

test('an unusable handle fails the safety gate and is never reported as fabricated support',()=>{
 const assembled=assembleHandleRun({arm:armOf({invalidCases:['GOLD-07']}),gate,...deps});
 assert.equal(assembled.decision,'STAY ON HANDLE HARDENING');
 assert.deepEqual(assembled.gateResult.failed,['safety.invalidSelectionHandles']);
 assert.equal(assembled.safety.invalidSelectionHandles,1);
 assert.equal(assembled.safety.fabricatedSupport,0);
 assert.equal(assembled.decomposition.counts.INVALID_SELECTION_HANDLE,1);
 assert.equal(assembled.decomposition.counts.WRONG_SUPPORT_SELECTION,0);
 assert.deepEqual(assembled.invalidHandles.detail,[{caseId:'GOLD-07',status:'INVALID_SELECTION_HANDLE',invalidHandles:['S9']}]);
});

test('the decomposition keeps wrong selections, misses, abstentions, parser and validator apart',()=>{
 const arm=armOf();
 arm.caseRecords.get('GOLD-02').status='RETRIEVAL_ABSTAINED';
 arm.caseRecords.get('GOLD-03').selectedSpanIds=[];
 arm.caseRecords.get('GOLD-04').status='SPAN_SCHEMA_ERROR';
 arm.result.scores[4]={...arm.result.scores[4],targetSelected:false};
 arm.result.scores[5]={...arm.result.scores[5],targetSelected:true,chainParseOnly:false};
 arm.result.scores[6]={...arm.result.scores[6],targetSelected:true,chainParseOnly:true,proposalValidated:false};
 arm.result.scores[6].findings=['VALIDATOR_FALSE_REJECT'];
 arm.caseRows.find(row=>row.caseId==='GOLD-06').failure='VALIDATOR_REJECT';
 arm.caseRows.find(row=>row.caseId==='GOLD-07').failure='PARSER_ERROR';
 arm.caseRows.find(row=>row.caseId==='GOLD-05').failure='WRONG_SUPPORT_SELECTION';
 arm.caseRows.find(row=>row.caseId==='GOLD-03').failure='MODEL_ABSTENTION';
 arm.caseRows.find(row=>row.caseId==='GOLD-02').failure='RETRIEVAL_MISS';
 arm.caseRows.find(row=>row.caseId==='GOLD-04').failure='PARSER_ERROR';
 arm.caseRows.find(row=>row.caseId==='GOLD-08').failure='NONE';
 const assembled=assembleHandleRun({arm,gate,...deps});
 const counts=assembled.decomposition.counts;
 assert.equal(counts.INVALID_SELECTION_HANDLE,0);
 assert.equal(counts.RETRIEVAL_MISS,1);
 assert.equal(counts.MODEL_ABSTENTION,1);
 assert.equal(counts.WRONG_SUPPORT_SELECTION,1);
 assert.equal(counts.PARSER_ERROR,2);
 assert.equal(counts.VALIDATOR_REJECT,1);
 assert.equal(assembled.decomposition.succeeded,10);
});

test('a timeout and a capability regression each fail the v0.11.1 gate on their own item',()=>{
 const timedOut=assembleHandleRun({arm:armOf({timeouts:1}),gate,...deps});
 assert.equal(timedOut.gateResult.passed,false);
 assert.deepEqual(timedOut.gateResult.failed,['efficiency.timeouts']);
 assert.equal(timedOut.decision,'STAY ON HANDLE HARDENING');
 const weaker=assembleHandleRun({arm:armOf({target:0.6875}),gate,...deps});
 assert.deepEqual(weaker.gateResult.failed,['capability.targetSelectionRate']);
 const mutated=assembleHandleRun({arm:armOf({claimsUnchanged:false}),gate,...deps});
 assert.deepEqual(mutated.gateResult.failed,['safety.claimMutation']);
});
