// Real-source Relation Reality benchmark.
//
// Tier A uses reviewed CoreWeave primary-source observations and explicit research
// predicates already committed to this repository. No LLM creates labels.
// The oracle is structural and intentionally narrow: it measures whether a runtime
// respects recorded metric, unit and numeric predicate semantics.
import {readFileSync} from 'node:fs';
import {projectClaim,projectObservation} from '../../semantic-frame/project.js';
import {evaluateProjectedRelation} from '../../relation-runtime/semantic-runtime.js';
import {evaluateRelation} from '../../relation-runtime/runtime.js';

const claims=JSON.parse(readFileSync(new URL('../../fixtures/coreweave/claims.json',import.meta.url),'utf8'));
const observationDoc=JSON.parse(readFileSync(new URL('../../fixtures/coreweave/observations.json',import.meta.url),'utf8'));
const sources=JSON.parse(readFileSync(new URL('../../fixtures/coreweave/sources.json',import.meta.url),'utf8'));
const sourceByKey=new Map(sources.map(source=>[source.metadata.documentKey,source]));

const family=unit=>{
 const value=String(unit??'').toLowerCase();
 if(value==='percent'||value==='%')return 'percent';
 if(value==='usd'||value.includes('dollar'))return 'currency';
 if(value==='count'||value==='people')return 'count';
 return value?value:null;
};
function normalizedValue(observation){
 if(typeof observation.rawValue!=='number')return null;
 if(observation.rawUnit==='USD_millions')return observation.rawValue*1e6;
 if(observation.rawUnit==='USD_billions')return observation.rawValue*1e9;
 return observation.rawValue;
}
function predicate(value,threshold,operator){
 if(operator==='gt')return value>threshold;
 if(operator==='gte')return value>=threshold;
 if(operator==='lt')return value<threshold;
 if(operator==='lte')return value<=threshold;
 if(operator==='eq')return value===threshold;
 throw new Error('ORACLE_OPERATOR_UNSUPPORTED:'+operator);
}

// Independent structured oracle. This is not a language-understanding gold set.
// It is an executable correctness oracle for explicit recorded fields.
export function oracle(claim,observation){
 const value=normalizedValue(observation);
 if(value===null)return {processingStatus:'NOT_EVALUATED',relation:null,reason:'recorded value is non-numeric'};
 const claimFamily=family(claim.unit),evidenceFamily=family(observation.unit);
 if(!claimFamily||!evidenceFamily||claimFamily!==evidenceFamily)return {processingStatus:'NOT_EVALUATED',relation:null,reason:'unit family is not commensurable'};
 if(claim.metric!==observation.metric)return {processingStatus:'RESOLVED',relation:'NEUTRAL',reason:'different recorded metric'};
 const supports=predicate(value,claim.threshold,claim.operator);
 return {processingStatus:'RESOLVED',relation:supports?'SUPPORTS':'COUNTERS',reason:'explicit numeric predicate'};
}

function pairOf(claim,observation,claimIndex,observationIndex){
 const asOf=observationDoc.asOf;
 const claimId='REAL-CLAIM-'+String(claimIndex+1).padStart(2,'0');
 const evidenceId='REAL-EVID-'+String(observationIndex+1).padStart(2,'0');
 const revisionId=claimId+':v1';
 const relationInput={
  evidence:{evidenceId},
  claim:{claimId,revisionId},
  asOf,
  evidenceSide:{semantics:{state:'PRESENT',frameRef:'semantic:evidence:'+evidenceId}},
  claimSide:{semantics:{state:'PRESENT',frameRef:'semantic:claim:'+revisionId}}
 };
 const material={
  evidenceId,claimId,revisionId,asOf,subjectId:observationDoc.subjectId,
  claim:{statement:claim.statement},
  evidence:{
   statement:observation.statement,
   metric:observation.metric,
   normalizedValue:normalizedValue(observation),
   unit:observation.unit,
   periodStart:observation.periodStart,
   periodEnd:observation.periodEnd,
   observedAt:observation.observedAt
  }
 };
 const source=sourceByKey.get(observation.sourceKey)??null;
 const claimFrame=projectClaim(claim,{subjectId:observationDoc.subjectId,claimId,revisionId});
 const evidenceFrame=projectObservation(observation,{subjectId:observationDoc.subjectId,evidenceId,source});
 return {relationInput,material,claimFrame,evidenceFrame,source,expected:oracle(claim,observation),claim,observation};
}

