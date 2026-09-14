import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';

// v0.11.1 separates the failure vocabulary explicitly: an unusable handle is not
// a wrong semantic selection, and a wrong semantic selection is not a fabricated
// identifier. Each case lands in exactly one bucket.
export const handleFailureKinds=['INVALID_SELECTION_HANDLE','DUPLICATE_SELECTION_HANDLE','WRONG_SUPPORT_SELECTION','RETRIEVAL_MISS','MODEL_ABSTENTION','PARSER_ERROR','VALIDATOR_REJECT','PROVIDER_TIMEOUT'];
export const handleGateDecisions={ready:'LOCAL HYBRID RETRIEVAL READY',stay:'STAY ON HANDLE HARDENING'};
export function rate(numerator,denominator){return {numerator,denominator,rate:denominator?numerator/denominator:null};}

export function classifyCase({caseRecord,score,expectedSpanIds,retrievalReceipt}){
 const status=caseRecord?.status??null,run=caseRecord?.selectionRun??null;
 if(status==='INVALID_SELECTION_HANDLE')return {failure:'INVALID_SELECTION_HANDLE',detail:'handle not in the frozen invocation set: '+[...new Set(caseRecord.invalidHandles??[])].join(',')};
 if(status==='DUPLICATE_SELECTION_HANDLE')return {failure:'DUPLICATE_SELECTION_HANDLE',detail:'the same handle was selected twice'};
 if(status==='RETRIEVAL_ABSTAINED')return {failure:'RETRIEVAL_MISS',detail:'retrieval abstained before the model call'};
 if(run?.status==='provider_error')return {failure:'PROVIDER_TIMEOUT',detail:run.error};
 if(retrievalReceipt){
  const retrieved=new Set((retrievalReceipt.results??[]).map(row=>row.spanId));
  if(!expectedSpanIds.some(spanId=>retrieved.has(spanId)))return {failure:'RETRIEVAL_MISS',detail:'expected span never entered the Top-K'};
 }
 if(status==='SPAN_SCHEMA_ERROR')return {failure:'PARSER_ERROR',detail:'selection response did not match the output contract'};
 if(!(caseRecord?.selectedSpanIds??[]).length)return {failure:'MODEL_ABSTENTION',detail:'model returned no handle'};
 if(!score?.targetSelected)return {failure:'WRONG_SUPPORT_SELECTION',detail:'target span was offered but not selected'};
 if(!score.chainParseOnly)return {failure:'PARSER_ERROR',detail:(score.findings??[]).join(',')||'deterministic parse did not reach the expected fact'};
 if(!score.proposalValidated)return {failure:'VALIDATOR_REJECT',detail:(score.findings??[]).join(',')||'validator rejected an otherwise correct chain'};
 return {failure:'NONE',detail:null};
}

export function failureDecomposition({caseRows}){
 const counts=Object.fromEntries(handleFailureKinds.map(kind=>[kind,0]));
 const examples=[];let succeeded=0;
 for(const row of caseRows){
  if(!row.failure||row.failure==='NONE'){succeeded+=1;continue;}
  counts[row.failure]=(counts[row.failure]??0)+1;
  examples.push({caseId:row.caseId,failure:row.failure,detail:row.detail??null});
 }
 return {counts,succeeded,examples};
}

// A handle that is not in the frozen set is a program-visible reference error.
// The count is references, not cases, so a model that returns three bad handles
// in one response cannot look like a single incident.
export function invalidHandleReport({caseRecords}){
 const rows=[...caseRecords.values()].filter(record=>(record.invalidHandles??[]).length);
 return {cases:rows.length,references:rows.reduce((total,record)=>total+record.invalidHandles.length,0),detail:rows.map(record=>({caseId:record.caseId,status:record.status??null,invalidHandles:[...new Set(record.invalidHandles)]}))};
}

export function evaluateHandleGate({gate,safety,capability,efficiency,retrieval}){
 const items={};
 for(const key of ['invalidSelectionHandles','fabricatedSupport','falseAccept','futureLeakage','wrongSubject','claimMutation']){
  const expected=gate.safety[key];
  items['safety.'+key]={expected,actual:safety[key],passed:safety[key]===expected};
 }
 items['safety.sourceSupportFidelity']={expected:gate.safety.sourceSupportFidelity,actual:safety.sourceSupportFidelity,passed:safety.sourceSupportFidelity===gate.safety.sourceSupportFidelity};
 items['retrieval.goldRetrievalRecallAtK']={expected:'>= '+gate.retrieval.goldRetrievalRecallAtK,actual:retrieval.recallAtK,passed:retrieval.recallAtK!==null&&retrieval.recallAtK>=gate.retrieval.goldRetrievalRecallAtK};
 for(const key of ['targetSelectionRate','candidateConversionRate']){
  const floor=gate.capability[key],actual=capability[key]??null;
  items['capability.'+key]={expected:'>= '+floor,actual,passed:actual!==null&&actual>=floor,baseline:gate.baseline[key]};
 }
 items['efficiency.timeouts']={expected:'= '+gate.efficiency.timeoutsExact,actual:efficiency.timeouts,passed:efficiency.timeouts===gate.efficiency.timeoutsExact};
 const ordered=Object.entries(items).sort(([a],[b])=>a.localeCompare(b)),failed=ordered.filter(([,value])=>!value.passed).map(([key])=>key);
 return {passed:failed.length===0,failed,items,gateHash:digest(gate)};
}

export function comparisonAgainstBaseline({baseline,current}){
 return [['target selection',baseline.targetSelectionRate,current.targetSelectionRate],['candidate conversion',baseline.candidateConversionRate,current.candidateConversionRate],['timeouts',baseline.timeouts,current.timeouts],['invalid selection handles',baseline.invalidSelectionHandles,current.invalidSelectionHandles],['fabricated canonical support',baseline.fabricatedSupport,current.fabricatedSupport],['full chain',baseline.chainCorrectRate,current.chainCorrectRate]].map(([metric,from,to])=>({metric,v011:from,v0111:to,delta:typeof from==='number'&&typeof to==='number'?to-from:null}));
}

export function readHandleGate(filename=new URL('../eval/selection-handles/phase-gate.json',import.meta.url)){
 return JSON.parse(readFileSync(filename,'utf8'));
}
