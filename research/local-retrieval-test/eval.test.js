import test from 'node:test';
import assert from 'node:assert/strict';
import {retrievalMetrics,firstRelevantRank,candidateReduction,tokenReduction,failureDecomposition,evaluateRetrievalGate,stats,retrievalFailureKinds} from '../local-retrieval/eval.js';

const cases=[
 {caseId:'G-1',kind:'gold',subjectId:'coreweave',page:1,question:'q1',expectedSpanIds:['SPAN-1']},
 {caseId:'G-2',kind:'gold',subjectId:'coreweave',page:2,question:'q2',expectedSpanIds:['SPAN-9']},
 {caseId:'N-1',kind:'negative',subjectId:'coreweave',page:3,question:'q3',expectedSpanIds:[]}
];
const responses=[
 {caseId:'G-1',candidateCount:40,visibleCount:40,results:[{spanId:'SPAN-1',finalRank:2,lexicalRank:2,semanticRank:3},{spanId:'SPAN-2',finalRank:1,lexicalRank:1,semanticRank:null}]},
 {caseId:'G-2',candidateCount:20,visibleCount:20,results:[{spanId:'SPAN-3',finalRank:1,lexicalRank:null,semanticRank:1}]},
 {caseId:'N-1',candidateCount:30,visibleCount:30,results:[],abstained:true}
];
test('recall and MRR are computed against the expected spans, misses are named',()=>{
 const metrics=retrievalMetrics({cases,responses});
 assert.equal(metrics.recallAtK.recallAt1.numerator,0);
 assert.equal(metrics.recallAtK.recallAt3.numerator,1);
 assert.equal(metrics.recallAtK.recallAt10.rate,0.5);
 assert.equal(metrics.mrr.numerator,0.5);
 assert.deepEqual(metrics.misses,['G-2']);
 assert.deepEqual(metrics.abstainedNegatives,['N-1']);
 assert.deepEqual(metrics.retrievalMisses,[{caseId:'G-2',candidateCount:20,visibleCount:20,retrieved:['SPAN-3']}]);
 assert.equal(firstRelevantRank(['SPAN-3'],[{spanId:'SPAN-3',finalRank:4}]),4);
 assert.equal(firstRelevantRank(['SPAN-3'],[]),null);
});
test('candidate reduction reports median and p95 over the frozen case set',()=>{
 const reduction=candidateReduction({cases,responses});
 assert.equal(reduction.before.median,30);
 assert.equal(reduction.after.median,1);
 assert.equal(reduction.candidateReductionRatio.median,0.95);
 assert.equal(reduction.cases,3);
});
test('token reduction compares full candidate context with the retrieved context',()=>{
 const reduction=tokenReduction({before:[6106,6106,6106,4295],after:[1200,1100,1300,900]});
 assert.equal(reduction.before.total,22613);
 assert.equal(reduction.after.total,4500);
 assert.ok(reduction.totalReductionRatio>0.79);
 assert.equal(stats([1,2,3]).p95,3);
 assert.equal(stats([]).count,0);
});
test('failures are decomposed into the five pre-registered kinds',()=>{
 const decomposition=failureDecomposition({caseRows:[{caseId:'A',failure:'RETRIEVAL_MISS'},{caseId:'B',failure:'PROVIDER_TIMEOUT'},{caseId:'C',failure:'NONE'}]});
 assert.deepEqual(Object.keys(decomposition.counts).sort(),[...retrievalFailureKinds].sort());
 assert.equal(decomposition.counts.RETRIEVAL_MISS,1);
 assert.equal(decomposition.counts.PROVIDER_TIMEOUT,1);
 assert.equal(decomposition.counts.MODEL_SELECTION_ERROR,0);
 assert.equal(decomposition.succeeded,1);
 assert.equal(decomposition.examples.length,2);
});
test('the retrieval gate fails closed on any missed hard gate',()=>{
 const gate={safety:{fabricatedSupport:0,sourceSupportFidelity:1,falseAccept:0,futureLeakage:0,wrongSubject:0,claimMutation:0},retrieval:{k:10,goldRetrievalRecallAtK:0.9},efficiency:{candidateReductionRatioMedian:0.5,inputTokenReductionRatio:0.4,maxTimeouts:3},capability:{targetSelectionRate:0.6875,candidateConversionRate:0.6875}};
 const metrics=retrievalMetrics({cases,responses});
 const efficiency={candidateReductionRatio:candidateReduction({cases,responses}).candidateReductionRatio,tokens:tokenReduction({before:[100,100],after:[50,50]}),timeouts:{control:4,retrieval:1}};
 const safety={fabricatedSupport:0,sourceSupportFidelity:1,falseAccept:0,futureLeakage:0,wrongSubject:0,claimMutation:0};
 const capability={targetSelectionRate:0.75,candidateConversionRate:0.69};
 const passed=evaluateRetrievalGate({metrics,efficiency,safety,capability,gate});
 assert.equal(passed.passed,false);
 assert.deepEqual(passed.failed,['retrieval.goldRetrievalRecallAtK']);
 assert.equal(passed.items['efficiency.timeouts'].passed,true);
 assert.equal(passed.items['capability.candidateConversionRate'].passed,true);
 const strict={...efficiency,timeouts:{control:4,retrieval:3}};
 assert.deepEqual(evaluateRetrievalGate({metrics,efficiency:strict,safety,capability,gate}).failed,['efficiency.timeouts','retrieval.goldRetrievalRecallAtK']);
 const broken={...safety,falseAccept:1};
 assert.ok(evaluateRetrievalGate({metrics,efficiency,safety:broken,capability,gate}).failed.includes('safety.falseAccept'));
});
