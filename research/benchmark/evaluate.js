import {evaluateRelation} from '../relation-runtime/runtime.js';
import {evaluateCandidateRelation} from '../relation-runtime/candidate-runtime.js';
import {evaluateCandidateR1Relation} from '../relation-runtime/candidate-r1-runtime.js';
import {validateBenchmark} from './schema.js';

const safeDivide=(n,d)=>d?n/d:0;
const round=value=>Math.round(value*10000)/10000;

function pairOf(item){
 return {
  relationInput:{
   evidence:{evidenceId:item.evidence.evidenceId},
   claim:{claimId:item.claim.claimId,revisionId:item.claim.revisionId},
   asOf:item.asOf,
   evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},
   claimSide:{semantics:{state:'NOT_MATERIALIZED'}}
  },
  material:{
   evidenceId:item.evidence.evidenceId,
   claimId:item.claim.claimId,
   revisionId:item.claim.revisionId,
   asOf:item.asOf,
   claim:{statement:item.claim.statement},
   evidence:{statement:item.evidence.statement}
  }
 };
}

export function scoreBenchmark(document,{runtime='candidate'}={}){
 const doc=validateBenchmark(document);
 const evaluator=runtime==='baseline'?evaluateRelation:runtime==='candidate'?evaluateCandidateRelation:runtime==='candidate-r1'?evaluateCandidateR1Relation:null;
 if(!evaluator)throw new Error('BENCHMARK_RUNTIME_UNKNOWN: '+runtime);
 const rows=doc.cases.map(item=>{
  const receipt=evaluator(pairOf(item));
  const predicted={processingStatus:receipt.processingStatus,relation:receipt.relation};
  const correct=predicted.processingStatus===item.expected.processingStatus&&predicted.relation===item.expected.relation;
  return {
   caseId:item.caseId,sourceId:item.sourceId,challenge:item.challenge,
   expected:item.expected,predicted,correct,
   route:receipt.route,reasonCodes:receipt.reasonCodes
  };
 });
 const labels=['SUPPORTS','COUNTERS','NEUTRAL','AMBIGUOUS'];
 const byLabel=Object.fromEntries(labels.map(label=>{
  const subset=rows.filter(row=>row.expected.relation===label);
  return [label,{n:subset.length,correct:subset.filter(row=>row.correct).length,accuracy:round(safeDivide(subset.filter(row=>row.correct).length,subset.length))}];
 }));
 const byChallenge={};
 for(const row of rows){
  byChallenge[row.challenge]??={n:0,correct:0};
  byChallenge[row.challenge].n+=1;
  if(row.correct)byChallenge[row.challenge].correct+=1;
 }
 for(const value of Object.values(byChallenge))value.accuracy=round(safeDivide(value.correct,value.n));

 const directionalGold=rows.filter(row=>['SUPPORTS','COUNTERS'].includes(row.expected.relation));
 const directionalCorrect=directionalGold.filter(row=>row.correct).length;
 const inversions=directionalGold.filter(row=>
  (row.expected.relation==='SUPPORTS'&&row.predicted.relation==='COUNTERS')||
  (row.expected.relation==='COUNTERS'&&row.predicted.relation==='SUPPORTS')
 ).length;
 const nonDirectionalGold=rows.filter(row=>['NEUTRAL','AMBIGUOUS'].includes(row.expected.relation));
 const unsafeDirectional=nonDirectionalGold.filter(row=>['SUPPORTS','COUNTERS'].includes(row.predicted.relation)).length;
 const ambiguousGold=rows.filter(row=>row.expected.relation==='AMBIGUOUS');
 const safeAbstentions=ambiguousGold.filter(row=>row.predicted.processingStatus==='ABSTAINED'&&row.predicted.relation==='AMBIGUOUS').length;
 const correct=rows.filter(row=>row.correct).length;

 return {
  benchmarkVersion:doc.version,
  benchmarkStatus:doc.status,
  runtime,
  evaluatedCases:rows.length,
  metrics:{
   overallAccuracy:round(safeDivide(correct,rows.length)),
   directionalAccuracy:round(safeDivide(directionalCorrect,directionalGold.length)),
   directionalInversionRate:round(safeDivide(inversions,directionalGold.length)),
   unsafeDirectionalErrorRate:round(safeDivide(unsafeDirectional,nonDirectionalGold.length)),
   ambiguousAbstentionRecall:round(safeDivide(safeAbstentions,ambiguousGold.length))
  },
  counts:{correct,incorrect:rows.length-correct,directionalGold:directionalGold.length,nonDirectionalGold:nonDirectionalGold.length},
  byLabel,byChallenge,rows
 };
}

export function evaluateGate(result,gate){
 const checks={
  overallAccuracy:result.metrics.overallAccuracy>=gate.thresholds.overallAccuracyMin,
  directionalAccuracy:result.metrics.directionalAccuracy>=gate.thresholds.directionalAccuracyMin,
  directionalInversionRate:result.metrics.directionalInversionRate<=gate.thresholds.directionalInversionRateMax,
  unsafeDirectionalErrorRate:result.metrics.unsafeDirectionalErrorRate<=gate.thresholds.unsafeDirectionalErrorRateMax,
  ambiguousAbstentionRecall:result.metrics.ambiguousAbstentionRecall>=gate.thresholds.ambiguousAbstentionRecallMin
 };
 return {status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,thresholds:gate.thresholds};
}
