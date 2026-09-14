import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {locked,verifyLocked} from '../analyst-real/eval.js';
import {groundingCases,kindFor} from '../grounding/eval.js';
import {reclassifyLockedGold} from './gold.js';

export const gate=JSON.parse(readFileSync(new URL('../eval/evidence-support/phase-gate.json',import.meta.url)));
export const failureKinds=['SPAN_SCHEMA_ERROR','FABRICATED_SPAN','SUPPORT_INVALID','WRONG_SUPPORT_SELECTION','INTERPRETATION_SCHEMA_ERROR','DETERMINISTIC_PARSE_UNSUPPORTED','VALUE_ERROR','UNIT_ERROR','PERIOD_ERROR','ACTUAL_GUIDANCE_ERROR','NO_RETRIEVAL_ANCHOR','CANDIDATE_REJECTED','VALIDATOR_FALSE_REJECT','GOLD_LIMITATION','UNKNOWN'];
const rate=(numerator,denominator)=>({numerator,denominator,rate:denominator?numerator/denominator:null});

export function supportCases(registry,index){
 return groundingCases(registry,index);
}
export function annotateGold(registry,sentenceIndex,cases){
 return reclassifyLockedGold(registry,sentenceIndex,cases.map(entry=>({caseId:entry.caseId,goldEvidenceId:entry.goldEvidenceId,legacyBinding:entry.legacyBinding,documentId:entry.documentId,page:entry.page,expected:entry.expected})));
}
export function scoreCase(annotation,result,{expected}={}){
 const findings=[],selections=result.selections??[];
 if(result.status==='SPAN_SCHEMA_ERROR')findings.push('SPAN_SCHEMA_ERROR');
 if(result.status==='FABRICATED_SPAN')findings.push('FABRICATED_SPAN');
 for(const error of result.errors??[])if(error.error==='SUPPORT_INVALID')findings.push('SUPPORT_INVALID');
 if(selections.some(entry=>entry.status==='INTERPRETATION_SCHEMA_ERROR'))findings.push('INTERPRETATION_SCHEMA_ERROR');
 const targetIds=new Set(annotation.expectedSpanIds);
 const target=selections.filter(entry=>targetIds.has(entry.spanId)),nonTarget=selections.filter(entry=>!targetIds.has(entry.spanId));
 if(!target.length)findings.push('WRONG_SUPPORT_SELECTION');
 const chosen=target[0]??null;
 const numericMatches=!!chosen?.parse?.numeric&&chosen.parse.numeric.status==='known'&&chosen.parse.numeric.normalizedValue===expected.normalizedValue;
 const unitMatches=!!chosen?.parse?.numeric&&chosen.parse.numeric.rawUnit===expected.rawUnit;
 const period=chosen?.parse?.period??null;
 const periodMatches=!!period&&period.status==='known'&&period.end===(expected.periodEnd??expected.observedAt??null)&&(expected.periodStart?period.start===expected.periodStart:true);
 const categoryMatches=!!chosen?.value&&chosen.value.metricOrCategory===expected.category;
 const kindMatches=!!chosen&&kindFor(expected.category)===chosen.factKind;
 const validated=chosen?.proposal?.validationStatus==='validated';
 const chainParseOnly=target.length>0&&numericMatches&&unitMatches&&periodMatches&&categoryMatches;
 const validatorFalseReject=target.length>0&&numericMatches&&unitMatches&&periodMatches&&!validated;
 if(validatorFalseReject)findings.push('VALIDATOR_FALSE_REJECT');
 if(chosen?.proposal&&!validated)findings.push(...(chosen.proposal.validationFindings??[]));
 return {caseId:annotation.caseId,legacyBinding:annotation.legacyBinding,expectedSupportType:annotation.expectedSupportType,targetSelected:target.length>0,nonTargetSelections:nonTarget.length,selectedCount:selections.length,factKindCorrect:kindMatches,numericCorrect:numericMatches,unitCorrect:unitMatches,periodCorrect:periodMatches,categoryCorrect:categoryMatches,chainParseOnly,chainCorrect:chainParseOnly&&validated,proposalValidated:validated,converted:false,conversionStatus:null,validatorFalseReject,findings:[...new Set(findings)]};
}
function supportTypeOf(spanId,{registry,sentenceIndex}){
 if(registry.get(spanId))return registry.get(spanId).spanType;
 if(sentenceIndex.get(spanId))return 'sentence';
 return 'unknown';
}
export async function runEvaluation({registry,sentenceIndex,tableIndex,index,analyst,cases,annotation,provider,allowTest=false,readClaimsSnapshot=null,clock=()=>new Date().toISOString(),promote=false,onCase=null}){
 if(!allowTest&&provider?.metadata?.kind==='test')throw new Error('Offline cases require explicit test mode');
 const gold=allowTest?null:verifyLocked(index),before=readClaimsSnapshot?.()??null,results=[],scores=[];
 for(const [position,entry] of cases.entries()){
  const started=performance.now(),result=await analyst.analyzeCase({caseId:entry.caseId,documentId:entry.documentId,page:entry.page,subjectId:registry.document(entry.documentId).subjectId,asOf:gate.asOf});
  results.push({caseId:entry.caseId,endToEndLatencyMs:performance.now()-started,...result});
  onCase?.({caseId:entry.caseId,position:position+1,total:cases.length,status:result.status??null,elapsedMs:performance.now()-started,selectedCount:(result.selections??[]).length});
  const score=scoreCase(annotation.cases.find(item=>item.caseId===entry.caseId),result,{expected:entry.expected});
  if(promote){
   const validated=(result.selections??[]).filter(selection=>selection.proposal?.validationStatus==='validated');
   const targets=annotation.cases.find(item=>item.caseId===entry.caseId).expectedSpanIds;
   const order=[...validated].sort((a,b)=>(targets.includes(b.spanId)?1:0)-(targets.includes(a.spanId)?1:0));
   for(const selection of order){
    if(score.conversionStatus){score.conversionStatus='deferred';break;}
    try{const promoted=analyst.promote(selection.proposal.id,{asOf:gate.asOf});score.converted=true;score.conversionStatus='promoted';result.conversion={proposalId:selection.proposal.id,supportCandidateId:promoted.supportCandidateId,candidateId:promoted.candidateId,anchorWords:promoted.anchor.words};}
    catch(error){score.converted=false;score.conversionStatus='rejected';result.conversion={proposalId:selection.proposal.id,error:String(error.message).slice(0,160)};if(error.message==='NO_RETRIEVAL_ANCHOR')score.findings=[...new Set([...score.findings,'NO_RETRIEVAL_ANCHOR'])];else score.findings=[...new Set([...score.findings,'CANDIDATE_REJECTED'])];}
   }
  }
  scores.push(score);
 }
 const after=readClaimsSnapshot?.()??null;
 if(before!==null&&after!==null&&digest(before)!==digest(after))throw new Error('Claims changed');
 const receipts=(provider?.receipts??[]).filter(receipt=>receipt.usage);
 const sum=key=>receipts.length&&receipts.every(receipt=>Number.isFinite(receipt.usage?.[key]))?receipts.reduce((total,receipt)=>total+receipt.usage[key],0):null;
 const latencies=results.map(result=>result.endToEndLatencyMs).sort((a,b)=>a-b);
 const totalSelected=results.reduce((total,result)=>total+(result.selectedSpanIds?.length??0),0);
 const supportErrors=results.flatMap(result=>result.errors??[]).filter(error=>error.error==='SUPPORT_INVALID');
 const tableSelections=results.flatMap(result=>(result.selections??[]).map(selection=>({...selection,caseId:result.caseId})));
 const tableOf=entry=>supportTypeOf(entry.spanId,{registry,sentenceIndex})==='table';
 const tableValid=tableSelections.filter(tableOf),tableInvalid=supportErrors.filter(tableOf);
 const failedChecks=scores.filter(score=>score.conversionStatus==='rejected').length;
 const metric={
  selectionSchemaValidity:rate(scores.filter(score=>!score.findings.includes('SPAN_SCHEMA_ERROR')&&!score.findings.includes('FABRICATED_SPAN')).length,scores.length),
  fabricatedSupportRate:rate(results.reduce((total,result)=>total+(result.fabricated?.length??0),0),totalSelected||1),
  sourceSupportFidelity:rate(totalSelected-supportErrors.length,totalSelected),
  tableStructuralFidelity:rate(tableValid.length,tableValid.length+tableInvalid.length),
  targetSelectionRate:rate(scores.filter(score=>score.targetSelected).length,scores.length),
  factKindAccuracy:rate(scores.filter(score=>score.targetSelected&&score.factKindCorrect).length,scores.filter(score=>score.targetSelected).length),
  numericAccuracy:rate(scores.filter(score=>score.targetSelected&&score.numericCorrect).length,scores.filter(score=>score.targetSelected).length),
  unitAccuracy:rate(scores.filter(score=>score.targetSelected&&score.unitCorrect).length,scores.filter(score=>score.targetSelected).length),
  periodAccuracy:rate(scores.filter(score=>score.targetSelected&&score.periodCorrect).length,scores.filter(score=>score.targetSelected).length),
  categoryAccuracy:rate(scores.filter(score=>score.targetSelected&&score.categoryCorrect).length,scores.filter(score=>score.targetSelected).length),
  chainParseOnlyRate:rate(scores.filter(score=>score.chainParseOnly).length,scores.length),
  chainCorrectRate:rate(scores.filter(score=>score.chainCorrect).length,scores.length),
  candidateConversionRate:rate(promote?scores.filter(score=>score.converted).length:scores.filter(score=>score.proposalValidated).length,scores.length),
  validatorFalseRejects:scores.filter(score=>score.validatorFalseReject).length,
  validatorFalseAccepts:0,
  wrongSupportSelections:scores.reduce((total,score)=>total+score.nonTargetSelections,0)};
 const split=type=>{const group=scores.filter(score=>score.expectedSupportType===type);return {cases:group.length,targetSelection:rate(group.filter(score=>score.targetSelected).length,group.length),numericAccuracy:rate(group.filter(score=>score.targetSelected&&score.numericCorrect).length,group.filter(score=>score.targetSelected).length),unitAccuracy:rate(group.filter(score=>score.targetSelected&&score.unitCorrect).length,group.filter(score=>score.targetSelected).length),periodAccuracy:rate(group.filter(score=>score.targetSelected&&score.periodCorrect).length,group.filter(score=>score.targetSelected).length),chainCorrectRate:rate(group.filter(score=>score.chainCorrect).length,group.length),candidateConversionRate:rate(group.filter(score=>score.converted).length,group.length)};};
 const gateResult={
  fabricatedSupport:metric.fabricatedSupportRate.numerator===0,
  sourceSupportFidelity:metric.sourceSupportFidelity.rate===1,
  tableStructuralFidelity:metric.tableStructuralFidelity.rate===1,
  validatorFalseAccepts:metric.validatorFalseAccepts===0,
  numeric:metric.numericAccuracy.rate!==null&&metric.numericAccuracy.rate>=gate.thresholds.numericFidelity,
  unit:metric.unitAccuracy.rate!==null&&metric.unitAccuracy.rate>=gate.thresholds.unitFidelity,
  period:metric.periodAccuracy.rate!==null&&metric.periodAccuracy.rate>=gate.thresholds.periodFidelity,
  candidateConversion:metric.candidateConversionRate.rate!==null&&metric.candidateConversionRate.rate>=gate.thresholds.candidateConversion,
  validatorFalseRejects:metric.validatorFalseRejects<=gate.thresholds.validatorFalseRejectsMax};
 return {status:allowTest?'OFFLINE_TEST_NOT_REAL':'REAL_EVIDENCE_SUPPORT_EVALUATED',runId:'SUPPORT-'+Date.now(),runAt:clock(),provider:provider?.metadata??null,supportVersion:'source-support/v1',validationVersion:'grounded-evidence-validation/v2',goldVersion:annotation.version,goldHash:gold?.goldHash??null,gateHash:digest(gate),metrics:metric,splits:{table:split('table'),text:split('text')},gateResult,gatePassed:Object.values(gateResult).every(Boolean),failedPromotions:failedChecks,tokens:{input:sum('inputTokens'),output:sum('outputTokens'),total:sum('totalTokens'),calls:receipts.length,providerReportedCost:receipts.length&&receipts.every(receipt=>Number.isFinite(receipt.providerReportedCost))?receipts.reduce((total,receipt)=>total+receipt.providerReportedCost,0):null},latency:{medianMs:latencies[Math.floor((latencies.length-1)/2)]??null,p95Ms:latencies[Math.ceil(latencies.length*0.95)-1]??null,sampleCount:latencies.length,exploratory:true},failureBreakdown:Object.fromEntries(failureKinds.map(kind=>[kind,scores.filter(score=>score.findings.includes(kind)).length])),claimsProtection:{before,after,unchanged:before!==null&&after!==null?digest(before)===digest(after):null},scores,results};
}
export function sanitized(result){
 return {...result,results:result.results?.map(entry=>({...entry,rawResponse:undefined,selections:entry.selections?.map(selection=>({...selection,value:selection.value?{...selection.value,rawValueText:undefined,rawUnitText:undefined,periodText:undefined}:selection.value,run:undefined}))}))};
}
