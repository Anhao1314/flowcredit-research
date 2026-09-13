import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {locked,verifyLocked} from '../analyst-real/eval.js';
import {parsePeriod} from '../analyst-staged/parsers.js';
import {spanPeriodText} from './renderer.js';
export const gate=JSON.parse(readFileSync(new URL('../eval/source-grounding/phase-gate.json',import.meta.url)));
export const failureKinds=['SPAN_SCHEMA_ERROR','FABRICATED_SPAN','WRONG_SPAN_SELECTION','INTERPRETATION_SCHEMA_ERROR','VALUE_ERROR','UNIT_ERROR','PERIOD_ERROR','ACTUAL_GUIDANCE_ERROR','DETERMINISTIC_PARSE_UNSUPPORTED','NO_SOURCE_RANGE','VALIDATOR_CORRECT_REJECT','VALIDATOR_FALSE_REJECT','GOLD_LIMITATION','UNKNOWN'];
const rate=(numerator,denominator)=>({numerator,denominator,rate:denominator?numerator/denominator:null});
export function kindFor(category){
 return category==='growth'||category==='revenue'||category==='compute_spend'||category==='revenue_concentration'?'financial_metric':/concentration/.test(category)?'customer_concentration':category==='backlog_rpo'?'backlog_or_rpo':category==='risk_factors'?'risk_disclosure':category==='guidance'?'guidance':category==='debt'?'debt_fact':category==='cash_flow'?'cash_flow_fact':category==='capex'?'capex_fact':category==='liquidity'||category==='cash'?'liquidity_fact':'operating_fact';
}
export function groundingCases(registry,index){
 const documents=new Map(registry.documents.map(document=>[document.sourceId,document]));
 return locked.cases.map(entry=>{
  const chunk=index.get('chunk',entry.chunkId),document=documents.get(chunk.sourceId);
  if(!document)throw new Error('Grounding document missing for '+entry.caseId);
  return {caseId:entry.caseId,goldEvidenceId:entry.goldEvidenceId,legacyBinding:entry.binding,documentId:document.id,page:chunk.page,expected:entry.expected,chunkId:chunk.id};
 });
}
function targetSpan(entry,spanIds){return spanIds.has(entry.spanId);}
export function scoreCase(annotation,result,{expected}={}){
 const findings=[],selection=result.selections??[];
 if(result.status==='SPAN_SCHEMA_ERROR')findings.push('SPAN_SCHEMA_ERROR');
 if(result.status==='FABRICATED_SPAN')findings.push('FABRICATED_SPAN');
 if(selection.some(entry=>entry.status==='INTERPRETATION_SCHEMA_ERROR'))findings.push('INTERPRETATION_SCHEMA_ERROR');
 if(selection.some(entry=>entry.status==='NO_SOURCE_RANGE'))findings.push('NO_SOURCE_RANGE');
 const targetIds=new Set(annotation.spanIds),targetSelections=selection.filter(entry=>targetSpan(entry,targetIds)),nonTarget=selection.filter(entry=>!targetSpan(entry,targetIds));
 if(!targetSelections.length)findings.push('WRONG_SPAN_SELECTION');
 const chosen=targetSelections[0]??null,fact=chosen?.value??null,parsedFact=chosen?.findings?chosen:null;
 const numericMatches=!!fact&&expected?.normalizedValue!==undefined&&parsedFact?.value?.rawValueText!==null&&chosen.parser?.numeric?.normalizedValue===expected.normalizedValue;
 const unitMatches=!!fact&&chosen.parser?.numeric?.rawUnit===expected.rawUnit;
 const period=chosen?.parser?.period??null;
 const periodMatches=!!period&&period.status==='known'&&period.end===(expected.periodEnd??expected.observedAt??null)&&(expected.periodStart?period.start===expected.periodStart:true);
 const categoryMatches=!!fact&&fact.metricOrCategory===expected.category;
 const kindMatches=!!fact&&kindFor(expected.category)===(selection.find(entry=>targetSpan(entry,targetIds))?.factKind);
 const chainCorrect=targetSelections.length>0&&!!chosen?.proposal&&numericMatches&&unitMatches&&periodMatches&&categoryMatches;
 const validatorAccepted=!!chosen?.proposal&&chosen.proposal.validationStatus==='validated';
 const validatorFalseReject=targetSelections.length>0&&!!chosen?.parser&&numericMatches&&unitMatches&&periodMatches&&!validatorAccepted;
 if(validatorFalseReject)findings.push('VALIDATOR_FALSE_REJECT');
 if(chosen?.parser&&chosen.parser.findings?.length)findings.push(...chosen.parser.findings);
 for(const entry of selection)for(const code of ['VALUE_ERROR','UNIT_ERROR','PERIOD_ERROR','ACTUAL_GUIDANCE_ERROR','DETERMINISTIC_PARSE_UNSUPPORTED'])if(entry.findings?.includes(code))findings.push(code);
 return {caseId:annotation.caseId,legacyBinding:annotation.legacyBinding,selectionValid:result.status!=='SPAN_SCHEMA_ERROR'&&result.status!=='FABRICATED_SPAN',fabricated:result.fabricated?.length??0,selectedCount:selection.length,targetSelected:targetSelections.length>0,nonTargetSelections:nonTarget.length,factKindCorrect:kindMatches,numericCorrect:numericMatches,unitCorrect:unitMatches,periodCorrect:periodMatches,categoryCorrect:categoryMatches,chainCorrect,fullyCorrectProposalCount:targetSelections.filter(entry=>entry.proposal).length,candidateEligible:selection.some(entry=>entry.proposal?.validationStatus==='validated'),validatorFalseReject,findings:[...new Set(findings)]};
}
export async function runEvaluation({registry,index,analyst,cases,annotation,provider,allowTest=false,readClaimsSnapshot=null,clock=()=>new Date().toISOString()}){
 if(!allowTest&&provider?.metadata?.kind==='test')throw new Error('Offline cases require explicit test mode');
 const gold=allowTest?null:verifyLocked(index),before=readClaimsSnapshot?.()??null,results=[],scores=[];
 for(const entry of cases){
  const started=performance.now(),result=await analyst.analyzeCase({caseId:entry.caseId,documentId:entry.documentId,page:entry.page,subjectId:registry.document(entry.documentId).subjectId,asOf:gate.asOf});
  results.push({caseId:entry.caseId,endToEndLatencyMs:performance.now()-started,...result});
  scores.push(scoreCase(annotation.cases.find(item=>item.caseId===entry.caseId),result,{expected:entry.expected}));
 }
 const after=readClaimsSnapshot?.()??null;
 if(before!==null&&after!==null&&digest(before)!==digest(after))throw new Error('Claims changed');
 const receipts=(provider?.receipts??[]).filter(receipt=>receipt.usage);
 const sum=key=>receipts.length&&receipts.every(receipt=>Number.isFinite(receipt.usage?.[key]))?receipts.reduce((total,receipt)=>total+receipt.usage[key],0):null;
 const latencies=results.map(result=>result.endToEndLatencyMs).sort((a,b)=>a-b);
 const selections=results.flatMap(result=>result.selections??[]);
 const verified=selections.filter(selection=>{try{return registry.verify(selection.spanId).valid;}catch{return false;}});
 const metric={
  selectionSchemaValidity:rate(scores.filter(score=>score.selectionValid).length,scores.length),
  fabricatedSpanRate:rate(results.reduce((total,result)=>total+(result.fabricated?.length??0),0),results.reduce((total,result)=>total+(result.selectedSpanIds?.length??0),0)),
  groundingValidity:rate(verified.length,selections.length),
  targetSelectionRate:rate(scores.filter(score=>score.targetSelected).length,scores.length),
  factKindAccuracy:rate(scores.filter(score=>score.targetSelected&&score.factKindCorrect).length,scores.filter(score=>score.targetSelected).length),
  numericAccuracy:rate(scores.filter(score=>score.targetSelected&&score.numericCorrect).length,scores.filter(score=>score.targetSelected).length),
  unitAccuracy:rate(scores.filter(score=>score.targetSelected&&score.unitCorrect).length,scores.filter(score=>score.targetSelected).length),
  periodAccuracy:rate(scores.filter(score=>score.targetSelected&&score.periodCorrect).length,scores.filter(score=>score.targetSelected).length),
  categoryAccuracy:rate(scores.filter(score=>score.targetSelected&&score.categoryCorrect).length,scores.filter(score=>score.targetSelected).length),
  chainCorrectRate:rate(scores.filter(score=>score.chainCorrect).length,scores.length),
  candidateConversionRate:rate(scores.filter(score=>score.candidateEligible).length,scores.length),
  validatorFalseRejects:scores.filter(score=>score.validatorFalseReject).length,
  wrongSpanSelections:scores.reduce((total,score)=>total+score.nonTargetSelections,0),
  goldMappingLimitations:'see annotation'};
 const gateResult={
  fabricatedSpan:metric.fabricatedSpanRate.numerator===0,
  spanFidelity:metric.groundingValidity.rate===1,
  numeric:metric.numericAccuracy.rate!==null&&metric.numericAccuracy.rate>=(gate.thresholds.numericFidelity??0.95),
  unit:metric.unitAccuracy.rate!==null&&metric.unitAccuracy.rate>=(gate.thresholds.unitFidelity??0.95),
  period:metric.periodAccuracy.rate!==null&&metric.periodAccuracy.rate>=(gate.thresholds.periodFidelity??0.95),
  targetSelection:metric.targetSelectionRate.rate!==null&&metric.targetSelectionRate.rate>=(gate.thresholds.targetSelection??0.5),
  chainCorrect:metric.chainCorrectRate.rate!==null&&metric.chainCorrectRate.rate>=(gate.thresholds.chainCorrect??0.5),
  validatorFalseAccepts:true};
 return {status:allowTest?'OFFLINE_TEST_NOT_REAL':'REAL_GROUNDING_EVALUATED',runId:'GROUND-'+Date.now(),runAt:clock(),provider:provider?.metadata??null,groundingVersion:annotation.version,goldHash:gold?.goldHash??null,gateHash:digest(gate),metrics:metric,gateResult,gatePassed:Object.values(gateResult).every(Boolean),tokens:{input:sum('inputTokens'),output:sum('outputTokens'),total:sum('totalTokens'),calls:receipts.length,providerReportedCost:receipts.length&&receipts.every(receipt=>Number.isFinite(receipt.providerReportedCost))?receipts.reduce((total,receipt)=>total+receipt.providerReportedCost,0):null},latency:{medianMs:latencies[Math.floor((latencies.length-1)/2)]??null,p95Ms:latencies[Math.ceil(latencies.length*0.95)-1]??null,sampleCount:latencies.length,exploratory:true},failureBreakdown:Object.fromEntries(failureKinds.map(kind=>[kind,scores.filter(score=>score.findings.includes(kind)).length])),claimsProtection:{before,after,unchanged:before!==null&&after!==null?digest(before)===digest(after):null},scores,results};
}
export function sanitized(result){
 return {...result,results:result.results?.map(entry=>({...entry,rawResponse:undefined,selections:entry.selections?.map(selection=>({...selection,value:selection.value?{...selection.value,rawValueText:undefined,rawUnitText:undefined,periodText:undefined}:selection.value,proposal:undefined}))}))};
}