export function buildRealityMatrix(){
 const rows=[];
 for(const [claimIndex,claim] of claims.entries()){
  for(const [observationIndex,observation] of observationDoc.observations.entries()){
   rows.push(pairOf(claim,observation,claimIndex,observationIndex));
  }
 }
 return rows;
}

const exact=(receipt,expected)=>receipt.processingStatus===expected.processingStatus&&receipt.relation===expected.relation;
const directional=expected=>['SUPPORTS','COUNTERS'].includes(expected.relation);
const unsafeDirectional=(receipt,expected)=>['SUPPORTS','COUNTERS'].includes(receipt.relation)&&!directional(expected);

function summarize(receipts,rows){
 const total=rows.length;
 const loadBearing=rows.filter(row=>directional(row.expected));
 const exactCount=rows.filter((row,index)=>exact(receipts[index],row.expected)).length;
 const directionalCorrect=loadBearing.filter(row=>{
  const index=rows.indexOf(row);
  return exact(receipts[index],row.expected);
 }).length;
 const unsafe=rows.filter((row,index)=>unsafeDirectional(receipts[index],row.expected)).length;
 return {
  pairs:total,
  exact:exactCount,
  exactRate:Number((exactCount/total).toFixed(4)),
  directionalPairs:loadBearing.length,
  directionalCorrect,
  directionalAccuracy:loadBearing.length?Number((directionalCorrect/loadBearing.length).toFixed(4)):null,
  unsafeDirectional:unsafe,
  unsafeDirectionalRate:Number((unsafe/total).toFixed(4)),
  resolved:receipts.filter(item=>item.processingStatus==='RESOLVED').length,
  abstained:receipts.filter(item=>item.processingStatus==='ABSTAINED').length,
  notEvaluated:receipts.filter(item=>item.processingStatus==='NOT_EVALUATED').length
 };
}

function safeTextEvaluation(row){
 try{return evaluateRelation({relationInput:row.relationInput,material:row.material});}
 catch(error){
  return {
   processingStatus:'ERROR',
   relation:null,
   reasonCodes:[String(error?.message??error)],
   authority:'ANALYTICAL_ONLY'
  };
 }
}

export function runRealityBenchmark(){
 const rows=buildRealityMatrix();
 const textReceipts=rows.map(row=>safeTextEvaluation(row));
 const semanticReceipts=rows.map(row=>evaluateProjectedRelation({
  relationInput:row.relationInput,
  claimFrame:row.claimFrame,
  evidenceFrame:row.evidenceFrame
 }));
 const failures=rows.map((row,index)=>({
  claimMetric:row.claim.metric,
  evidenceMetric:row.observation.metric,
  statement:row.observation.statement,
  sourceKey:row.observation.sourceKey,
  page:row.observation.page,
  expected:row.expected,
  text:{processingStatus:textReceipts[index].processingStatus,relation:textReceipts[index].relation,reason:textReceipts[index].reasonCodes?.[0]??null},
  semantic:{processingStatus:semanticReceipts[index].processingStatus,relation:semanticReceipts[index].relation,reason:semanticReceipts[index].reasonCodes?.[0]??null}
 })).filter((row,index)=>!exact(textReceipts[index],rows[index].expected)||!exact(semanticReceipts[index],rows[index].expected));
 return {
  version:'flowcredit.relation_reality_benchmark/v0.2',
  corpus:{
   subjectId:observationDoc.subjectId,
   sources:sources.length,
   observations:observationDoc.observations.length,
   claims:claims.length,
   pairs:rows.length,
   sourceDocuments:sources.map(source=>({
    documentKey:source.metadata.documentKey,
    title:source.title,
    sourceType:source.sourceType,
    url:source.url,
    contentHash:source.contentHash,
    hashStatus:source.metadata.hashStatus
   }))
  },
  methodology:{
   tier:'real-source structured oracle',
   labelAuthority:'recorded metric + canonical unit family + explicit predicate',
   caveat:'This measures correctness on explicit structured facts, not open-ended semantic generalization.'
  },
  textBaseline:summarize(textReceipts,rows),
  semanticRuntime:summarize(semanticReceipts,rows),
  failures
 };
}
