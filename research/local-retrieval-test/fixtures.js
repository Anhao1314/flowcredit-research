// Shared fixtures for the locked-run assembly and resume tests.
import {assembleLockedRun} from '../local-retrieval/cli.js';
import {retrievalMetrics,candidateReduction} from '../local-retrieval/eval.js';

export const rate=(value)=>({numerator:Math.round(value*16),denominator:16,rate:value});
export function metricsOf({target=0.6875,conversion=0.6875,numeric=0.8,unit=0.8,period=1,category=0.6,chain=0.375,fabricated=0,falseRejects=1}={}){
 return {selectionSchemaValidity:rate(1),fabricatedSupportRate:{numerator:fabricated,denominator:127,rate:fabricated/127},sourceSupportFidelity:rate(1),tableStructuralFidelity:rate(1),targetSelectionRate:rate(target),factKindAccuracy:rate(0.9),numericAccuracy:rate(numeric),unitAccuracy:rate(unit),periodAccuracy:rate(period),categoryAccuracy:rate(category),chainParseOnlyRate:rate(chain),chainCorrectRate:rate(chain),candidateConversionRate:rate(conversion),validatorFalseRejects:falseRejects,validatorFalseAccepts:0,wrongSupportSelections:8};
}
export function armOf({label,target,conversion,fabricated=0,tokens=1000,perCase=[1000],timeouts=0,noUsage=0,phase={selection:{count:16,median:20000,p95:30000},interpretation:{count:16,median:8000,p95:12000}},recall=0.9375}){
 const cases=Array.from({length:16},(_,index)=>({caseId:'GOLD-'+String(index+1).padStart(2,'0'),expectedSpanIds:['SPAN-'+index]}));
 const responses=cases.map((entry,index)=>({caseId:entry.caseId,candidateCount:40,visibleCount:40,abstained:false,results:[{spanId:index<Math.round(recall*16)?'SPAN-'+index:'SPAN-other',finalRank:1,lexicalRank:1,semanticRank:1,lexicalScore:1,semanticScore:0.7,hybridScore:0.03}],filtered:{wrongSubject:0,future:0,unavailable:0},latencyMs:{filter:1,lexical:2,semantic:12,fusion:1,total:16}}));
 const retrievalMetricsReport=retrievalMetrics({cases,responses});
 const splits={table:{cases:12,targetSelection:rate(target),numericAccuracy:rate(0.8),unitAccuracy:rate(0.8),periodAccuracy:rate(1),chainCorrectRate:rate(0.3),candidateConversionRate:rate(conversion)},text:{cases:4,targetSelection:rate(target),numericAccuracy:rate(0.8),unitAccuracy:rate(0.8),periodAccuracy:rate(1),chainCorrectRate:rate(0.5),candidateConversionRate:rate(conversion)}};
 const caseRows=Array.from({length:16},(_,index)=>({caseId:'GOLD-'+String(index+1).padStart(2,'0'),failure:timeouts&&index<timeouts?'PROVIDER_TIMEOUT':'NONE',detail:null}));
 const scores=cases.map(entry=>({caseId:entry.caseId,expectedSupportType:'numeric',targetSelected:true,numericCorrect:true,unitCorrect:true,periodCorrect:true,categoryCorrect:true,chainParseOnly:false,chainCorrect:true,proposalValidated:true,converted:true,conversionStatus:'converted',validatorFalseReject:false,selectedCount:1,nonTargetSelections:0,findings:[]}));
 // Mirrors production: a timed-out call carries no usage, so its case row has a null token count.
 const usagePerCase=perCase.filter((_,index)=>index>=noUsage);
 const payloadCaseRows=cases.map((entry,index)=>({caseId:entry.caseId,inputTokens:index<noUsage?null:(perCase[index%perCase.length]??perCase.at(-1))}));
 return {label,result:{metrics:metricsOf({target,conversion}),splits,gateResult:{fabricatedSupport:true},gatePassed:true,failureBreakdown:{PROVIDER_TIMEOUT:timeouts},latency:{medianMs:110000,p95Ms:238000},claimsProtection:{before:null,after:null,unchanged:true},scores,results:cases.map(()=>({status:'generated',endToEndLatencyMs:100000}))},payload:{extra:{tokenStats:{perCase:usagePerCase,median:usagePerCase[0]??null,p95:usagePerCase.at(-1)??null,total:tokens},phaseLatencyMs:phase,inferenceLatencyMs:{count:16,median:8000},injection:{summary:{fabricatedTotal:0},usage:{calls:4}},futureLeakage:{count:0,leaks:[]}},caseRows:payloadCaseRows,latency:{medianMs:110000}},caseRows,measurement:{retrievalMetrics:retrievalMetricsReport,candidateReduction:candidateReduction({cases,responses})},tokens:{calls:160,inputTokens:tokens,outputTokens:900,failureCodes:timeouts?['PROVIDER_TIMEOUT']:[]},injectionUsage:{calls:4},responses,futureLeakage:{count:0,leaks:[]}};
}
export const gate={goldHash:'sha256:c5d78e91272e6b97de36e502a5f5f06b85fa27e20280e8087244f4235a2ae739',frozenK:8,fusionMode:'hybrid',retrieval:{k:8,limit:8,goldRetrievalRecallAtK:0.9},embedding:{model:'nomic-embed-text',modelDigest:'sha256:'+'a'.repeat(64)},safety:{fabricatedSupport:0,sourceSupportFidelity:1,falseAccept:0,futureLeakage:0,wrongSubject:0,claimMutation:0},efficiency:{candidateReductionRatioMedian:0.5,inputTokenReductionRatio:0.4,maxTimeouts:3},capability:{targetSelectionRate:0.6875,candidateConversionRate:0.6875}};
export const context={annotation:{cases:Array.from({length:16},(_,index)=>({caseId:'GOLD-'+String(index+1).padStart(2,'0'),expectedSpanIds:['SPAN-'+index]}))}};
export const embedding={metadata:{model:'nomic-embed-text',modelVersion:'sha256:'+'a'.repeat(64),dimension:768,runtime:{name:'ollama',version:'0.34.0'}},describe:()=>({endpoint:'http://127.0.0.1:11434'}),receipts:[]};
export const chat={metadata:{provider:'ollama',model:'qwen3.5:9b',modelVersion:'sha256:model',runtime:{name:'ollama',version:'0.34.0'}},describe:()=>({endpoint:'http://127.0.0.1:11434'}),receipts:[]};
export const spanIndex={count:()=>7687};
export const resource={samples:10,swapDeltaBytes:0};
export const decisions={ready:'LOCAL HYBRID RETRIEVAL READY',stay:'STAY ON RETRIEVAL',throughput:'LOCAL MODEL THROUGHPUT STILL BLOCKING'};
export const warm={coldStartMs:1800,loadMs:6400};

